"""
API tests for models endpoint.

Tests model listing and defaults.
"""
import pytest
from uuid import uuid4
from httpx import AsyncClient, ASGITransport

from backend.main import app


@pytest.fixture
def auth_headers():
    """Create valid auth headers for API tests."""
    from backend.auth_jwt import create_access_token
    token = create_access_token(user_id=uuid4())
    return {"Authorization": f"Bearer {token}"}


class TestModelsEndpoint:
    """Tests for GET /api/models endpoint."""

    @pytest.mark.asyncio
    async def test_get_models_returns_list(self, auth_headers):
        """Returns available models list."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/models", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert isinstance(data["models"], list)
        assert len(data["models"]) > 0

    @pytest.mark.asyncio
    async def test_get_models_returns_defaults(self, auth_headers):
        """Returns default model selections."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/models", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "default_models" in data
        assert "default_lead_model" in data
        assert isinstance(data["default_models"], list)
        assert len(data["default_models"]) >= 2

    @pytest.mark.asyncio
    async def test_get_models_contains_expected_providers(self, auth_headers):
        """Returns models from expected providers."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/models", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        models = data["models"]

        # Check that models include expected providers
        providers = set(m.split("/")[0] for m in models if "/" in m)
        # At least one of these should be present
        expected_providers = {"openai", "anthropic", "google", "x-ai"}
        assert len(providers & expected_providers) > 0

    @pytest.mark.asyncio
    async def test_get_models_requires_auth(self):
        """Models endpoint requires authentication."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/models")

        # Should return 401 without auth headers
        assert response.status_code == 401
