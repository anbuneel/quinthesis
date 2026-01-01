"""OpenRouter Provisioning API for per-user key management.

This module handles creating and managing per-user OpenRouter API keys
using the Provisioning API. Each user gets their own key with spending limits.

API Documentation: https://openrouter.ai/docs/guides/overview/auth/provisioning-api-keys
"""

import logging
from typing import Optional
import httpx

from .config import OPENROUTER_PROVISIONING_KEY

logger = logging.getLogger(__name__)

PROVISIONING_BASE_URL = "https://openrouter.ai/api/v1/keys"

# Shared HTTP client for connection pooling
_client: Optional[httpx.AsyncClient] = None


async def get_client() -> httpx.AsyncClient:
    """Get or create the shared HTTP client."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        )
    return _client


async def close_client() -> None:
    """Close the shared HTTP client."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
        _client = None


def is_provisioning_configured() -> bool:
    """Check if OpenRouter provisioning is configured."""
    return bool(OPENROUTER_PROVISIONING_KEY)


def _get_headers() -> dict:
    """Get authorization headers for provisioning API."""
    return {
        "Authorization": f"Bearer {OPENROUTER_PROVISIONING_KEY}",
        "Content-Type": "application/json",
    }


async def create_user_key(
    user_id: str,
    name: str,
    limit_dollars: float
) -> dict:
    """Create a provisioned API key for a user.

    Args:
        user_id: Unique user identifier (for reference)
        name: Descriptive name for the key
        limit_dollars: Credit limit in dollars (e.g., 2.00 = $2.00)

    Returns:
        dict with keys: "key" (the API key), "hash" (key identifier), "limit"

    Raises:
        httpx.HTTPStatusError: If the API request fails
    """
    if not is_provisioning_configured():
        raise RuntimeError("OpenRouter provisioning key not configured")

    client = await get_client()

    payload = {
        "name": f"{name} (user:{user_id})",
        "limit": limit_dollars,
    }

    response = await client.post(
        PROVISIONING_BASE_URL,
        headers=_get_headers(),
        json=payload,
    )
    response.raise_for_status()

    data = response.json()
    logger.info(f"Created OpenRouter key for user {user_id}, hash: {data.get('data', {}).get('hash', 'unknown')}")

    # Response structure: {"data": {"key": "sk-or-...", "hash": "abc123", "limit": 200, ...}}
    key_data = data.get("data", {})
    return {
        "key": key_data.get("key"),
        "hash": key_data.get("hash"),
        "limit": key_data.get("limit"),
    }


async def update_key_limit(key_hash: str, new_limit_dollars: float) -> dict:
    """Update spending limit on an existing key.

    Called when user buys more credits - increases their limit.

    Args:
        key_hash: The key hash identifier
        new_limit_dollars: New total credit limit in dollars

    Returns:
        Updated key data

    Raises:
        httpx.HTTPStatusError: If the API request fails
    """
    if not is_provisioning_configured():
        raise RuntimeError("OpenRouter provisioning key not configured")

    client = await get_client()

    response = await client.patch(
        f"{PROVISIONING_BASE_URL}/{key_hash}",
        headers=_get_headers(),
        json={"limit": new_limit_dollars},
    )
    response.raise_for_status()

    data = response.json()
    logger.info(f"Updated OpenRouter key {key_hash} limit to ${new_limit_dollars:.2f}")

    return data.get("data", {})


async def get_key_info(key_hash: str) -> dict:
    """Get information about a key including usage.

    Args:
        key_hash: The key hash identifier

    Returns:
        Key data including usage, limit, etc.

    Raises:
        httpx.HTTPStatusError: If the API request fails
    """
    if not is_provisioning_configured():
        raise RuntimeError("OpenRouter provisioning key not configured")

    client = await get_client()

    response = await client.get(
        f"{PROVISIONING_BASE_URL}/{key_hash}",
        headers=_get_headers(),
    )
    response.raise_for_status()

    data = response.json()
    return data.get("data", {})


async def disable_key(key_hash: str) -> None:
    """Disable a key (e.g., when credits exhausted or user deleted).

    Args:
        key_hash: The key hash identifier

    Raises:
        httpx.HTTPStatusError: If the API request fails
    """
    if not is_provisioning_configured():
        raise RuntimeError("OpenRouter provisioning key not configured")

    client = await get_client()

    response = await client.patch(
        f"{PROVISIONING_BASE_URL}/{key_hash}",
        headers=_get_headers(),
        json={"disabled": True},
    )
    response.raise_for_status()

    logger.info(f"Disabled OpenRouter key {key_hash}")


async def enable_key(key_hash: str) -> None:
    """Re-enable a previously disabled key.

    Args:
        key_hash: The key hash identifier

    Raises:
        httpx.HTTPStatusError: If the API request fails
    """
    if not is_provisioning_configured():
        raise RuntimeError("OpenRouter provisioning key not configured")

    client = await get_client()

    response = await client.patch(
        f"{PROVISIONING_BASE_URL}/{key_hash}",
        headers=_get_headers(),
        json={"disabled": False},
    )
    response.raise_for_status()

    logger.info(f"Enabled OpenRouter key {key_hash}")


async def delete_key(key_hash: str) -> None:
    """Delete a key permanently.

    Args:
        key_hash: The key hash identifier

    Raises:
        httpx.HTTPStatusError: If the API request fails
    """
    if not is_provisioning_configured():
        raise RuntimeError("OpenRouter provisioning key not configured")

    client = await get_client()

    response = await client.delete(
        f"{PROVISIONING_BASE_URL}/{key_hash}",
        headers=_get_headers(),
    )
    response.raise_for_status()

    logger.info(f"Deleted OpenRouter key {key_hash}")
