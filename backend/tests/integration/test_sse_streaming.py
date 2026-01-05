"""
Integration tests for SSE streaming endpoint.

Tests event ordering, keepalive behavior, error handling, and client disconnection.
"""
import pytest
import json
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from httpx import AsyncClient, ASGITransport

from backend.main import app


# Use actual models from config to avoid validation errors
from backend.config import AVAILABLE_MODELS, DEFAULT_LEAD_MODEL

# Mock data for stages
MOCK_STAGE1_RESULTS = [
    {"model": AVAILABLE_MODELS[0], "response": "Response from model 1"},
    {"model": AVAILABLE_MODELS[1], "response": "Response from model 2"},
]
MOCK_STAGE1_IDS = ["gen-1", "gen-2"]

MOCK_STAGE2_RESULTS = [
    {"model": AVAILABLE_MODELS[0], "ranking": "FINAL RANKING:\n1. Response B\n2. Response A"},
    {"model": AVAILABLE_MODELS[1], "ranking": "FINAL RANKING:\n1. Response A\n2. Response B"},
]
MOCK_LABEL_TO_MODEL = {"Response A": AVAILABLE_MODELS[0], "Response B": AVAILABLE_MODELS[1]}
MOCK_STAGE2_IDS = ["gen-3", "gen-4"]

MOCK_STAGE3_RESULT = {"content": "Final synthesized answer"}
MOCK_STAGE3_ID = "gen-5"

MOCK_COSTS = {
    "gen-1": {"model": AVAILABLE_MODELS[0], "total_cost": 0.01},
    "gen-2": {"model": AVAILABLE_MODELS[1], "total_cost": 0.008},
    "gen-3": {"model": AVAILABLE_MODELS[0], "total_cost": 0.005},
    "gen-4": {"model": AVAILABLE_MODELS[1], "total_cost": 0.004},
    "gen-5": {"model": DEFAULT_LEAD_MODEL, "total_cost": 0.003},
}


@pytest.fixture
def auth_headers():
    """Create valid auth headers for API tests."""
    from backend.auth_jwt import create_access_token
    token = create_access_token(user_id=uuid4())
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_storage():
    """Mock storage module for streaming tests."""
    with patch("backend.main.storage") as mock:
        mock.get_conversation = AsyncMock(return_value={
            "id": "conv-123",
            "user_id": None,
            "messages": [],
            "models": list(AVAILABLE_MODELS[:2]),
            "lead_model": DEFAULT_LEAD_MODEL
        })
        mock.add_user_message = AsyncMock(return_value=0)
        mock.add_assistant_message = AsyncMock()
        mock.update_conversation_title = AsyncMock()
        mock.get_effective_api_key = AsyncMock(return_value=("sk-test-key", "credits"))
        mock.check_minimum_balance = AsyncMock(return_value=True)
        mock.deduct_query_cost = AsyncMock(return_value=(True, 4.95))
        yield mock


@pytest.fixture
def mock_stage_functions():
    """Mock the stage collection functions."""
    with patch("backend.main.stage1_collect_responses") as mock_s1, \
         patch("backend.main.stage2_collect_rankings") as mock_s2, \
         patch("backend.main.stage3_synthesize_final") as mock_s3, \
         patch("backend.main.get_generation_costs_batch") as mock_costs, \
         patch("backend.main.generate_conversation_title") as mock_title:

        mock_s1.return_value = (MOCK_STAGE1_RESULTS, MOCK_STAGE1_IDS)
        mock_s2.return_value = (MOCK_STAGE2_RESULTS, MOCK_LABEL_TO_MODEL, MOCK_STAGE2_IDS)
        mock_s3.return_value = (MOCK_STAGE3_RESULT, MOCK_STAGE3_ID)
        mock_costs.return_value = MOCK_COSTS
        mock_title.return_value = ("Generated Title", "gen-title")

        yield {
            "stage1": mock_s1,
            "stage2": mock_s2,
            "stage3": mock_s3,
            "costs": mock_costs,
            "title": mock_title,
        }


def parse_sse_content(content: str) -> list:
    """Parse SSE events from raw content string."""
    events = []
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("data: "):
            data = line[6:]  # Remove "data: " prefix
            try:
                events.append(json.loads(data))
            except json.JSONDecodeError:
                pass  # Skip malformed events
        elif line == ":":
            # Keepalive ping (SSE comment)
            events.append({"type": "keepalive"})
    return events


async def collect_sse_events(response) -> list:
    """Collect all SSE events from response."""
    # Read the full content
    content = response.text
    return parse_sse_content(content)


class TestSSEEventOrdering:
    """Tests for SSE event ordering."""

    @pytest.mark.asyncio
    async def test_events_in_correct_order(self, auth_headers, mock_storage, mock_stage_functions):
        """Events are emitted in correct order: stage1_start -> stage1_complete -> etc."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/conversations/conv-123/message/stream",
                json={"content": "Test question"},
                headers=auth_headers,
            )

            events = await collect_sse_events(response)

        # Filter out keepalives
        stage_events = [e for e in events if e.get("type") != "keepalive"]

        # Verify order
        event_types = [e["type"] for e in stage_events]
        expected_order = [
            "stage1_start",
            "stage1_complete",
            "stage2_start",
            "stage2_complete",
            "stage3_start",
            "stage3_complete",
            "title_complete",
            "complete",
        ]
        assert event_types == expected_order

    @pytest.mark.asyncio
    async def test_stage1_complete_has_data(self, auth_headers, mock_storage, mock_stage_functions):
        """stage1_complete event contains response data."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/conversations/conv-123/message/stream",
                json={"content": "Test question"},
                headers=auth_headers,
            )

            events = await collect_sse_events(response)

        stage1_complete = next(e for e in events if e.get("type") == "stage1_complete")
        assert "data" in stage1_complete
        assert len(stage1_complete["data"]) == 2
        assert stage1_complete["data"][0]["model"] == AVAILABLE_MODELS[0]

    @pytest.mark.asyncio
    async def test_stage2_complete_has_metadata(self, auth_headers, mock_storage, mock_stage_functions):
        """stage2_complete event contains rankings and metadata."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/conversations/conv-123/message/stream",
                json={"content": "Test question"},
                headers=auth_headers,
            )

            events = await collect_sse_events(response)

        stage2_complete = next(e for e in events if e.get("type") == "stage2_complete")
        assert "data" in stage2_complete
        assert "metadata" in stage2_complete
        assert "label_to_model" in stage2_complete["metadata"]
        assert "aggregate_rankings" in stage2_complete["metadata"]

    @pytest.mark.asyncio
    async def test_complete_event_has_cost_breakdown(self, auth_headers, mock_storage, mock_stage_functions):
        """complete event contains cost breakdown for credits mode."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/conversations/conv-123/message/stream",
                json={"content": "Test question"},
                headers=auth_headers,
            )

            events = await collect_sse_events(response)

        complete_event = next(e for e in events if e.get("type") == "complete")
        assert "cost" in complete_event
        assert "openrouter_cost" in complete_event["cost"]
        assert "margin_cost" in complete_event["cost"]
        assert "total_cost" in complete_event["cost"]
        assert "new_balance" in complete_event["cost"]


class TestSSEBYOKMode:
    """Tests for BYOK (Bring Your Own Key) mode streaming."""

    @pytest.mark.asyncio
    async def test_byok_mode_no_cost_tracking(self, auth_headers, mock_stage_functions):
        """BYOK mode doesn't include cost breakdown."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_conversation = AsyncMock(return_value={
                "id": "conv-123",
                "messages": [],
                "models": list(AVAILABLE_MODELS[:2]),
                "lead_model": DEFAULT_LEAD_MODEL
            })
            mock_storage.add_user_message = AsyncMock(return_value=0)
            mock_storage.add_assistant_message = AsyncMock()
            mock_storage.update_conversation_title = AsyncMock()
            # BYOK mode
            mock_storage.get_effective_api_key = AsyncMock(return_value=("sk-user-key", "byok"))

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/conversations/conv-123/message/stream",
                    json={"content": "Test question"},
                    headers=auth_headers,
                )

                events = await collect_sse_events(response)

        complete_event = next(e for e in events if e.get("type") == "complete")
        assert "mode" in complete_event
        assert complete_event["mode"] == "byok"
        assert "cost" not in complete_event


class TestSSEErrorHandling:
    """Tests for SSE error handling."""

    @pytest.mark.asyncio
    async def test_error_event_on_stage_failure(self, auth_headers, mock_storage):
        """Error event is sent when a stage fails."""
        with patch("backend.main.stage1_collect_responses") as mock_s1:
            mock_s1.side_effect = Exception("OpenRouter API error")

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/conversations/conv-123/message/stream",
                    json={"content": "Test question"},
                    headers=auth_headers,
                )

                events = await collect_sse_events(response)

        # Should have stage1_start then error
        event_types = [e["type"] for e in events if e.get("type") != "keepalive"]
        assert "stage1_start" in event_types
        assert "error" in event_types

        error_event = next(e for e in events if e.get("type") == "error")
        assert "message" in error_event
        assert "No charge" in error_event["message"]

    @pytest.mark.asyncio
    async def test_no_api_key_returns_402(self, auth_headers):
        """Returns 402 when no API key available."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_conversation = AsyncMock(return_value={
                "id": "conv-123",
                "messages": [],
                "models": [AVAILABLE_MODELS[0]],
                "lead_model": DEFAULT_LEAD_MODEL
            })
            mock_storage.get_effective_api_key = AsyncMock(return_value=(None, None))

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/conversations/conv-123/message/stream",
                    json={"content": "Test question"},
                    headers=auth_headers,
                )

        assert response.status_code == 402

    @pytest.mark.asyncio
    async def test_insufficient_balance_returns_402(self, auth_headers):
        """Returns 402 when balance is insufficient."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_conversation = AsyncMock(return_value={
                "id": "conv-123",
                "messages": [],
                "models": [AVAILABLE_MODELS[0]],
                "lead_model": DEFAULT_LEAD_MODEL
            })
            mock_storage.get_effective_api_key = AsyncMock(return_value=("sk-key", "credits"))
            mock_storage.check_minimum_balance = AsyncMock(return_value=False)

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/conversations/conv-123/message/stream",
                    json={"content": "Test question"},
                    headers=auth_headers,
                )

        assert response.status_code == 402
        assert "Insufficient balance" in response.json()["detail"]


class TestSSEConversationValidation:
    """Tests for conversation validation in streaming."""

    @pytest.mark.asyncio
    async def test_conversation_not_found_returns_404(self, auth_headers):
        """Returns 404 when conversation doesn't exist."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_conversation = AsyncMock(return_value=None)

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/conversations/nonexistent/message/stream",
                    json={"content": "Test question"},
                    headers=auth_headers,
                )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_requires_authentication(self):
        """Returns 401 without authentication."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/conversations/conv-123/message/stream",
                json={"content": "Test question"},
            )

        assert response.status_code == 401


class TestSSERateLimiting:
    """Tests for rate limiting on streaming endpoint."""

    @pytest.mark.asyncio
    async def test_rate_limit_exceeded_returns_429(self, auth_headers, mock_storage, mock_stage_functions):
        """Returns 429 when rate limit is exceeded."""
        # Create a fresh rate limiter that we can exhaust
        from backend.rate_limit import RateLimiter

        test_limiter = RateLimiter(requests_per_minute=2)

        with patch("backend.main.streaming_rate_limiter", test_limiter):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Make 2 successful requests
                for _ in range(2):
                    response = await client.post(
                        "/api/conversations/conv-123/message/stream",
                        json={"content": "Test question"},
                        headers=auth_headers,
                    )
                    # Consume the stream to complete the request
                    async for _ in response.aiter_bytes():
                        pass

                # Third request should be rate limited
                response = await client.post(
                    "/api/conversations/conv-123/message/stream",
                    json={"content": "Test question"},
                    headers=auth_headers,
                )

        assert response.status_code == 429


class TestSSETitleGeneration:
    """Tests for title generation in streaming."""

    @pytest.mark.asyncio
    async def test_title_generated_for_first_message(self, auth_headers, mock_storage, mock_stage_functions):
        """Title is generated for first message in conversation."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/conversations/conv-123/message/stream",
                json={"content": "Test question"},
                headers=auth_headers,
            )

            events = await collect_sse_events(response)

        # Title generation should be called
        mock_stage_functions["title"].assert_called_once()

        # title_complete event should be present
        title_event = next((e for e in events if e.get("type") == "title_complete"), None)
        assert title_event is not None
        assert title_event["data"]["title"] == "Generated Title"

    @pytest.mark.asyncio
    async def test_no_title_for_subsequent_messages(self, auth_headers, mock_stage_functions):
        """Title is not generated for subsequent messages."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_conversation = AsyncMock(return_value={
                "id": "conv-123",
                "messages": [{"role": "user", "content": "Previous"}],  # Has messages
                "models": [AVAILABLE_MODELS[0]],
                "lead_model": DEFAULT_LEAD_MODEL
            })
            mock_storage.add_user_message = AsyncMock(return_value=1)
            mock_storage.add_assistant_message = AsyncMock()
            mock_storage.get_effective_api_key = AsyncMock(return_value=("sk-key", "credits"))
            mock_storage.check_minimum_balance = AsyncMock(return_value=True)
            mock_storage.deduct_query_cost = AsyncMock(return_value=(True, 4.95))

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/conversations/conv-123/message/stream",
                    json={"content": "Second question"},
                    headers=auth_headers,
                )

                events = await collect_sse_events(response)

        # Title generation should NOT be called
        mock_stage_functions["title"].assert_not_called()

        # No title_complete event
        title_events = [e for e in events if e.get("type") == "title_complete"]
        assert len(title_events) == 0
