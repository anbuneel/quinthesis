"""
API tests for authentication endpoints.

Tests OAuth flow, token refresh, and user info endpoints.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from httpx import AsyncClient, ASGITransport

from backend.main import app


@pytest.fixture
def auth_headers():
    """Create valid auth headers for API tests."""
    from backend.auth_jwt import create_access_token
    token = create_access_token(user_id=uuid4())
    return {"Authorization": f"Bearer {token}"}


class TestOAuthStartEndpoint:
    """Tests for GET /api/auth/oauth/{provider} endpoint."""

    @pytest.mark.asyncio
    async def test_google_oauth_returns_authorization_url(self):
        """Returns Google OAuth authorization URL."""
        with patch("backend.main.create_oauth_state") as mock_create_state, \
             patch("backend.main.GoogleOAuth") as mock_google:
            mock_create_state.return_value = ("test-state", "test-code-challenge")
            mock_google.get_authorization_url.return_value = "https://accounts.google.com/o/oauth2/v2/auth?..."

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/auth/oauth/google")

        assert response.status_code == 200
        data = response.json()
        assert "authorization_url" in data
        assert "state" in data
        assert data["authorization_url"].startswith("https://accounts.google.com")

    @pytest.mark.asyncio
    async def test_github_oauth_returns_authorization_url(self):
        """Returns GitHub OAuth authorization URL."""
        with patch("backend.main.create_oauth_state") as mock_create_state, \
             patch("backend.main.GitHubOAuth") as mock_github:
            mock_create_state.return_value = ("test-state", "test-code-challenge")
            mock_github.get_authorization_url.return_value = "https://github.com/login/oauth/authorize?..."

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/auth/oauth/github")

        assert response.status_code == 200
        data = response.json()
        assert "authorization_url" in data
        assert data["authorization_url"].startswith("https://github.com")

    @pytest.mark.asyncio
    async def test_invalid_provider_returns_400(self):
        """Returns 400 for invalid OAuth provider."""
        with patch("backend.main.create_oauth_state") as mock_create_state:
            mock_create_state.return_value = ("test-state", "test-code-challenge")

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/auth/oauth/invalid-provider")

        assert response.status_code == 400


class TestOAuthCallbackEndpoint:
    """Tests for POST /api/auth/oauth/{provider}/callback endpoint."""

    @pytest.mark.asyncio
    async def test_callback_with_invalid_state_returns_400(self):
        """Returns 400 when state validation fails."""
        with patch("backend.main.validate_and_consume_state") as mock_validate, \
             patch("backend.main.api_rate_limiter") as mock_limiter:
            mock_validate.return_value = None  # State not found
            mock_limiter.check = AsyncMock()

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/auth/oauth/google/callback",
                    json={"code": "auth-code", "state": "invalid-state"},
                )

        assert response.status_code == 400
        assert "Invalid" in response.json()["detail"] or "state" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_callback_success_returns_tokens(self):
        """Returns JWT tokens on successful OAuth callback."""
        from backend.oauth import OAuthUser

        user_id = uuid4()
        mock_oauth_user = OAuthUser(
            provider="google",
            provider_id="google-123",
            email="user@example.com",
            name="Test User",
            avatar_url="https://example.com/avatar.jpg"
        )
        mock_user = {
            "id": user_id,
            "email": "user@example.com",
            "name": "Test User",
            "avatar_url": "https://example.com/avatar.jpg",
            "oauth_provider": "google",
            "created_at": "2026-01-01T00:00:00Z"
        }

        with patch("backend.main.validate_and_consume_state", new_callable=AsyncMock) as mock_validate, \
             patch("backend.main.GoogleOAuth") as mock_google, \
             patch("backend.main.storage") as mock_storage, \
             patch("backend.main.api_rate_limiter") as mock_limiter, \
             patch("backend.main.notifications") as mock_notifications:
            mock_validate.return_value = "pkce-verifier"
            mock_google.exchange_code = AsyncMock(return_value={"access_token": "oauth-token"})
            mock_google.get_user_info = AsyncMock(return_value=mock_oauth_user)
            mock_storage.get_user_by_oauth = AsyncMock(return_value=None)
            mock_storage.get_user_by_email = AsyncMock(return_value=None)
            mock_storage.create_oauth_user = AsyncMock(return_value=mock_user)
            mock_limiter.check = AsyncMock()
            mock_notifications.notify_new_signup = AsyncMock()

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/auth/oauth/google/callback",
                    json={"code": "valid-code", "state": "valid-state"},
                )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data


class TestRefreshTokenEndpoint:
    """Tests for POST /api/auth/refresh endpoint."""

    @pytest.mark.asyncio
    async def test_refresh_with_valid_token(self):
        """Returns new access token with valid refresh token."""
        from backend.auth_jwt import create_refresh_token
        user_id = uuid4()
        refresh_token = create_refresh_token(user_id=user_id)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/auth/refresh",
                json={"refresh_token": refresh_token},
            )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_refresh_with_invalid_token(self):
        """Returns 401 with invalid refresh token."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/auth/refresh",
                json={"refresh_token": "invalid-token"},
            )

        assert response.status_code == 401


class TestMeEndpoint:
    """Tests for GET /api/auth/me endpoint."""

    @pytest.mark.asyncio
    async def test_get_me_success(self, auth_headers):
        """Returns user info for authenticated user."""
        user_id = str(uuid4())
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_user_by_id = AsyncMock(return_value={
                "id": user_id,
                "email": "test@example.com",
                "name": "Test User",
                "avatar_url": "https://example.com/avatar.jpg",
                "oauth_provider": "google",
                "created_at": "2026-01-01T00:00:00Z"
            })

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/auth/me", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["oauth_provider"] == "google"

    @pytest.mark.asyncio
    async def test_get_me_requires_auth(self):
        """Returns 401 without authentication."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/auth/me")

        assert response.status_code == 401


class TestDeleteAccountEndpoint:
    """Tests for DELETE /api/auth/account endpoint."""

    @pytest.mark.asyncio
    async def test_delete_account_success(self, auth_headers):
        """Successfully deletes user account."""
        with patch("backend.main.storage") as mock_storage, \
             patch("backend.main.checkout_rate_limiter") as mock_limiter:
            mock_storage.delete_user_account = AsyncMock(return_value=(True, None))
            mock_limiter.check = AsyncMock()

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.delete("/api/auth/account", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "deleted" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_delete_account_requires_auth(self):
        """Returns 401 without authentication."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.delete("/api/auth/account")

        assert response.status_code == 401
