"""
Unit tests for OAuth state management with PKCE support.

Tests state token generation, validation, expiration, and PKCE code challenges.
"""
import pytest
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from backend.oauth_state import (
    create_oauth_state,
    validate_and_consume_state,
    _generate_code_verifier,
    _generate_code_challenge,
    _oauth_states,
    _state_lock,
    STATE_TTL_SECONDS,
)


class TestPKCEGeneration:
    """Tests for PKCE code verifier and challenge generation."""

    def test_generate_code_verifier_length(self):
        """Code verifier is proper length (43 chars for 32 bytes)."""
        verifier = _generate_code_verifier()
        assert len(verifier) == 43

    def test_generate_code_verifier_unique(self):
        """Each code verifier is unique."""
        verifiers = [_generate_code_verifier() for _ in range(100)]
        assert len(set(verifiers)) == 100

    def test_generate_code_verifier_url_safe(self):
        """Code verifier contains only URL-safe characters."""
        verifier = _generate_code_verifier()
        # URL-safe base64 uses only alphanumeric, dash, and underscore
        import re
        assert re.match(r'^[A-Za-z0-9_-]+$', verifier)

    def test_generate_code_challenge_s256(self):
        """Code challenge is SHA256 hash of verifier (S256 method)."""
        verifier = "test-verifier-string"
        challenge = _generate_code_challenge(verifier)

        # Manually compute expected challenge
        import hashlib
        import base64
        expected = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode('ascii')).digest()
        ).rstrip(b'=').decode('ascii')

        assert challenge == expected

    def test_generate_code_challenge_no_padding(self):
        """Code challenge has no base64 padding."""
        verifier = _generate_code_verifier()
        challenge = _generate_code_challenge(verifier)
        assert '=' not in challenge


class TestOAuthStateCreation:
    """Tests for OAuth state token creation."""

    @pytest.fixture(autouse=True)
    async def clear_state_store(self):
        """Clear the state store before each test."""
        async with _state_lock:
            _oauth_states.clear()
        yield
        async with _state_lock:
            _oauth_states.clear()

    @pytest.mark.asyncio
    async def test_create_oauth_state_returns_tuple(self):
        """create_oauth_state returns (state, code_challenge) tuple."""
        result = await create_oauth_state()
        assert isinstance(result, tuple)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_create_oauth_state_unique_states(self):
        """Each state token is unique."""
        states = [await create_oauth_state() for _ in range(50)]
        state_tokens = [s[0] for s in states]
        assert len(set(state_tokens)) == 50

    @pytest.mark.asyncio
    async def test_create_oauth_state_stores_state(self):
        """Created state is stored in memory."""
        state, _ = await create_oauth_state()

        async with _state_lock:
            assert state in _oauth_states

    @pytest.mark.asyncio
    async def test_create_oauth_state_stores_verifier(self):
        """State storage includes code verifier."""
        state, _ = await create_oauth_state()

        async with _state_lock:
            state_data = _oauth_states[state]
            assert state_data.code_verifier is not None
            assert len(state_data.code_verifier) > 0

    @pytest.mark.asyncio
    async def test_create_oauth_state_records_timestamp(self):
        """State storage includes creation timestamp."""
        before = datetime.now(timezone.utc)
        state, _ = await create_oauth_state()
        after = datetime.now(timezone.utc)

        async with _state_lock:
            state_data = _oauth_states[state]
            assert before <= state_data.created_at <= after


class TestOAuthStateValidation:
    """Tests for OAuth state validation and consumption."""

    @pytest.fixture(autouse=True)
    async def clear_state_store(self):
        """Clear the state store before each test."""
        async with _state_lock:
            _oauth_states.clear()
        yield
        async with _state_lock:
            _oauth_states.clear()

    @pytest.mark.asyncio
    async def test_validate_valid_state_returns_verifier(self):
        """Valid state returns the code verifier."""
        state, _ = await create_oauth_state()

        # Get expected verifier before validation
        async with _state_lock:
            expected_verifier = _oauth_states[state].code_verifier

        result = await validate_and_consume_state(state)
        assert result == expected_verifier

    @pytest.mark.asyncio
    async def test_validate_consumes_state(self):
        """Validation removes the state from storage (one-time use)."""
        state, _ = await create_oauth_state()

        await validate_and_consume_state(state)

        async with _state_lock:
            assert state not in _oauth_states

    @pytest.mark.asyncio
    async def test_validate_invalid_state_returns_none(self):
        """Invalid state returns None."""
        result = await validate_and_consume_state("nonexistent-state")
        assert result is None

    @pytest.mark.asyncio
    async def test_validate_empty_state_returns_none(self):
        """Empty state returns None."""
        result = await validate_and_consume_state("")
        assert result is None

    @pytest.mark.asyncio
    async def test_validate_none_state_returns_none(self):
        """None state returns None."""
        result = await validate_and_consume_state(None)
        assert result is None

    @pytest.mark.asyncio
    async def test_validate_reused_state_returns_none(self):
        """Re-using a state after validation returns None."""
        state, _ = await create_oauth_state()

        # First validation succeeds
        result1 = await validate_and_consume_state(state)
        assert result1 is not None

        # Second validation fails
        result2 = await validate_and_consume_state(state)
        assert result2 is None


class TestOAuthStateExpiration:
    """Tests for OAuth state expiration."""

    @pytest.fixture(autouse=True)
    async def clear_state_store(self):
        """Clear the state store before each test."""
        async with _state_lock:
            _oauth_states.clear()
        yield
        async with _state_lock:
            _oauth_states.clear()

    @pytest.mark.asyncio
    async def test_expired_state_returns_none(self):
        """Expired state returns None on validation."""
        state, _ = await create_oauth_state()

        # Manually expire the state
        async with _state_lock:
            _oauth_states[state].created_at = (
                datetime.now(timezone.utc) - timedelta(seconds=STATE_TTL_SECONDS + 1)
            )

        result = await validate_and_consume_state(state)
        assert result is None

    @pytest.mark.asyncio
    async def test_state_just_before_expiry_is_valid(self):
        """State just before expiry is still valid."""
        state, _ = await create_oauth_state()

        # Set to just under TTL
        async with _state_lock:
            _oauth_states[state].created_at = (
                datetime.now(timezone.utc) - timedelta(seconds=STATE_TTL_SECONDS - 1)
            )

        result = await validate_and_consume_state(state)
        assert result is not None

    @pytest.mark.asyncio
    async def test_cleanup_removes_expired_states(self):
        """Creating new state cleans up expired states."""
        # Create an expired state
        old_state, _ = await create_oauth_state()
        async with _state_lock:
            _oauth_states[old_state].created_at = (
                datetime.now(timezone.utc) - timedelta(seconds=STATE_TTL_SECONDS + 100)
            )

        # Create a new state (triggers cleanup)
        await create_oauth_state()

        async with _state_lock:
            assert old_state not in _oauth_states


class TestConcurrency:
    """Tests for concurrent access to OAuth state store."""

    @pytest.fixture(autouse=True)
    async def clear_state_store(self):
        """Clear the state store before each test."""
        async with _state_lock:
            _oauth_states.clear()
        yield
        async with _state_lock:
            _oauth_states.clear()

    @pytest.mark.asyncio
    async def test_concurrent_state_creation(self):
        """Multiple concurrent state creations don't conflict."""
        # Create 100 states concurrently
        tasks = [create_oauth_state() for _ in range(100)]
        results = await asyncio.gather(*tasks)

        # All should succeed with unique states
        states = [r[0] for r in results]
        assert len(set(states)) == 100

    @pytest.mark.asyncio
    async def test_concurrent_validation(self):
        """Concurrent validation of same state only succeeds once."""
        state, _ = await create_oauth_state()

        # Try to validate same state 10 times concurrently
        tasks = [validate_and_consume_state(state) for _ in range(10)]
        results = await asyncio.gather(*tasks)

        # Only one should succeed (return verifier)
        successful = [r for r in results if r is not None]
        assert len(successful) == 1
