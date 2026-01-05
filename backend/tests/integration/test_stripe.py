"""
Integration tests for Stripe client.

Uses unittest.mock to mock the Stripe SDK calls.
Tests checkout session creation, webhook verification, and customer management.
"""
import pytest
from unittest.mock import patch, MagicMock
from uuid import uuid4

import stripe

from backend.stripe_client import (
    create_checkout_session,
    verify_webhook_signature,
    get_session_details,
    get_or_create_customer,
    is_stripe_configured,
    is_webhook_configured,
)


class TestStripeConfiguration:
    """Tests for Stripe configuration checks."""

    def test_is_stripe_configured_with_key(self):
        """Returns True when STRIPE_SECRET_KEY is set."""
        with patch("backend.stripe_client.STRIPE_SECRET_KEY", "sk_test_123"):
            assert is_stripe_configured() is True

    def test_is_stripe_configured_without_key(self):
        """Returns False when STRIPE_SECRET_KEY is not set."""
        with patch("backend.stripe_client.STRIPE_SECRET_KEY", None):
            assert is_stripe_configured() is False

    def test_is_webhook_configured_with_secret(self):
        """Returns True when STRIPE_WEBHOOK_SECRET is set."""
        with patch("backend.stripe_client.STRIPE_WEBHOOK_SECRET", "whsec_123"):
            assert is_webhook_configured() is True

    def test_is_webhook_configured_without_secret(self):
        """Returns False when STRIPE_WEBHOOK_SECRET is not set."""
        with patch("backend.stripe_client.STRIPE_WEBHOOK_SECRET", None):
            assert is_webhook_configured() is False


class TestCreateCheckoutSession:
    """Tests for create_checkout_session function."""

    @pytest.mark.asyncio
    async def test_create_session_success(self):
        """Successfully creates checkout session."""
        mock_session = MagicMock()
        mock_session.id = "cs_test_123"
        mock_session.url = "https://checkout.stripe.com/test"

        with patch("backend.stripe_client.STRIPE_SECRET_KEY", "sk_test_123"), \
             patch("stripe.checkout.Session.create", return_value=mock_session):

            result = await create_checkout_session(
                user_id=uuid4(),
                user_email="test@example.com",
                pack_id=uuid4(),
                pack_name="$5 Deposit",
                credits=0,
                price_cents=500,
                openrouter_limit_dollars=5.0,
                success_url="https://example.com/success",
                cancel_url="https://example.com/cancel",
                is_deposit=True,
            )

        assert result["session_id"] == "cs_test_123"
        assert result["checkout_url"] == "https://checkout.stripe.com/test"

    @pytest.mark.asyncio
    async def test_create_session_with_existing_customer(self):
        """Uses existing customer ID when provided."""
        mock_session = MagicMock()
        mock_session.id = "cs_test_456"
        mock_session.url = "https://checkout.stripe.com/test2"

        with patch("backend.stripe_client.STRIPE_SECRET_KEY", "sk_test_123"), \
             patch("stripe.checkout.Session.create", return_value=mock_session) as mock_create:

            await create_checkout_session(
                user_id=uuid4(),
                user_email="test@example.com",
                pack_id=uuid4(),
                pack_name="$10 Deposit",
                credits=0,
                price_cents=1000,
                openrouter_limit_dollars=10.0,
                success_url="https://example.com/success",
                cancel_url="https://example.com/cancel",
                stripe_customer_id="cus_existing123",
                is_deposit=True,
            )

        # Verify customer ID was passed
        call_kwargs = mock_create.call_args[1]
        assert call_kwargs["customer"] == "cus_existing123"
        assert "customer_email" not in call_kwargs

    @pytest.mark.asyncio
    async def test_create_session_metadata_for_deposit(self):
        """Deposit sessions include correct metadata."""
        mock_session = MagicMock()
        mock_session.id = "cs_test_789"
        mock_session.url = "https://checkout.stripe.com/test3"

        user_id = uuid4()
        pack_id = uuid4()

        with patch("backend.stripe_client.STRIPE_SECRET_KEY", "sk_test_123"), \
             patch("stripe.checkout.Session.create", return_value=mock_session) as mock_create:

            await create_checkout_session(
                user_id=user_id,
                user_email="test@example.com",
                pack_id=pack_id,
                pack_name="$5 Deposit",
                credits=0,
                price_cents=500,
                openrouter_limit_dollars=5.0,
                success_url="https://example.com/success",
                cancel_url="https://example.com/cancel",
                is_deposit=True,
            )

        call_kwargs = mock_create.call_args[1]
        metadata = call_kwargs["metadata"]
        assert metadata["user_id"] == str(user_id)
        assert metadata["pack_id"] == str(pack_id)
        assert metadata["is_deposit"] == "true"
        assert metadata["openrouter_limit_dollars"] == "5.0"

    @pytest.mark.asyncio
    async def test_create_session_not_configured(self):
        """Raises error when Stripe not configured."""
        with patch("backend.stripe_client.STRIPE_SECRET_KEY", None):
            with pytest.raises(RuntimeError, match="not configured"):
                await create_checkout_session(
                    user_id=uuid4(),
                    user_email="test@example.com",
                    pack_id=uuid4(),
                    pack_name="Test",
                    credits=0,
                    price_cents=100,
                    openrouter_limit_dollars=1.0,
                    success_url="https://example.com/success",
                    cancel_url="https://example.com/cancel",
                )


class TestVerifyWebhookSignature:
    """Tests for verify_webhook_signature function."""

    def test_verify_valid_signature(self):
        """Valid signature returns event."""
        mock_event = {"type": "checkout.session.completed", "data": {}}

        with patch("backend.stripe_client.STRIPE_WEBHOOK_SECRET", "whsec_test"), \
             patch("stripe.Webhook.construct_event", return_value=mock_event):

            result = verify_webhook_signature(
                payload=b'{"test": "payload"}',
                sig_header="t=123,v1=abc"
            )

        assert result["type"] == "checkout.session.completed"

    def test_verify_invalid_signature(self):
        """Invalid signature raises error."""
        with patch("backend.stripe_client.STRIPE_WEBHOOK_SECRET", "whsec_test"), \
             patch("stripe.Webhook.construct_event") as mock_construct:
            mock_construct.side_effect = stripe.error.SignatureVerificationError(
                "Invalid signature", "sig"
            )

            with pytest.raises(stripe.error.SignatureVerificationError):
                verify_webhook_signature(
                    payload=b'{"test": "payload"}',
                    sig_header="invalid-sig"
                )

    def test_verify_not_configured(self):
        """Raises error when webhook secret not configured."""
        with patch("backend.stripe_client.STRIPE_WEBHOOK_SECRET", None):
            with pytest.raises(ValueError, match="not configured"):
                verify_webhook_signature(
                    payload=b'{"test": "payload"}',
                    sig_header="t=123,v1=abc"
                )


class TestGetSessionDetails:
    """Tests for get_session_details function."""

    def test_get_session_success(self):
        """Successfully retrieves session details."""
        mock_session = MagicMock()
        mock_session.id = "cs_test_retrieve"
        mock_session.payment_status = "paid"
        mock_session.amount_total = 500

        with patch("backend.stripe_client.STRIPE_SECRET_KEY", "sk_test_123"), \
             patch("stripe.checkout.Session.retrieve", return_value=mock_session):

            result = get_session_details("cs_test_retrieve")

        assert result.id == "cs_test_retrieve"
        assert result.payment_status == "paid"

    def test_get_session_not_configured(self):
        """Raises error when Stripe not configured."""
        with patch("backend.stripe_client.STRIPE_SECRET_KEY", None):
            with pytest.raises(RuntimeError, match="not configured"):
                get_session_details("cs_test_123")


class TestGetOrCreateCustomer:
    """Tests for get_or_create_customer function."""

    def test_get_existing_customer(self):
        """Returns existing customer ID when found."""
        mock_customer = MagicMock()
        mock_customer.id = "cus_existing"

        mock_search_result = MagicMock()
        mock_search_result.data = [mock_customer]

        with patch("backend.stripe_client.STRIPE_SECRET_KEY", "sk_test_123"), \
             patch("stripe.Customer.search", return_value=mock_search_result):

            result = get_or_create_customer("existing@example.com")

        assert result == "cus_existing"

    def test_create_new_customer(self):
        """Creates new customer when not found."""
        mock_search_result = MagicMock()
        mock_search_result.data = []  # No existing customer

        mock_new_customer = MagicMock()
        mock_new_customer.id = "cus_new123"

        with patch("backend.stripe_client.STRIPE_SECRET_KEY", "sk_test_123"), \
             patch("stripe.Customer.search", return_value=mock_search_result), \
             patch("stripe.Customer.create", return_value=mock_new_customer):

            result = get_or_create_customer("new@example.com", name="New User")

        assert result == "cus_new123"

    def test_create_customer_with_name(self):
        """Includes name when creating customer."""
        mock_search_result = MagicMock()
        mock_search_result.data = []

        mock_new_customer = MagicMock()
        mock_new_customer.id = "cus_named"

        with patch("backend.stripe_client.STRIPE_SECRET_KEY", "sk_test_123"), \
             patch("stripe.Customer.search", return_value=mock_search_result), \
             patch("stripe.Customer.create", return_value=mock_new_customer) as mock_create:

            get_or_create_customer("test@example.com", name="Test User")

        mock_create.assert_called_once_with(email="test@example.com", name="Test User")

    def test_get_customer_not_configured(self):
        """Raises error when Stripe not configured."""
        with patch("backend.stripe_client.STRIPE_SECRET_KEY", None):
            with pytest.raises(RuntimeError, match="not configured"):
                get_or_create_customer("test@example.com")


class TestStripeErrorHandling:
    """Tests for Stripe API error handling."""

    @pytest.mark.asyncio
    async def test_create_session_api_error(self):
        """Propagates Stripe API errors."""
        with patch("backend.stripe_client.STRIPE_SECRET_KEY", "sk_test_123"), \
             patch("stripe.checkout.Session.create") as mock_create:
            mock_create.side_effect = stripe.error.StripeError("API error")

            with pytest.raises(stripe.error.StripeError):
                await create_checkout_session(
                    user_id=uuid4(),
                    user_email="test@example.com",
                    pack_id=uuid4(),
                    pack_name="Test",
                    credits=0,
                    price_cents=100,
                    openrouter_limit_dollars=1.0,
                    success_url="https://example.com/success",
                    cancel_url="https://example.com/cancel",
                )

    def test_retrieve_session_not_found(self):
        """Handles session not found error."""
        with patch("backend.stripe_client.STRIPE_SECRET_KEY", "sk_test_123"), \
             patch("stripe.checkout.Session.retrieve") as mock_retrieve:
            mock_retrieve.side_effect = stripe.error.InvalidRequestError(
                "No such session", "session_id"
            )

            with pytest.raises(stripe.error.InvalidRequestError):
                get_session_details("cs_nonexistent")
