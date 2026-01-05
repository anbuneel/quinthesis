"""
Unit tests for backend.auth_jwt module.

Tests JWT token creation, verification, and FastAPI dependencies.
"""
import pytest
from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone
from freezegun import freeze_time
from fastapi import HTTPException

from backend.auth_jwt import (
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
    get_optional_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)


class TestCreateAccessToken:
    """Tests for create_access_token function."""

    def test_creates_valid_token(self):
        """Token can be decoded and contains correct user_id."""
        user_id = uuid4()
        token = create_access_token(user_id)

        # Verify the token is valid and returns the user_id
        result = verify_token(token, "access")
        assert result == user_id

    def test_token_type_is_access(self):
        """Token has type 'access' in payload."""
        user_id = uuid4()
        token = create_access_token(user_id)

        # Should work with access type
        verify_token(token, "access")

        # Should fail with refresh type
        with pytest.raises(HTTPException) as exc:
            verify_token(token, "refresh")
        assert exc.value.status_code == 401
        assert "Invalid token type" in exc.value.detail

    @freeze_time("2026-01-05 12:00:00")
    def test_expiration_time(self):
        """Token expires after ACCESS_TOKEN_EXPIRE_MINUTES."""
        user_id = uuid4()
        token = create_access_token(user_id)

        # Should be valid at creation time
        verify_token(token, "access")

        # Should be valid just before expiration
        with freeze_time(datetime(2026, 1, 5, 12, 0, 0, tzinfo=timezone.utc) +
                        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES - 1)):
            verify_token(token, "access")

        # Should be expired after expiration time
        with freeze_time(datetime(2026, 1, 5, 12, 0, 0, tzinfo=timezone.utc) +
                        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES + 1)):
            with pytest.raises(HTTPException) as exc:
                verify_token(token, "access")
            assert exc.value.status_code == 401
            assert "expired" in exc.value.detail.lower()


class TestCreateRefreshToken:
    """Tests for create_refresh_token function."""

    def test_creates_valid_token(self):
        """Token can be decoded and contains correct user_id."""
        user_id = uuid4()
        token = create_refresh_token(user_id)

        # Verify the token is valid and returns the user_id
        result = verify_token(token, "refresh")
        assert result == user_id

    def test_token_type_is_refresh(self):
        """Token has type 'refresh' in payload."""
        user_id = uuid4()
        token = create_refresh_token(user_id)

        # Should work with refresh type
        verify_token(token, "refresh")

        # Should fail with access type
        with pytest.raises(HTTPException) as exc:
            verify_token(token, "access")
        assert exc.value.status_code == 401
        assert "Invalid token type" in exc.value.detail

    @freeze_time("2026-01-05 12:00:00")
    def test_expiration_time(self):
        """Token expires after REFRESH_TOKEN_EXPIRE_DAYS."""
        user_id = uuid4()
        token = create_refresh_token(user_id)

        # Should be valid at creation time
        verify_token(token, "refresh")

        # Should be valid just before expiration
        with freeze_time(datetime(2026, 1, 5, 12, 0, 0, tzinfo=timezone.utc) +
                        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS - 1)):
            verify_token(token, "refresh")

        # Should be expired after expiration time
        with freeze_time(datetime(2026, 1, 5, 12, 0, 0, tzinfo=timezone.utc) +
                        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS + 1)):
            with pytest.raises(HTTPException) as exc:
                verify_token(token, "refresh")
            assert exc.value.status_code == 401
            assert "expired" in exc.value.detail.lower()


class TestVerifyToken:
    """Tests for verify_token function."""

    def test_returns_uuid(self):
        """Returns a UUID object, not a string."""
        user_id = uuid4()
        token = create_access_token(user_id)

        result = verify_token(token, "access")

        assert isinstance(result, UUID)
        assert result == user_id

    def test_invalid_token_format(self):
        """Raises 401 for malformed tokens."""
        with pytest.raises(HTTPException) as exc:
            verify_token("not-a-valid-token", "access")
        assert exc.value.status_code == 401
        assert "Invalid token" in exc.value.detail

    def test_tampered_token(self):
        """Raises 401 for tokens with invalid signature."""
        user_id = uuid4()
        token = create_access_token(user_id)

        # Tamper with the token by changing a character
        tampered = token[:-5] + "XXXXX"

        with pytest.raises(HTTPException) as exc:
            verify_token(tampered, "access")
        assert exc.value.status_code == 401

    def test_missing_sub_claim(self):
        """Raises 401 for tokens missing user_id (sub claim)."""
        import jwt
        from backend.config import JWT_SECRET
        from backend.auth_jwt import JWT_ALGORITHM

        # Create a token without sub claim
        token = jwt.encode(
            {"type": "access", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            JWT_SECRET,
            algorithm=JWT_ALGORITHM
        )

        with pytest.raises(HTTPException) as exc:
            verify_token(token, "access")
        assert exc.value.status_code == 401
        assert "Invalid token payload" in exc.value.detail


class TestGetCurrentUser:
    """Tests for get_current_user FastAPI dependency."""

    @pytest.mark.asyncio
    async def test_no_credentials_raises_401(self):
        """Raises 401 when no credentials provided."""
        with pytest.raises(HTTPException) as exc:
            await get_current_user(None)
        assert exc.value.status_code == 401
        assert "Not authenticated" in exc.value.detail
        assert exc.value.headers == {"WWW-Authenticate": "Bearer"}

    @pytest.mark.asyncio
    async def test_valid_credentials_returns_user_id(self):
        """Returns user_id for valid credentials."""
        from unittest.mock import Mock

        user_id = uuid4()
        token = create_access_token(user_id)

        credentials = Mock()
        credentials.credentials = token

        result = await get_current_user(credentials)

        assert result == user_id

    @pytest.mark.asyncio
    async def test_invalid_credentials_raises_401(self):
        """Raises 401 for invalid token in credentials."""
        from unittest.mock import Mock

        credentials = Mock()
        credentials.credentials = "invalid-token"

        with pytest.raises(HTTPException) as exc:
            await get_current_user(credentials)
        assert exc.value.status_code == 401


class TestGetOptionalUser:
    """Tests for get_optional_user FastAPI dependency."""

    @pytest.mark.asyncio
    async def test_no_credentials_returns_none(self):
        """Returns None when no credentials provided."""
        result = await get_optional_user(None)
        assert result is None

    @pytest.mark.asyncio
    async def test_valid_credentials_returns_user_id(self):
        """Returns user_id for valid credentials."""
        from unittest.mock import Mock

        user_id = uuid4()
        token = create_access_token(user_id)

        credentials = Mock()
        credentials.credentials = token

        result = await get_optional_user(credentials)

        assert result == user_id

    @pytest.mark.asyncio
    async def test_invalid_credentials_returns_none(self):
        """Returns None for invalid credentials (doesn't raise)."""
        from unittest.mock import Mock

        credentials = Mock()
        credentials.credentials = "invalid-token"

        result = await get_optional_user(credentials)

        assert result is None

    @pytest.mark.asyncio
    async def test_expired_token_returns_none(self):
        """Returns None for expired tokens (doesn't raise)."""
        from unittest.mock import Mock

        user_id = uuid4()

        with freeze_time("2026-01-01 12:00:00"):
            token = create_access_token(user_id)

        # Token is now expired
        credentials = Mock()
        credentials.credentials = token

        with freeze_time("2026-01-02 12:00:00"):
            result = await get_optional_user(credentials)

        assert result is None
