"""
Integration tests for OpenRouter API client.

Uses respx to mock httpx calls to OpenRouter endpoints.
Tests query_model, parallel queries, retry logic, and cost retrieval.
"""
import pytest
import respx
from httpx import Response
from unittest.mock import patch, AsyncMock

from backend.openrouter import (
    query_model,
    query_models_parallel,
    get_generation_cost,
    get_generation_costs_batch,
    validate_api_key,
    close_client,
    OPENROUTER_API_URL,
    OPENROUTER_GENERATION_API_URL,
)


@pytest.fixture(autouse=True)
async def reset_client():
    """Reset the shared HTTP client after each test."""
    yield
    await close_client()


class TestQueryModel:
    """Tests for query_model function."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_query_model_success(self):
        """Successfully queries model and returns response."""
        respx.post(OPENROUTER_API_URL).mock(
            return_value=Response(200, json={
                "choices": [{"message": {"content": "Hello, world!"}}],
                "id": "gen-abc123"
            })
        )

        result = await query_model(
            "openai/gpt-4",
            [{"role": "user", "content": "Hi"}],
            api_key="test-key"
        )

        assert result is not None
        assert result["content"] == "Hello, world!"
        assert result["generation_id"] == "gen-abc123"

    @respx.mock
    @pytest.mark.asyncio
    async def test_query_model_includes_generation_id(self):
        """Response includes generation_id for cost lookup."""
        respx.post(OPENROUTER_API_URL).mock(
            return_value=Response(200, json={
                "choices": [{"message": {"content": "Test"}}],
                "id": "gen-xyz789"
            })
        )

        result = await query_model(
            "openai/gpt-4",
            [{"role": "user", "content": "test"}],
            api_key="test-key"
        )

        assert result["generation_id"] == "gen-xyz789"

    @respx.mock
    @pytest.mark.asyncio
    async def test_query_model_includes_reasoning_details(self):
        """Response includes reasoning_details if present."""
        respx.post(OPENROUTER_API_URL).mock(
            return_value=Response(200, json={
                "choices": [{
                    "message": {
                        "content": "Answer",
                        "reasoning_details": {"steps": ["think", "answer"]}
                    }
                }],
                "id": "gen-123"
            })
        )

        result = await query_model(
            "openai/o1",
            [{"role": "user", "content": "test"}],
            api_key="test-key"
        )

        assert result["reasoning_details"] == {"steps": ["think", "answer"]}

    @respx.mock
    @pytest.mark.asyncio
    async def test_query_model_rate_limit_retry(self):
        """Retries on 429 rate limit with exponential backoff."""
        route = respx.post(OPENROUTER_API_URL)
        route.side_effect = [
            Response(429, json={"error": "rate limited"}),
            Response(200, json={
                "choices": [{"message": {"content": "OK"}}],
                "id": "gen-retry"
            })
        ]

        result = await query_model(
            "openai/gpt-4",
            [{"role": "user", "content": "test"}],
            api_key="test-key"
        )

        assert result is not None
        assert result["content"] == "OK"
        assert route.call_count == 2

    @respx.mock
    @pytest.mark.asyncio
    async def test_query_model_server_error_retry(self):
        """Retries on 5xx server errors."""
        route = respx.post(OPENROUTER_API_URL)
        route.side_effect = [
            Response(503, json={"error": "service unavailable"}),
            Response(502, json={"error": "bad gateway"}),
            Response(200, json={
                "choices": [{"message": {"content": "Finally!"}}],
                "id": "gen-503"
            })
        ]

        result = await query_model(
            "openai/gpt-4",
            [{"role": "user", "content": "test"}],
            api_key="test-key"
        )

        assert result is not None
        assert result["content"] == "Finally!"
        assert route.call_count == 3

    @respx.mock
    @pytest.mark.asyncio
    async def test_query_model_max_retries_exhausted(self):
        """Returns None when max retries exhausted."""
        respx.post(OPENROUTER_API_URL).mock(
            return_value=Response(429, json={"error": "rate limited"})
        )

        result = await query_model(
            "openai/gpt-4",
            [{"role": "user", "content": "test"}],
            api_key="test-key"
        )

        assert result is None

    @respx.mock
    @pytest.mark.asyncio
    async def test_query_model_non_retryable_error(self):
        """Returns None on non-retryable HTTP errors (e.g., 400, 401)."""
        respx.post(OPENROUTER_API_URL).mock(
            return_value=Response(401, json={"error": "unauthorized"})
        )

        result = await query_model(
            "openai/gpt-4",
            [{"role": "user", "content": "test"}],
            api_key="bad-key"
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_query_model_no_api_key(self):
        """Returns None when no API key provided."""
        with patch("backend.openrouter.OPENROUTER_API_KEY", None):
            result = await query_model(
                "openai/gpt-4",
                [{"role": "user", "content": "test"}],
                api_key=None  # No key
            )

        assert result is None


class TestQueryModelsParallel:
    """Tests for query_models_parallel function."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_parallel_queries_all_succeed(self):
        """All parallel queries succeed."""
        respx.post(OPENROUTER_API_URL).mock(
            return_value=Response(200, json={
                "choices": [{"message": {"content": "Response"}}],
                "id": "gen-parallel"
            })
        )

        models = ["openai/gpt-4", "anthropic/claude-3", "google/gemini"]
        results = await query_models_parallel(
            models,
            [{"role": "user", "content": "test"}],
            api_key="test-key"
        )

        assert len(results) == 3
        for model in models:
            assert model in results
            assert results[model] is not None

    @respx.mock
    @pytest.mark.asyncio
    async def test_parallel_queries_partial_failure(self):
        """Some queries fail permanently (non-retryable), others succeed."""
        call_count = 0

        def response_callback(request):
            nonlocal call_count
            call_count += 1
            # Use 401 (non-retryable) for consistent failure
            if call_count == 2:
                return Response(401, json={"error": "unauthorized"})
            return Response(200, json={
                "choices": [{"message": {"content": "OK"}}],
                "id": f"gen-{call_count}"
            })

        respx.post(OPENROUTER_API_URL).mock(side_effect=response_callback)

        models = ["model1", "model2", "model3"]
        results = await query_models_parallel(
            models,
            [{"role": "user", "content": "test"}],
            api_key="test-key"
        )

        # model2 failed (401 unauthorized), others succeeded
        assert results["model1"] is not None
        assert results["model2"] is None  # Failed with non-retryable error
        assert results["model3"] is not None


class TestGetGenerationCost:
    """Tests for get_generation_cost function."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_get_cost_success(self):
        """Successfully retrieves generation cost."""
        respx.get(f"{OPENROUTER_GENERATION_API_URL}?id=gen-123").mock(
            return_value=Response(200, json={
                "data": {
                    "total_cost": 0.0025,
                    "native_tokens_prompt": 100,
                    "native_tokens_completion": 50,
                    "model": "openai/gpt-4",
                    "cache_discount": 0.0
                }
            })
        )

        result = await get_generation_cost("gen-123", api_key="test-key")

        assert result is not None
        assert result["total_cost"] == 0.0025
        assert result["native_tokens_prompt"] == 100
        assert result["native_tokens_completion"] == 50
        assert result["model"] == "openai/gpt-4"

    @respx.mock
    @pytest.mark.asyncio
    async def test_get_cost_retries_on_404(self):
        """Retries when generation not found (not ready yet)."""
        route = respx.get(f"{OPENROUTER_GENERATION_API_URL}?id=gen-456")
        route.side_effect = [
            Response(404, json={"error": "not found"}),
            Response(200, json={
                "data": {"total_cost": 0.001}
            })
        ]

        result = await get_generation_cost("gen-456", api_key="test-key")

        assert result is not None
        assert result["total_cost"] == 0.001
        assert route.call_count == 2

    @respx.mock
    @pytest.mark.asyncio
    async def test_get_cost_retries_on_null_cost(self):
        """Retries when cost is null (not calculated yet)."""
        route = respx.get(f"{OPENROUTER_GENERATION_API_URL}?id=gen-null")
        route.side_effect = [
            Response(200, json={"data": {"total_cost": None}}),
            Response(200, json={"data": {"total_cost": 0.005}})
        ]

        result = await get_generation_cost("gen-null", api_key="test-key")

        assert result is not None
        assert result["total_cost"] == 0.005

    @respx.mock
    @pytest.mark.asyncio
    async def test_get_cost_handles_null_values(self):
        """Handles null values in response gracefully."""
        respx.get(f"{OPENROUTER_GENERATION_API_URL}?id=gen-nulls").mock(
            return_value=Response(200, json={
                "data": {
                    "total_cost": 0.01,
                    "native_tokens_prompt": None,
                    "native_tokens_completion": None,
                    "model": "unknown",
                    "cache_discount": None
                }
            })
        )

        result = await get_generation_cost("gen-nulls", api_key="test-key")

        assert result["total_cost"] == 0.01
        assert result["native_tokens_prompt"] == 0  # null -> 0
        assert result["native_tokens_completion"] == 0
        assert result["cache_discount"] == 0.0

    @respx.mock
    @pytest.mark.asyncio
    async def test_get_cost_max_retries_exhausted(self):
        """Returns None when max retries exhausted."""
        respx.get(f"{OPENROUTER_GENERATION_API_URL}?id=gen-fail").mock(
            return_value=Response(404, json={"error": "not found"})
        )

        result = await get_generation_cost(
            "gen-fail",
            api_key="test-key",
            max_retries=2
        )

        assert result is None


class TestGetGenerationCostsBatch:
    """Tests for get_generation_costs_batch function."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_batch_costs_success(self):
        """Successfully retrieves costs for multiple generations."""
        respx.get(f"{OPENROUTER_GENERATION_API_URL}?id=gen-1").mock(
            return_value=Response(200, json={"data": {"total_cost": 0.01}})
        )
        respx.get(f"{OPENROUTER_GENERATION_API_URL}?id=gen-2").mock(
            return_value=Response(200, json={"data": {"total_cost": 0.02}})
        )

        results = await get_generation_costs_batch(
            ["gen-1", "gen-2"],
            api_key="test-key"
        )

        assert len(results) == 2
        assert results["gen-1"]["total_cost"] == 0.01
        assert results["gen-2"]["total_cost"] == 0.02

    @respx.mock
    @pytest.mark.asyncio
    async def test_batch_costs_partial_failure(self):
        """Handles partial failures in batch."""
        respx.get(f"{OPENROUTER_GENERATION_API_URL}?id=gen-ok").mock(
            return_value=Response(200, json={"data": {"total_cost": 0.01}})
        )
        respx.get(f"{OPENROUTER_GENERATION_API_URL}?id=gen-fail").mock(
            return_value=Response(500, json={"error": "server error"})
        )

        results = await get_generation_costs_batch(
            ["gen-ok", "gen-fail"],
            api_key="test-key"
        )

        assert "gen-ok" in results
        assert "gen-fail" not in results  # Failed, not included

    @pytest.mark.asyncio
    async def test_batch_costs_empty_list(self):
        """Returns empty dict for empty input."""
        results = await get_generation_costs_batch([], api_key="test-key")
        assert results == {}


class TestValidateApiKey:
    """Tests for validate_api_key function."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_validate_valid_key(self):
        """Valid key returns (True, '')."""
        respx.get("https://openrouter.ai/api/v1/models").mock(
            return_value=Response(200, json={"data": []})
        )

        is_valid, error = await validate_api_key("sk-or-valid-key")

        assert is_valid is True
        assert error == ""

    @respx.mock
    @pytest.mark.asyncio
    async def test_validate_invalid_key(self):
        """Invalid key (401) returns (False, error)."""
        respx.get("https://openrouter.ai/api/v1/models").mock(
            return_value=Response(401, json={"error": "unauthorized"})
        )

        is_valid, error = await validate_api_key("sk-or-invalid")

        assert is_valid is False
        assert "Invalid" in error

    @respx.mock
    @pytest.mark.asyncio
    async def test_validate_forbidden_key(self):
        """Forbidden key (403) returns (False, error)."""
        respx.get("https://openrouter.ai/api/v1/models").mock(
            return_value=Response(403, json={"error": "forbidden"})
        )

        is_valid, error = await validate_api_key("sk-or-forbidden")

        assert is_valid is False
        assert "permission" in error.lower()

    @pytest.mark.asyncio
    async def test_validate_empty_key(self):
        """Empty key returns (False, error)."""
        is_valid, error = await validate_api_key("")

        assert is_valid is False
        assert "required" in error.lower()
