"""
Integration tests for OpenRouter Provisioning API.

Uses respx to mock httpx calls to the provisioning endpoints.
Tests user key creation, limit updates, and key management.
"""
import pytest
import respx
from httpx import Response
from unittest.mock import patch

from backend.openrouter_provisioning import (
    create_user_key,
    update_key_limit,
    get_key_info,
    disable_key,
    enable_key,
    delete_key,
    is_provisioning_configured,
    close_client,
    PROVISIONING_BASE_URL,
)


@pytest.fixture(autouse=True)
async def reset_client():
    """Reset the shared HTTP client after each test."""
    yield
    await close_client()


class TestProvisioningConfiguration:
    """Tests for provisioning configuration checks."""

    def test_is_configured_with_key(self):
        """Returns True when provisioning key is set."""
        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-123"):
            assert is_provisioning_configured() is True

    def test_is_configured_without_key(self):
        """Returns False when provisioning key is not set."""
        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", None):
            assert is_provisioning_configured() is False


class TestCreateUserKey:
    """Tests for create_user_key function."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_create_key_success(self):
        """Successfully creates a user key."""
        respx.post(PROVISIONING_BASE_URL).mock(
            return_value=Response(200, json={
                "data": {
                    "hash": "key-hash-abc123",
                    "limit": 5.0,
                    "usage": 0,
                    "disabled": False
                },
                "key": "sk-or-v1-user-key-here"
            })
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            result = await create_user_key(
                user_id="user-123",
                name="Test User",
                limit_dollars=5.0
            )

        assert result["key"] == "sk-or-v1-user-key-here"
        assert result["hash"] == "key-hash-abc123"
        assert result["limit"] == 5.0

    @respx.mock
    @pytest.mark.asyncio
    async def test_create_key_includes_user_id_in_name(self):
        """Key name includes user ID for identification."""
        route = respx.post(PROVISIONING_BASE_URL).mock(
            return_value=Response(200, json={
                "data": {"hash": "hash123", "limit": 2.0},
                "key": "sk-or-v1-key"
            })
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            await create_user_key(
                user_id="user-456",
                name="John Doe",
                limit_dollars=2.0
            )

        # Check that request body contains user ID in name
        request = route.calls[0].request
        import json
        body = json.loads(request.content)
        assert "user:user-456" in body["name"]

    @respx.mock
    @pytest.mark.asyncio
    async def test_create_key_missing_key_in_response(self):
        """Raises error when API doesn't return a key."""
        respx.post(PROVISIONING_BASE_URL).mock(
            return_value=Response(200, json={
                "data": {"hash": "hash123", "limit": 5.0}
                # Missing "key" field
            })
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            with pytest.raises(ValueError, match="did not return a key"):
                await create_user_key(
                    user_id="user-123",
                    name="Test",
                    limit_dollars=5.0
                )

    @respx.mock
    @pytest.mark.asyncio
    async def test_create_key_missing_hash_in_response(self):
        """Raises error when API doesn't return a hash."""
        respx.post(PROVISIONING_BASE_URL).mock(
            return_value=Response(200, json={
                "data": {"limit": 5.0},  # Missing "hash" field
                "key": "sk-or-v1-key"
            })
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            with pytest.raises(ValueError, match="did not return a hash"):
                await create_user_key(
                    user_id="user-123",
                    name="Test",
                    limit_dollars=5.0
                )

    @pytest.mark.asyncio
    async def test_create_key_not_configured(self):
        """Raises error when provisioning not configured."""
        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", None):
            with pytest.raises(RuntimeError, match="not configured"):
                await create_user_key(
                    user_id="user-123",
                    name="Test",
                    limit_dollars=5.0
                )

    @respx.mock
    @pytest.mark.asyncio
    async def test_create_key_api_error(self):
        """Propagates HTTP errors from API."""
        respx.post(PROVISIONING_BASE_URL).mock(
            return_value=Response(400, json={"error": "Bad request"})
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            with pytest.raises(Exception):  # HTTPStatusError
                await create_user_key(
                    user_id="user-123",
                    name="Test",
                    limit_dollars=5.0
                )


class TestUpdateKeyLimit:
    """Tests for update_key_limit function."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_update_limit_success(self):
        """Successfully updates key limit."""
        respx.patch(f"{PROVISIONING_BASE_URL}/key-hash-123").mock(
            return_value=Response(200, json={
                "data": {
                    "hash": "key-hash-123",
                    "limit": 10.0,
                    "usage": 2.5
                }
            })
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            result = await update_key_limit("key-hash-123", 10.0)

        assert result["limit"] == 10.0

    @respx.mock
    @pytest.mark.asyncio
    async def test_update_limit_sends_correct_payload(self):
        """Sends correct limit value in request."""
        route = respx.patch(f"{PROVISIONING_BASE_URL}/key-hash-456").mock(
            return_value=Response(200, json={"data": {"limit": 15.0}})
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            await update_key_limit("key-hash-456", 15.0)

        import json
        body = json.loads(route.calls[0].request.content)
        assert body["limit"] == 15.0

    @pytest.mark.asyncio
    async def test_update_limit_not_configured(self):
        """Raises error when not configured."""
        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", None):
            with pytest.raises(RuntimeError, match="not configured"):
                await update_key_limit("key-hash", 10.0)


class TestGetKeyInfo:
    """Tests for get_key_info function."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_get_info_success(self):
        """Successfully retrieves key information."""
        respx.get(f"{PROVISIONING_BASE_URL}/key-hash-789").mock(
            return_value=Response(200, json={
                "data": {
                    "hash": "key-hash-789",
                    "name": "Test User (user:123)",
                    "limit": 5.0,
                    "usage": 1.25,
                    "disabled": False,
                    "created_at": "2026-01-01T00:00:00Z"
                }
            })
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            result = await get_key_info("key-hash-789")

        assert result["hash"] == "key-hash-789"
        assert result["limit"] == 5.0
        assert result["usage"] == 1.25
        assert result["disabled"] is False

    @respx.mock
    @pytest.mark.asyncio
    async def test_get_info_not_found(self):
        """Raises error when key not found."""
        respx.get(f"{PROVISIONING_BASE_URL}/nonexistent").mock(
            return_value=Response(404, json={"error": "Key not found"})
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            with pytest.raises(Exception):  # HTTPStatusError
                await get_key_info("nonexistent")


class TestDisableKey:
    """Tests for disable_key function."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_disable_key_success(self):
        """Successfully disables a key."""
        route = respx.patch(f"{PROVISIONING_BASE_URL}/key-to-disable").mock(
            return_value=Response(200, json={
                "data": {"hash": "key-to-disable", "disabled": True}
            })
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            await disable_key("key-to-disable")

        import json
        body = json.loads(route.calls[0].request.content)
        assert body["disabled"] is True

    @pytest.mark.asyncio
    async def test_disable_key_not_configured(self):
        """Raises error when not configured."""
        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", None):
            with pytest.raises(RuntimeError, match="not configured"):
                await disable_key("key-hash")


class TestEnableKey:
    """Tests for enable_key function."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_enable_key_success(self):
        """Successfully enables a key."""
        route = respx.patch(f"{PROVISIONING_BASE_URL}/key-to-enable").mock(
            return_value=Response(200, json={
                "data": {"hash": "key-to-enable", "disabled": False}
            })
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            await enable_key("key-to-enable")

        import json
        body = json.loads(route.calls[0].request.content)
        assert body["disabled"] is False


class TestDeleteKey:
    """Tests for delete_key function."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_delete_key_success(self):
        """Successfully deletes a key."""
        route = respx.delete(f"{PROVISIONING_BASE_URL}/key-to-delete").mock(
            return_value=Response(200, json={"success": True})
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            await delete_key("key-to-delete")

        assert route.call_count == 1

    @respx.mock
    @pytest.mark.asyncio
    async def test_delete_key_not_found(self):
        """Raises error when key to delete not found."""
        respx.delete(f"{PROVISIONING_BASE_URL}/nonexistent").mock(
            return_value=Response(404, json={"error": "Key not found"})
        )

        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", "sk-or-prov-test"):
            with pytest.raises(Exception):  # HTTPStatusError
                await delete_key("nonexistent")

    @pytest.mark.asyncio
    async def test_delete_key_not_configured(self):
        """Raises error when not configured."""
        with patch("backend.openrouter_provisioning.OPENROUTER_PROVISIONING_KEY", None):
            with pytest.raises(RuntimeError, match="not configured"):
                await delete_key("key-hash")
