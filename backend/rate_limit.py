"""Rate limiting for API endpoints.

This module provides in-memory rate limiting for protecting API endpoints
from abuse. Uses a sliding window algorithm to track requests per user.

IMPORTANT: This implementation uses in-memory storage which only works with
single-instance deployments. For multi-instance deployments (auto-scaling),
replace with Redis or another shared state store.
"""

import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class RateLimiter:
    """In-memory rate limiter using sliding window algorithm.

    Tracks requests per user and raises HTTPException(429) when limit exceeded.

    Attributes:
        requests_per_minute: Maximum requests allowed per minute per user
        cleanup_interval: How often to clean up old entries (in seconds)
    """

    def __init__(self, requests_per_minute: int = 30, cleanup_interval: int = 60):
        self.requests_per_minute = requests_per_minute
        self.cleanup_interval = cleanup_interval
        self._requests: dict[str, list[datetime]] = defaultdict(list)
        self._lock = asyncio.Lock()
        self._last_cleanup = datetime.now(timezone.utc)

    async def _cleanup_old_entries(self) -> None:
        """Remove expired entries from all users (must be called with lock held)."""
        now = datetime.now(timezone.utc)

        # Only cleanup periodically to avoid overhead
        if (now - self._last_cleanup).total_seconds() < self.cleanup_interval:
            return

        cutoff = now - timedelta(minutes=1)
        users_to_remove = []

        for user_id, timestamps in self._requests.items():
            # Filter to only recent timestamps
            self._requests[user_id] = [ts for ts in timestamps if ts > cutoff]
            # Mark empty users for removal
            if not self._requests[user_id]:
                users_to_remove.append(user_id)

        # Remove users with no recent requests
        for user_id in users_to_remove:
            del self._requests[user_id]

        self._last_cleanup = now

    async def check(self, user_id: str) -> None:
        """Check if user has exceeded rate limit.

        Args:
            user_id: Unique identifier for the user

        Raises:
            HTTPException: 429 Too Many Requests if limit exceeded
        """
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=1)

        async with self._lock:
            # Cleanup periodically
            await self._cleanup_old_entries()

            # Get user's recent requests
            user_requests = self._requests[user_id]

            # Filter to only requests in the last minute
            recent_requests = [ts for ts in user_requests if ts > cutoff]
            self._requests[user_id] = recent_requests

            # Check limit
            if len(recent_requests) >= self.requests_per_minute:
                logger.warning(f"Rate limit exceeded for user {user_id}")
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {self.requests_per_minute} requests per minute."
                )

            # Record this request
            self._requests[user_id].append(now)

    async def get_remaining(self, user_id: str) -> int:
        """Get remaining requests for user in current window.

        Args:
            user_id: Unique identifier for the user

        Returns:
            Number of requests remaining before rate limit
        """
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=1)

        async with self._lock:
            user_requests = self._requests.get(user_id, [])
            recent_count = sum(1 for ts in user_requests if ts > cutoff)
            return max(0, self.requests_per_minute - recent_count)


# Global rate limiter instance
# - 30 requests/minute for general API calls
# - 10 requests/minute for expensive streaming operations
api_rate_limiter = RateLimiter(requests_per_minute=30)
streaming_rate_limiter = RateLimiter(requests_per_minute=10)
