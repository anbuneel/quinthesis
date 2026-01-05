"""
Tests for Stripe webhook endpoint and payment handling.

Tests the money-critical path: webhook verification → payment processing → balance update.
"""
import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from decimal import Decimal

import stripe


@pytest.fixture
def client():
    from backend.main import app
    return TestClient(app)


@pytest.fixture
def mock_storage():
    """Mock storage for webhook tests."""
    with patch("backend.main.storage") as mock:
        mock.get_deposit_option = AsyncMock(return_value={
            "id": str(uuid4()),
            "name": "$5 Deposit",
            "amount_cents": 500,
            "openrouter_limit_dollars": 5.0
        })
        mock.get_credit_pack = AsyncMock(return_value={
            "id": str(uuid4()),
            "name": "10 Credits",
            "credits": 10,
            "price_cents": 500,
            "openrouter_credit_limit": 5.0
        })
        mock.add_deposit = AsyncMock()
        mock.add_credits = AsyncMock()
        mock.save_user_stripe_customer_id = AsyncMock()
        mock.get_user_by_id = AsyncMock(return_value={"email": "test@example.com"})
        mock.get_user_balance = AsyncMock(return_value=5.0)
        mock.increment_openrouter_limit = AsyncMock(return_value=Decimal("10.0"))
        mock.get_user_openrouter_key_hash = AsyncMock(return_value=None)
        mock.save_user_openrouter_key = AsyncMock()
        yield mock


class TestStripeWebhookEndpoint:
    """Tests for /api/webhooks/stripe endpoint."""

    def test_webhook_not_configured(self, client):
        """Returns 503 when webhook secret not configured."""
        with patch("backend.main.stripe_client.is_webhook_configured", return_value=False):
            response = client.post(
                "/api/webhooks/stripe",
                content=b'{"test": "payload"}',
                headers={"stripe-signature": "test-sig"}
            )

        assert response.status_code == 503
        assert "not configured" in response.json()["detail"].lower()

    def test_webhook_missing_signature(self, client):
        """Returns 400 when signature header is missing."""
        with patch("backend.main.stripe_client.is_webhook_configured", return_value=True):
            response = client.post(
                "/api/webhooks/stripe",
                content=b'{"test": "payload"}'
                # No stripe-signature header
            )

        assert response.status_code == 400
        assert "signature" in response.json()["detail"].lower()

    def test_webhook_invalid_signature(self, client):
        """Returns 400 when signature verification fails."""
        with patch("backend.main.stripe_client.is_webhook_configured", return_value=True), \
             patch("backend.main.stripe_client.verify_webhook_signature") as mock_verify:
            mock_verify.side_effect = stripe.error.SignatureVerificationError(
                "Invalid signature", "sig"
            )

            response = client.post(
                "/api/webhooks/stripe",
                content=b'{"test": "payload"}',
                headers={"stripe-signature": "invalid-sig"}
            )

        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower()

    def test_webhook_payment_not_paid_yet(self, client):
        """Returns ok but doesn't process when payment_status is not 'paid'."""
        event = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_123",
                    "payment_status": "unpaid"  # Async payment method
                }
            }
        }

        with patch("backend.main.stripe_client.is_webhook_configured", return_value=True), \
             patch("backend.main.stripe_client.verify_webhook_signature", return_value=event), \
             patch("backend.main.handle_successful_payment") as mock_handle:

            response = client.post(
                "/api/webhooks/stripe",
                content=b'{"test": "payload"}',
                headers={"stripe-signature": "valid-sig"}
            )

        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        mock_handle.assert_not_called()  # Should not process unpaid

    def test_webhook_ignores_other_event_types(self, client):
        """Returns ok for non-checkout events without processing."""
        event = {
            "type": "customer.created",  # Not checkout.session.completed
            "data": {"object": {"id": "cus_test"}}
        }

        with patch("backend.main.stripe_client.is_webhook_configured", return_value=True), \
             patch("backend.main.stripe_client.verify_webhook_signature", return_value=event), \
             patch("backend.main.handle_successful_payment") as mock_handle:

            response = client.post(
                "/api/webhooks/stripe",
                content=b'{"test": "payload"}',
                headers={"stripe-signature": "valid-sig"}
            )

        assert response.status_code == 200
        mock_handle.assert_not_called()


class TestHandleSuccessfulPayment:
    """Tests for handle_successful_payment function."""

    @pytest.mark.asyncio
    async def test_deposit_success(self, mock_storage):
        """Successfully processes a deposit payment."""
        from backend.main import handle_successful_payment

        user_id = uuid4()
        pack_id = uuid4()

        # Mock verified session from Stripe API
        mock_session = MagicMock()
        mock_session.get = lambda k, d=None: {
            "metadata": {"user_id": str(user_id), "pack_id": str(pack_id), "is_deposit": "true"},
            "amount_total": 500,
            "currency": "usd",
            "customer": "cus_test123",
            "payment_intent": "pi_test123"
        }.get(k, d)

        session_data = {"id": "cs_test_deposit"}

        with patch("backend.main.stripe_client.get_session_details", return_value=mock_session), \
             patch("backend.main.openrouter_provisioning.is_provisioning_configured", return_value=False), \
             patch("backend.main.notifications.notify_deposit", new_callable=AsyncMock):

            await handle_successful_payment(session_data)

        # Verify deposit was added
        mock_storage.add_deposit.assert_called_once()
        call_kwargs = mock_storage.add_deposit.call_args[1]
        assert call_kwargs["user_id"] == user_id
        assert call_kwargs["amount_dollars"] == 5.0
        assert call_kwargs["stripe_session_id"] == "cs_test_deposit"

    @pytest.mark.asyncio
    async def test_legacy_credits_success(self, mock_storage):
        """Successfully processes a legacy credit purchase."""
        from backend.main import handle_successful_payment

        user_id = uuid4()
        pack_id = uuid4()

        mock_session = MagicMock()
        mock_session.get = lambda k, d=None: {
            "metadata": {"user_id": str(user_id), "pack_id": str(pack_id), "is_deposit": "false"},
            "amount_total": 500,
            "currency": "usd",
            "customer": "cus_test456",
            "payment_intent": "pi_test456"
        }.get(k, d)

        session_data = {"id": "cs_test_credits"}

        with patch("backend.main.stripe_client.get_session_details", return_value=mock_session), \
             patch("backend.main.openrouter_provisioning.is_provisioning_configured", return_value=False):

            await handle_successful_payment(session_data)

        # Verify credits were added
        mock_storage.add_credits.assert_called_once()
        call_kwargs = mock_storage.add_credits.call_args[1]
        assert call_kwargs["user_id"] == user_id
        assert call_kwargs["amount"] == 10  # From mock pack
        assert call_kwargs["stripe_session_id"] == "cs_test_credits"

    @pytest.mark.asyncio
    async def test_amount_mismatch_raises_error(self, mock_storage):
        """Raises error when payment amount doesn't match expected."""
        from backend.main import handle_successful_payment

        user_id = uuid4()
        pack_id = uuid4()

        mock_session = MagicMock()
        mock_session.get = lambda k, d=None: {
            "metadata": {"user_id": str(user_id), "pack_id": str(pack_id), "is_deposit": "true"},
            "amount_total": 1000,  # $10, but pack expects $5
            "currency": "usd",
        }.get(k, d)

        session_data = {"id": "cs_test_mismatch"}

        with patch("backend.main.stripe_client.get_session_details", return_value=mock_session):
            with pytest.raises(ValueError, match="amount mismatch"):
                await handle_successful_payment(session_data)

    @pytest.mark.asyncio
    async def test_currency_mismatch_raises_error(self, mock_storage):
        """Raises error when currency is not USD."""
        from backend.main import handle_successful_payment

        user_id = uuid4()
        pack_id = uuid4()

        mock_session = MagicMock()
        mock_session.get = lambda k, d=None: {
            "metadata": {"user_id": str(user_id), "pack_id": str(pack_id), "is_deposit": "true"},
            "amount_total": 500,
            "currency": "eur",  # Not USD
        }.get(k, d)

        session_data = {"id": "cs_test_currency"}

        with patch("backend.main.stripe_client.get_session_details", return_value=mock_session):
            with pytest.raises(ValueError, match="currency mismatch"):
                await handle_successful_payment(session_data)

    @pytest.mark.asyncio
    async def test_idempotency_on_duplicate_session(self, mock_storage):
        """Handles duplicate session gracefully (idempotency)."""
        import asyncpg
        from backend.main import handle_successful_payment

        user_id = uuid4()
        pack_id = uuid4()

        mock_session = MagicMock()
        mock_session.get = lambda k, d=None: {
            "metadata": {"user_id": str(user_id), "pack_id": str(pack_id), "is_deposit": "true"},
            "amount_total": 500,
            "currency": "usd",
        }.get(k, d)

        session_data = {"id": "cs_test_duplicate"}

        # Simulate unique constraint violation (already processed)
        mock_storage.add_deposit.side_effect = asyncpg.UniqueViolationError("")

        with patch("backend.main.stripe_client.get_session_details", return_value=mock_session), \
             patch("backend.main.openrouter_provisioning.is_provisioning_configured", return_value=False):
            # Should not raise - just return early
            await handle_successful_payment(session_data)

        # Should have attempted to add deposit
        mock_storage.add_deposit.assert_called_once()

    @pytest.mark.asyncio
    async def test_invalid_pack_id_raises_error(self, mock_storage):
        """Raises error when pack/option not found."""
        from backend.main import handle_successful_payment

        user_id = uuid4()
        pack_id = uuid4()

        mock_session = MagicMock()
        mock_session.get = lambda k, d=None: {
            "metadata": {"user_id": str(user_id), "pack_id": str(pack_id), "is_deposit": "true"},
            "amount_total": 500,
            "currency": "usd",
        }.get(k, d)

        session_data = {"id": "cs_test_invalid_pack"}

        # Option not found
        mock_storage.get_deposit_option.return_value = None

        with patch("backend.main.stripe_client.get_session_details", return_value=mock_session):
            with pytest.raises(ValueError, match="Invalid option ID"):
                await handle_successful_payment(session_data)

    @pytest.mark.asyncio
    async def test_openrouter_key_provisioning(self, mock_storage):
        """Creates/updates OpenRouter key after successful payment."""
        from backend.main import handle_successful_payment

        user_id = uuid4()
        pack_id = uuid4()

        mock_session = MagicMock()
        mock_session.get = lambda k, d=None: {
            "metadata": {"user_id": str(user_id), "pack_id": str(pack_id), "is_deposit": "true"},
            "amount_total": 500,
            "currency": "usd",
            "customer": "cus_test",
            "payment_intent": "pi_test"
        }.get(k, d)

        session_data = {"id": "cs_test_provision"}

        mock_key_result = {
            "key": "sk-or-v1-new-key",
            "hash": "key-hash-123"
        }

        with patch("backend.main.stripe_client.get_session_details", return_value=mock_session), \
             patch("backend.main.openrouter_provisioning.is_provisioning_configured", return_value=True), \
             patch("backend.main.openrouter_provisioning.create_user_key", new_callable=AsyncMock, return_value=mock_key_result), \
             patch("backend.main.notifications.notify_deposit", new_callable=AsyncMock):

            await handle_successful_payment(session_data)

        # Should have saved the new key
        mock_storage.save_user_openrouter_key.assert_called_once()
