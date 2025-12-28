"""OAuth state management with PKCE support.

This module provides server-side storage for OAuth state tokens and PKCE
code verifiers to prevent login CSRF and authorization code interception attacks.
"""

import secrets
import hashlib
import base64
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional


# State expiration time (10 minutes)
STATE_TTL_SECONDS = 600


@dataclass
class OAuthStateData:
    """Data associated with an OAuth state token."""
    created_at: datetime
    code_verifier: str  # PKCE code verifier


# In-memory store for OAuth states
# Note: For multi-instance deployments, replace with Redis
_oauth_states: dict[str, OAuthStateData] = {}


def _generate_code_verifier() -> str:
    """Generate a cryptographically random PKCE code verifier.

    Returns a 43-128 character URL-safe string as per RFC 7636.
    """
    # 32 bytes = 43 characters when base64url encoded
    return secrets.token_urlsafe(32)


def _generate_code_challenge(verifier: str) -> str:
    """Generate PKCE code challenge from verifier using S256 method.

    Args:
        verifier: The code verifier string

    Returns:
        Base64url-encoded SHA256 hash of the verifier
    """
    digest = hashlib.sha256(verifier.encode('ascii')).digest()
    # Base64url encode without padding
    return base64.urlsafe_b64encode(digest).rstrip(b'=').decode('ascii')


def _cleanup_expired_states() -> None:
    """Remove expired state tokens from storage."""
    cutoff = datetime.utcnow() - timedelta(seconds=STATE_TTL_SECONDS)
    expired = [
        state for state, data in _oauth_states.items()
        if data.created_at < cutoff
    ]
    for state in expired:
        del _oauth_states[state]


def create_oauth_state() -> tuple[str, str]:
    """Create a new OAuth state token with PKCE parameters.

    Returns:
        Tuple of (state, code_challenge) where:
        - state: Random token to be included in authorization URL
        - code_challenge: PKCE challenge to be included in authorization URL
    """
    # Cleanup old states periodically
    _cleanup_expired_states()

    # Generate state token
    state = secrets.token_urlsafe(32)

    # Generate PKCE verifier and challenge
    code_verifier = _generate_code_verifier()
    code_challenge = _generate_code_challenge(code_verifier)

    # Store state with verifier
    _oauth_states[state] = OAuthStateData(
        created_at=datetime.utcnow(),
        code_verifier=code_verifier
    )

    return state, code_challenge


def validate_and_consume_state(state: str) -> Optional[str]:
    """Validate and consume an OAuth state token.

    Args:
        state: The state token from the OAuth callback

    Returns:
        The PKCE code verifier if state is valid, None otherwise.
        The state is removed after validation (one-time use).
    """
    if not state or state not in _oauth_states:
        return None

    state_data = _oauth_states.pop(state)

    # Check if expired
    age = (datetime.utcnow() - state_data.created_at).total_seconds()
    if age > STATE_TTL_SECONDS:
        return None

    return state_data.code_verifier
