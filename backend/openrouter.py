"""OpenRouter API client for making LLM requests.

Uses a shared HTTP client for connection pooling and implements
retry logic with exponential backoff for rate limits and server errors.
"""

import asyncio
import logging
import httpx
from typing import List, Dict, Any, Optional

from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL

logger = logging.getLogger(__name__)

# Shared HTTP client for connection pooling
_client: Optional[httpx.AsyncClient] = None

# Retry configuration
MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0  # seconds
RETRY_MAX_DELAY = 30.0  # seconds
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


async def get_client() -> httpx.AsyncClient:
    """Get or create the shared HTTP client."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
        )
    return _client


async def close_client():
    """Close the shared HTTP client."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
        _client = None


async def query_model(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 120.0,
    api_key: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Query a single model via OpenRouter API.

    Uses a shared HTTP client and implements retry with exponential backoff
    for rate limits (429) and server errors (5xx).

    Args:
        model: OpenRouter model identifier (e.g., "openai/gpt-4o")
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds
        api_key: Optional user-provided API key (uses default if not provided)

    Returns:
        Response dict with 'content' and optional 'reasoning_details', or None if failed
    """
    # Use user's API key if provided, otherwise fall back to default
    key = api_key or OPENROUTER_API_KEY
    if not key:
        logger.error(f"No API key available for model {model}")
        return None

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
    }

    client = await get_client()
    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            response = await client.post(
                OPENROUTER_API_URL,
                headers=headers,
                json=payload,
                timeout=timeout
            )

            # Check if we should retry
            if response.status_code in RETRYABLE_STATUS_CODES:
                delay = min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_DELAY)

                # Check for Retry-After header (common with 429)
                retry_after = response.headers.get("retry-after")
                if retry_after:
                    try:
                        delay = min(float(retry_after), RETRY_MAX_DELAY)
                    except ValueError:
                        pass

                logger.warning(
                    f"Model {model} returned {response.status_code}, "
                    f"retrying in {delay:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})"
                )
                await asyncio.sleep(delay)
                continue

            response.raise_for_status()

            data = response.json()
            message = data['choices'][0]['message']

            return {
                'content': message.get('content'),
                'reasoning_details': message.get('reasoning_details')
            }

        except httpx.TimeoutException as e:
            last_error = e
            logger.warning(f"Timeout querying model {model} (attempt {attempt + 1}/{MAX_RETRIES})")
            if attempt < MAX_RETRIES - 1:
                delay = min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_DELAY)
                await asyncio.sleep(delay)
                continue

        except httpx.HTTPStatusError as e:
            # Non-retryable HTTP error
            logger.error(f"HTTP error querying model {model}: {e.response.status_code}")
            return None

        except Exception as e:
            last_error = e
            logger.error(f"Error querying model {model}: {e}")
            return None

    # All retries exhausted
    logger.error(f"All retries exhausted for model {model}: {last_error}")
    return None


async def query_models_parallel(
    models: List[str],
    messages: List[Dict[str, str]],
    api_key: Optional[str] = None
) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Query multiple models in parallel.

    Args:
        models: List of OpenRouter model identifiers
        messages: List of message dicts to send to each model
        api_key: Optional user-provided API key (uses default if not provided)

    Returns:
        Dict mapping model identifier to response dict (or None if failed)
    """
    # Create tasks for all models, passing the API key to each
    tasks = [query_model(model, messages, api_key=api_key) for model in models]

    # Wait for all to complete
    responses = await asyncio.gather(*tasks)

    # Map models to their responses
    return {model: response for model, response in zip(models, responses)}
