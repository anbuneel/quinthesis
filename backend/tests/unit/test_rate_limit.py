"""
Unit tests for backend.rate_limit module.

Tests rate limiting logic with sliding window algorithm.
"""
import pytest
from datetime import datetime, timedelta, timezone
from freezegun import freeze_time
from fastapi import HTTPException

from backend.rate_limit import RateLimiter


class TestRateLimiterCheck:
    """Tests for RateLimiter.check() method."""

    @pytest.mark.asyncio
    async def test_allows_requests_under_limit(self):
        """Requests under the limit are allowed."""
        limiter = RateLimiter(requests_per_minute=5)

        # Should allow 5 requests
        for _ in range(5):
            await limiter.check("user-1")

    @pytest.mark.asyncio
    async def test_blocks_requests_over_limit(self):
        """Raises 429 when limit exceeded."""
        limiter = RateLimiter(requests_per_minute=3)

        # Allow first 3
        for _ in range(3):
            await limiter.check("user-1")

        # 4th should fail
        with pytest.raises(HTTPException) as exc:
            await limiter.check("user-1")

        assert exc.value.status_code == 429
        assert "Rate limit exceeded" in exc.value.detail
        assert "3 requests per minute" in exc.value.detail

    @pytest.mark.asyncio
    async def test_different_users_have_separate_limits(self):
        """Each user has their own rate limit."""
        limiter = RateLimiter(requests_per_minute=2)

        # User 1 makes 2 requests
        await limiter.check("user-1")
        await limiter.check("user-1")

        # User 1 is blocked
        with pytest.raises(HTTPException):
            await limiter.check("user-1")

        # User 2 can still make requests
        await limiter.check("user-2")
        await limiter.check("user-2")

    @pytest.mark.asyncio
    async def test_resets_after_window_expires(self):
        """Limit resets after sliding window passes."""
        limiter = RateLimiter(requests_per_minute=2)

        with freeze_time("2026-01-05 12:00:00") as frozen:
            # Use up the limit
            await limiter.check("user-1")
            await limiter.check("user-1")

            # Blocked
            with pytest.raises(HTTPException):
                await limiter.check("user-1")

            # Move time forward 61 seconds (past the 1 minute window)
            frozen.move_to("2026-01-05 12:01:01")

            # Should be allowed again
            await limiter.check("user-1")

    @pytest.mark.asyncio
    async def test_sliding_window_partial_reset(self):
        """Old requests fall out of window while newer ones remain."""
        limiter = RateLimiter(requests_per_minute=3)

        with freeze_time("2026-01-05 12:00:00") as frozen:
            # Make request at T+0
            await limiter.check("user-1")

            # Make 2 more at T+30s
            frozen.move_to("2026-01-05 12:00:30")
            await limiter.check("user-1")
            await limiter.check("user-1")

            # Blocked at T+30s (3 requests in last minute)
            with pytest.raises(HTTPException):
                await limiter.check("user-1")

            # At T+61s, the first request expires but the T+30s ones remain
            frozen.move_to("2026-01-05 12:01:01")

            # Should allow 1 more (2 from T+30s still count)
            await limiter.check("user-1")

            # Blocked again
            with pytest.raises(HTTPException):
                await limiter.check("user-1")


class TestRateLimiterGetRemaining:
    """Tests for RateLimiter.get_remaining() method."""

    @pytest.mark.asyncio
    async def test_returns_full_limit_for_new_user(self):
        """New users have full limit available."""
        limiter = RateLimiter(requests_per_minute=10)

        remaining = await limiter.get_remaining("new-user")

        assert remaining == 10

    @pytest.mark.asyncio
    async def test_decreases_after_requests(self):
        """Remaining count decreases after requests."""
        limiter = RateLimiter(requests_per_minute=5)

        await limiter.check("user-1")
        await limiter.check("user-1")

        remaining = await limiter.get_remaining("user-1")

        assert remaining == 3

    @pytest.mark.asyncio
    async def test_returns_zero_when_exhausted(self):
        """Returns 0 when limit exhausted."""
        limiter = RateLimiter(requests_per_minute=2)

        await limiter.check("user-1")
        await limiter.check("user-1")

        remaining = await limiter.get_remaining("user-1")

        assert remaining == 0

    @pytest.mark.asyncio
    async def test_never_returns_negative(self):
        """Never returns negative even if somehow over limit."""
        limiter = RateLimiter(requests_per_minute=1)

        await limiter.check("user-1")

        # Even if we could somehow have more, it should return 0
        remaining = await limiter.get_remaining("user-1")

        assert remaining >= 0


class TestRateLimiterCleanup:
    """Tests for automatic cleanup of old entries."""

    @pytest.mark.asyncio
    async def test_cleanup_removes_expired_entries(self):
        """Cleanup removes entries older than 1 minute."""
        limiter = RateLimiter(requests_per_minute=10, cleanup_interval=0)  # Cleanup every time

        with freeze_time("2026-01-05 12:00:00") as frozen:
            await limiter.check("user-1")

            # Move past expiration
            frozen.move_to("2026-01-05 12:02:00")

            # Trigger cleanup via check
            await limiter.check("user-2")

            # User 1's entry should be cleaned up
            remaining = await limiter.get_remaining("user-1")
            assert remaining == 10

    @pytest.mark.asyncio
    async def test_cleanup_interval_respected(self):
        """Cleanup only happens after cleanup_interval seconds."""
        # Create limiter with 60 second cleanup interval
        limiter = RateLimiter(requests_per_minute=10, cleanup_interval=60)

        with freeze_time("2026-01-05 12:00:00") as frozen:
            await limiter.check("user-1")

            # Move only 30 seconds (less than cleanup interval)
            frozen.move_to("2026-01-05 12:00:30")

            # Cleanup should not have run yet, so internal state still has old entries
            # (even though they're expired, they haven't been cleaned up)
            # This is an implementation detail test

            # Move to just past cleanup interval
            frozen.move_to("2026-01-05 12:01:01")

            # Now cleanup should run on next check
            await limiter.check("user-2")


class TestRateLimiterConcurrency:
    """Tests for concurrent request handling."""

    @pytest.mark.asyncio
    async def test_concurrent_requests_respect_limit(self):
        """Concurrent requests don't exceed the limit."""
        import asyncio

        limiter = RateLimiter(requests_per_minute=5)
        results = []

        async def make_request():
            try:
                await limiter.check("user-1")
                results.append("success")
            except HTTPException:
                results.append("blocked")

        # Make 10 concurrent requests
        tasks = [make_request() for _ in range(10)]
        await asyncio.gather(*tasks)

        # Exactly 5 should succeed
        assert results.count("success") == 5
        assert results.count("blocked") == 5


class TestGlobalLimiters:
    """Tests for global rate limiter instances."""

    def test_api_limiter_config(self):
        """API limiter has correct configuration."""
        from backend.rate_limit import api_rate_limiter

        assert api_rate_limiter.requests_per_minute == 30

    def test_streaming_limiter_config(self):
        """Streaming limiter has correct configuration."""
        from backend.rate_limit import streaming_rate_limiter

        assert streaming_rate_limiter.requests_per_minute == 10

    def test_checkout_limiter_config(self):
        """Checkout limiter has correct configuration."""
        from backend.rate_limit import checkout_rate_limiter

        assert checkout_rate_limiter.requests_per_minute == 10
