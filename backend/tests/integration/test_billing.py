"""
Integration tests for billing flow.

Tests balance checks, deposits, cost deduction, and usage tracking.
"""
import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from httpx import AsyncClient, ASGITransport

from backend.main import app


@pytest.fixture
def auth_headers():
    """Create valid auth headers for API tests."""
    from backend.auth_jwt import create_access_token
    token = create_access_token(user_id=uuid4())
    return {"Authorization": f"Bearer {token}"}


class TestBalanceEndpoint:
    """Tests for GET /api/balance endpoint."""

    @pytest.mark.asyncio
    async def test_get_balance_success(self, auth_headers):
        """Returns balance info for authenticated user."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_user_billing_info = AsyncMock(return_value={
                "balance": 5.00,
                "total_deposited": 10.00,
                "total_spent": 5.00,
                "has_openrouter_key": True
            })

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/balance", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["balance"] == 5.00
        assert data["total_deposited"] == 10.00
        assert data["total_spent"] == 5.00
        assert data["has_openrouter_key"] is True

    @pytest.mark.asyncio
    async def test_get_balance_requires_auth(self):
        """Returns 401 without authentication."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/balance")

        assert response.status_code == 401


class TestDepositOptionsEndpoint:
    """Tests for GET /api/deposits/options endpoint."""

    @pytest.mark.asyncio
    async def test_get_deposit_options(self, auth_headers):
        """Returns available deposit options."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_deposit_options = AsyncMock(return_value=[
                {"id": uuid4(), "name": "$1 Try It", "amount_cents": 100},
                {"id": uuid4(), "name": "$5 Deposit", "amount_cents": 500},
            ])

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/deposits/options", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["amount_cents"] == 100
        assert data[1]["amount_cents"] == 500


class TestUsageHistoryEndpoint:
    """Tests for GET /api/usage/history endpoint."""

    @pytest.mark.asyncio
    async def test_get_usage_history(self, auth_headers):
        """Returns usage history for authenticated user."""
        from datetime import datetime
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_usage_history = AsyncMock(return_value=[
                {
                    "id": uuid4(),
                    "conversation_id": "conv-123",
                    "openrouter_cost": 0.0234,
                    "margin_cost": 0.0023,
                    "total_cost": 0.0257,
                    "model_breakdown": {"openai/gpt-5.1": 0.015},
                    "created_at": datetime.fromisoformat("2026-01-05T12:00:00+00:00")
                }
            ])

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/usage/history", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["openrouter_cost"] == 0.0234
        assert data[0]["total_cost"] == 0.0257

    @pytest.mark.asyncio
    async def test_get_usage_history_requires_auth(self):
        """Returns 401 without authentication."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/usage/history")

        assert response.status_code == 401


class TestCheckoutEndpoint:
    """Tests for POST /api/deposits/checkout endpoint."""

    @pytest.mark.asyncio
    async def test_checkout_invalid_option(self, auth_headers):
        """Returns 404 for invalid deposit option."""
        with patch("backend.main.storage") as mock_storage, \
             patch("backend.main.stripe_client") as mock_stripe, \
             patch("backend.main.checkout_rate_limiter") as mock_limiter, \
             patch("backend.main._validate_redirect_url", return_value=True):
            mock_storage.get_deposit_option = AsyncMock(return_value=None)
            mock_stripe.is_stripe_configured.return_value = True
            mock_limiter.check = AsyncMock()

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/deposits/checkout",
                    json={
                        "option_id": "00000000-0000-0000-0000-000000000099",
                        "success_url": "http://localhost:5173/success",
                        "cancel_url": "http://localhost:5173/cancel"
                    },
                    headers=auth_headers,
                )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_checkout_requires_auth(self):
        """Returns 401 without authentication."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/deposits/checkout",
                json={
                    "option_id": "00000000-0000-0000-0000-000000000001",
                    "success_url": "https://example.com/success",
                    "cancel_url": "https://example.com/cancel"
                },
            )

        assert response.status_code == 401


class TestAPIMode:
    """Tests for GET /api/settings/api-mode endpoint."""

    @pytest.mark.asyncio
    async def test_get_api_mode_credits(self, auth_headers):
        """Returns credits mode when user has balance."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_user_api_mode = AsyncMock(return_value={
                "mode": "credits",
                "has_byok_key": False,
                "byok_key_preview": None,
                "byok_validated_at": None,
                "has_provisioned_key": True,
                "balance": 5.00
            })

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/settings/api-mode", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "credits"
        assert data["balance"] == 5.00

    @pytest.mark.asyncio
    async def test_get_api_mode_byok(self, auth_headers):
        """Returns BYOK mode when user has own key."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_user_api_mode = AsyncMock(return_value={
                "mode": "byok",
                "has_byok_key": True,
                "byok_key_preview": "...abc123",
                "byok_validated_at": "2026-01-05T12:00:00Z",
                "has_provisioned_key": False,
                "balance": 0.00
            })

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/settings/api-mode", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "byok"
        assert data["has_byok_key"] is True
        assert data["byok_key_preview"] == "...abc123"


class TestBYOKEndpoints:
    """Tests for BYOK (Bring Your Own Key) endpoints."""

    @pytest.mark.asyncio
    async def test_set_byok_key_success(self, auth_headers):
        """Successfully sets BYOK key after validation."""
        with patch("backend.main.storage") as mock_storage, \
             patch("backend.main.api_rate_limiter") as mock_limiter, \
             patch("backend.openrouter.validate_api_key") as mock_validate:
            mock_storage.save_user_byok_key = AsyncMock()
            mock_storage.get_user_api_mode = AsyncMock(return_value={
                "mode": "byok",
                "has_byok_key": True,
                "byok_key_preview": "...xyz789",
                "byok_validated_at": "2026-01-05T12:00:00Z",
                "has_provisioned_key": False,
                "balance": 0.00
            })
            mock_limiter.check = AsyncMock()
            mock_validate.return_value = (True, None)

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/settings/byok",
                    json={"api_key": "sk-or-v1-validkey12345678901234567890"},
                    headers=auth_headers,
                )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "byok"

    @pytest.mark.asyncio
    async def test_set_byok_key_invalid(self, auth_headers):
        """Returns error for invalid BYOK key."""
        with patch("backend.main.api_rate_limiter") as mock_limiter, \
             patch("backend.openrouter.validate_api_key") as mock_validate:
            mock_limiter.check = AsyncMock()
            mock_validate.return_value = (False, "Invalid API key")

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/settings/byok",
                    json={"api_key": "sk-or-v1-invalidkey123456789012345"},
                    headers=auth_headers,
                )

        assert response.status_code == 400
        assert "Invalid" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_delete_byok_key(self, auth_headers):
        """Successfully deletes BYOK key."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.delete_user_byok_key = AsyncMock(return_value=True)

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.delete(
                    "/api/settings/byok",
                    headers=auth_headers,
                )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestCostDeductionLogic:
    """Tests for cost deduction logic using local storage stubs."""

    @pytest.mark.asyncio
    async def test_add_and_consume_credits(self, isolated_storage):
        """Credits can be added and consumed."""
        user_id = uuid4()

        # Add credits
        balance = await isolated_storage.add_credits(
            user_id=user_id,
            amount=10,
            transaction_type="deposit",
            description="Test deposit"
        )
        assert balance == 10

        # Consume credit
        success = await isolated_storage.consume_credit(user_id, "Query 1")
        assert success is True

        # Check balance
        remaining = await isolated_storage.get_user_credits(user_id)
        assert remaining == 9

    @pytest.mark.asyncio
    async def test_cannot_consume_without_credits(self, isolated_storage):
        """Cannot consume credits when balance is 0."""
        user_id = uuid4()

        success = await isolated_storage.consume_credit(user_id, "Query")
        assert success is False

    @pytest.mark.asyncio
    async def test_transaction_history_recorded(self, isolated_storage):
        """Transactions are recorded in history."""
        user_id = uuid4()

        await isolated_storage.add_credits(user_id, 5, "deposit", "Initial")
        await isolated_storage.consume_credit(user_id, "Query 1")
        await isolated_storage.consume_credit(user_id, "Query 2")

        history = await isolated_storage.get_credit_transactions(user_id)

        assert len(history) == 3
        # Verify correct amounts exist (order may vary due to same-second timestamps)
        amounts = [h["amount"] for h in history]
        assert amounts.count(-1) == 2  # Two consumption transactions
        assert amounts.count(5) == 1   # One deposit transaction


class TestMinimumBalanceCheck:
    """Tests for minimum balance check logic."""

    @pytest.mark.asyncio
    async def test_balance_above_minimum_allows_query(self, isolated_storage):
        """Query is allowed when balance is above minimum."""
        user_id = uuid4()

        # Add $1.00 worth of credits (in the stub, this is integer credits)
        await isolated_storage.add_credits(user_id, 10, "deposit")

        # Check balance (local stub uses integer credits, not dollars)
        balance = await isolated_storage.get_user_credits(user_id)
        assert balance >= 1  # Has at least 1 credit

    @pytest.mark.asyncio
    async def test_balance_below_minimum_blocks_query(self, isolated_storage):
        """Query is blocked when balance is below minimum."""
        user_id = uuid4()

        # No credits
        balance = await isolated_storage.get_user_credits(user_id)
        assert balance == 0

        # Try to consume (should fail)
        success = await isolated_storage.consume_credit(user_id)
        assert success is False
