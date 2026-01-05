"""
Tests for non-streaming message endpoint.

Tests the full cost/title path: rate limiting → council query → cost deduction.
"""
import pytest
from uuid import uuid4
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from backend.auth_jwt import create_access_token


@pytest.fixture
def client():
    from backend.main import app
    return TestClient(app)


@pytest.fixture
def auth_headers():
    """Create valid auth headers for testing."""
    token = create_access_token(user_id=uuid4())
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_storage():
    """Mock storage for message endpoint tests."""
    with patch("backend.main.storage") as mock:
        mock.get_conversation = AsyncMock(return_value={
            "id": "conv-123",
            "messages": [],
            "models": ["openai/gpt-5.1", "anthropic/claude-sonnet-4.5"],
            "lead_model": "google/gemini-3-pro-preview"
        })
        mock.get_user_openrouter_key = AsyncMock(return_value="sk-or-v1-test-key")
        mock.check_minimum_balance = AsyncMock(return_value=True)
        mock.add_user_message = AsyncMock()
        mock.add_assistant_message = AsyncMock()
        mock.update_conversation_title = AsyncMock()
        mock.deduct_query_cost = AsyncMock(return_value=(True, 4.95))
        mock.get_user_balance = AsyncMock(return_value=5.0)
        yield mock


@pytest.fixture
def mock_council():
    """Mock council functions for successful query."""
    stage1 = [
        {"model": "openai/gpt-5.1", "response": "Test response 1", "generation_id": "gen-1a"},
        {"model": "anthropic/claude-sonnet-4.5", "response": "Test response 2", "generation_id": "gen-1b"}
    ]
    stage2 = [
        {"model": "openai/gpt-5.1", "ranking": "1. Response A\n2. Response B", "parsed_ranking": ["A", "B"], "generation_id": "gen-2a"},
        {"model": "anthropic/claude-sonnet-4.5", "ranking": "1. Response B\n2. Response A", "parsed_ranking": ["B", "A"], "generation_id": "gen-2b"}
    ]
    stage3 = {"response": "Final synthesis", "generation_id": "gen-3"}
    metadata = {
        "label_to_model": {"A": "openai/gpt-5.1", "B": "anthropic/claude-sonnet-4.5"},
        "aggregate_rankings": []
    }
    generation_ids = ["gen-1a", "gen-1b", "gen-2a", "gen-2b", "gen-3"]

    with patch("backend.main.run_full_council", new_callable=AsyncMock) as mock:
        mock.return_value = (stage1, stage2, stage3, metadata, generation_ids)
        yield mock


@pytest.fixture
def mock_costs():
    """Mock cost retrieval."""
    costs = {
        "gen-1a": {"total_cost": 0.01, "model": "openai/gpt-5.1"},
        "gen-1b": {"total_cost": 0.008, "model": "anthropic/claude-sonnet-4.5"},
        "gen-2a": {"total_cost": 0.005, "model": "openai/gpt-5.1"},
        "gen-2b": {"total_cost": 0.004, "model": "anthropic/claude-sonnet-4.5"},
        "gen-3": {"total_cost": 0.008, "model": "google/gemini-3-pro-preview"}
    }
    with patch("backend.main.get_generation_costs_batch", new_callable=AsyncMock, return_value=costs):
        yield


class TestSendMessageEndpoint:
    """Tests for POST /api/conversations/{id}/message endpoint."""

    def test_conversation_not_found(self, client, auth_headers, mock_storage):
        """Returns 404 when conversation doesn't exist."""
        mock_storage.get_conversation.return_value = None

        response = client.post(
            "/api/conversations/nonexistent/message",
            json={"content": "test question"},
            headers=auth_headers
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_no_api_key_configured(self, client, auth_headers, mock_storage):
        """Returns 402 when user has no API key."""
        mock_storage.get_user_openrouter_key.return_value = None

        response = client.post(
            "/api/conversations/conv-123/message",
            json={"content": "test question"},
            headers=auth_headers
        )

        assert response.status_code == 402
        assert "api" in response.json()["detail"].lower()

    def test_insufficient_balance(self, client, auth_headers, mock_storage):
        """Returns 402 when balance is below minimum."""
        mock_storage.check_minimum_balance.return_value = False

        response = client.post(
            "/api/conversations/conv-123/message",
            json={"content": "test question"},
            headers=auth_headers
        )

        assert response.status_code == 402
        assert "balance" in response.json()["detail"].lower()

    def test_requires_authentication(self, client, mock_storage):
        """Returns 401 when not authenticated."""
        response = client.post(
            "/api/conversations/conv-123/message",
            json={"content": "test question"}
        )

        assert response.status_code == 401

    def test_successful_query_returns_all_stages(
        self, client, auth_headers, mock_storage, mock_council, mock_costs
    ):
        """Successful query returns stage1, stage2, stage3, metadata, and cost."""
        with patch("backend.main.generate_conversation_title", new_callable=AsyncMock) as mock_title:
            mock_title.return_value = ("Test Title", "gen-title")

            response = client.post(
                "/api/conversations/conv-123/message",
                json={"content": "What is the meaning of life?"},
                headers=auth_headers
            )

        assert response.status_code == 200
        data = response.json()

        # Check all stages present
        assert "stage1" in data
        assert "stage2" in data
        assert "stage3" in data
        assert "metadata" in data
        assert "cost" in data

        # Check cost breakdown
        assert "openrouter_cost" in data["cost"]
        assert "margin_cost" in data["cost"]
        assert "total_cost" in data["cost"]
        assert "new_balance" in data["cost"]

    def test_title_generation_on_first_message(
        self, client, auth_headers, mock_storage, mock_council, mock_costs
    ):
        """Title is generated for first message in conversation."""
        # First message (empty messages array)
        mock_storage.get_conversation.return_value = {
            "id": "conv-123",
            "messages": [],  # First message
            "models": ["openai/gpt-5.1", "anthropic/claude-sonnet-4.5"],
            "lead_model": "google/gemini-3-pro-preview"
        }

        with patch("backend.main.generate_conversation_title", new_callable=AsyncMock) as mock_title:
            mock_title.return_value = ("Generated Title", "gen-title")

            response = client.post(
                "/api/conversations/conv-123/message",
                json={"content": "What is AI?"},
                headers=auth_headers
            )

        assert response.status_code == 200
        mock_title.assert_called_once()
        mock_storage.update_conversation_title.assert_called_once()

    def test_no_title_generation_on_subsequent_messages(
        self, client, auth_headers, mock_storage, mock_council, mock_costs
    ):
        """No title generation for subsequent messages."""
        # Not first message (has existing messages)
        mock_storage.get_conversation.return_value = {
            "id": "conv-123",
            "messages": [{"role": "user", "content": "first"}],  # Has messages
            "models": ["openai/gpt-5.1", "anthropic/claude-sonnet-4.5"],
            "lead_model": "google/gemini-3-pro-preview"
        }

        with patch("backend.main.generate_conversation_title", new_callable=AsyncMock) as mock_title:
            response = client.post(
                "/api/conversations/conv-123/message",
                json={"content": "Follow up question"},
                headers=auth_headers
            )

        assert response.status_code == 200
        mock_title.assert_not_called()

    def test_cost_deduction_after_success(
        self, client, auth_headers, mock_storage, mock_council, mock_costs
    ):
        """Costs are deducted from balance after successful query."""
        with patch("backend.main.generate_conversation_title", new_callable=AsyncMock) as mock_title:
            mock_title.return_value = ("Title", "gen-title")

            response = client.post(
                "/api/conversations/conv-123/message",
                json={"content": "test"},
                headers=auth_headers
            )

        assert response.status_code == 200
        mock_storage.deduct_query_cost.assert_called_once()

        # Verify cost parameters
        call_kwargs = mock_storage.deduct_query_cost.call_args[1]
        assert "openrouter_cost" in call_kwargs
        assert "model_breakdown" in call_kwargs
        assert call_kwargs["conversation_id"] == "conv-123"

    def test_council_failure_returns_502(
        self, client, auth_headers, mock_storage
    ):
        """Returns 502 when council query fails."""
        with patch("backend.main.run_full_council", new_callable=AsyncMock) as mock_council, \
             patch("backend.main.generate_conversation_title", new_callable=AsyncMock) as mock_title:
            mock_council.side_effect = Exception("OpenRouter API error")
            mock_title.return_value = ("Title", "gen-title")

            response = client.post(
                "/api/conversations/conv-123/message",
                json={"content": "test"},
                headers=auth_headers
            )

        assert response.status_code == 502
        assert "failed" in response.json()["detail"].lower()

    def test_no_charge_on_failure(
        self, client, auth_headers, mock_storage
    ):
        """No cost deduction when query fails."""
        with patch("backend.main.run_full_council", new_callable=AsyncMock) as mock_council, \
             patch("backend.main.generate_conversation_title", new_callable=AsyncMock) as mock_title:
            mock_council.side_effect = Exception("API error")
            mock_title.return_value = ("Title", "gen-title")

            response = client.post(
                "/api/conversations/conv-123/message",
                json={"content": "test"},
                headers=auth_headers
            )

        assert response.status_code == 502
        mock_storage.deduct_query_cost.assert_not_called()

    def test_message_saved_to_storage(
        self, client, auth_headers, mock_storage, mock_council, mock_costs
    ):
        """User message and assistant response are saved."""
        with patch("backend.main.generate_conversation_title", new_callable=AsyncMock) as mock_title:
            mock_title.return_value = ("Title", "gen-title")

            response = client.post(
                "/api/conversations/conv-123/message",
                json={"content": "My question"},
                headers=auth_headers
            )

        assert response.status_code == 200

        # User message saved
        mock_storage.add_user_message.assert_called_once_with("conv-123", "My question")

        # Assistant message saved with all stages
        mock_storage.add_assistant_message.assert_called_once()


class TestRateLimiting:
    """Tests for rate limiting on message endpoint."""

    def test_rate_limit_enforced(self, client, auth_headers, mock_storage):
        """Rate limiter is checked before processing."""
        from fastapi import HTTPException

        with patch("backend.main.streaming_rate_limiter.check", new_callable=AsyncMock) as mock_check:
            mock_check.side_effect = HTTPException(status_code=429, detail="Rate limit exceeded")

            response = client.post(
                "/api/conversations/conv-123/message",
                json={"content": "test"},
                headers=auth_headers
            )

        assert response.status_code == 429
