"""
API tests for conversation endpoints.

Tests conversation creation, listing, retrieval, and deletion.
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


class TestCreateConversationEndpoint:
    """Tests for POST /api/conversations endpoint."""

    @pytest.mark.asyncio
    async def test_create_conversation_success(self, auth_headers):
        """Successfully creates a new conversation."""
        conv_id = str(uuid4())
        with patch("backend.main.storage") as mock_storage:
            mock_storage.create_conversation = AsyncMock(return_value={
                "id": conv_id,
                "created_at": "2026-01-05T10:00:00Z",
                "title": "New Conversation",
                "messages": []
            })

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/conversations",
                    json={
                        "models": ["openai/gpt-5.1", "anthropic/claude-sonnet-4.5"],
                        "lead_model": "google/gemini-3-pro-preview"
                    },
                    headers=auth_headers,
                )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == conv_id
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_conversation_with_defaults(self, auth_headers):
        """Creates conversation with default models if not specified."""
        conv_id = str(uuid4())
        with patch("backend.main.storage") as mock_storage:
            mock_storage.create_conversation = AsyncMock(return_value={
                "id": conv_id,
                "created_at": "2026-01-05T10:00:00Z",
                "title": "New Conversation",
                "messages": []
            })

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/conversations",
                    json={},
                    headers=auth_headers,
                )

        assert response.status_code == 200
        # Verify storage was called (it will use defaults from config)
        mock_storage.create_conversation.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_conversation_requires_auth(self):
        """Returns 401 without authentication."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/conversations",
                json={"models": ["openai/gpt-5.1"]},
            )

        assert response.status_code == 401


class TestListConversationsEndpoint:
    """Tests for GET /api/conversations endpoint."""

    @pytest.mark.asyncio
    async def test_list_conversations_success(self, auth_headers):
        """Returns list of conversations."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.list_conversations = AsyncMock(return_value=[
                {
                    "id": "conv-1",
                    "title": "Test Conversation 1",
                    "created_at": "2026-01-05T10:00:00Z",
                    "message_count": 2
                },
                {
                    "id": "conv-2",
                    "title": "Test Conversation 2",
                    "created_at": "2026-01-05T11:00:00Z",
                    "message_count": 4
                }
            ])

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/conversations", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["title"] == "Test Conversation 1"
        assert data[0]["message_count"] == 2

    @pytest.mark.asyncio
    async def test_list_conversations_empty(self, auth_headers):
        """Returns empty list when no conversations."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.list_conversations = AsyncMock(return_value=[])

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/conversations", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data == []

    @pytest.mark.asyncio
    async def test_list_conversations_requires_auth(self):
        """Returns 401 without authentication."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/conversations")

        assert response.status_code == 401


class TestGetConversationEndpoint:
    """Tests for GET /api/conversations/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_conversation_success(self, auth_headers):
        """Returns specific conversation."""
        conv_id = str(uuid4())
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_conversation = AsyncMock(return_value={
                "id": conv_id,
                "title": "Test Conversation",
                "messages": [
                    {"role": "user", "content": "Hello"}
                ],
                "created_at": "2026-01-05T10:00:00Z"
            })

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get(f"/api/conversations/{conv_id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == conv_id
        assert data["title"] == "Test Conversation"

    @pytest.mark.asyncio
    async def test_get_conversation_not_found(self, auth_headers):
        """Returns 404 when conversation not found."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.get_conversation = AsyncMock(return_value=None)

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/conversations/nonexistent", headers=auth_headers)

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_conversation_requires_auth(self):
        """Returns 401 without authentication."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/conversations/some-id")

        assert response.status_code == 401


class TestDeleteConversationEndpoint:
    """Tests for DELETE /api/conversations/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_conversation_success(self, auth_headers):
        """Successfully deletes a conversation."""
        conv_id = str(uuid4())
        with patch("backend.main.storage") as mock_storage:
            mock_storage.delete_conversation = AsyncMock(return_value=True)

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.delete(f"/api/conversations/{conv_id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_delete_conversation_not_found(self, auth_headers):
        """Returns 404 when conversation not found or not owned."""
        with patch("backend.main.storage") as mock_storage:
            mock_storage.delete_conversation = AsyncMock(return_value=False)

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.delete("/api/conversations/nonexistent", headers=auth_headers)

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_conversation_requires_auth(self):
        """Returns 401 without authentication."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.delete("/api/conversations/some-id")

        assert response.status_code == 401
