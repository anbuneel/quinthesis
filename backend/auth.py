"""Basic HTTP authentication middleware."""

import secrets
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from .config import AUTH_USERNAME, AUTH_PASSWORD

security = HTTPBasic()


def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """
    Verify HTTP Basic auth credentials.

    Returns the username if authentication succeeds.
    Raises HTTPException with 401 status if authentication fails.
    """
    # Check if auth is configured
    if not AUTH_USERNAME or not AUTH_PASSWORD:
        # If no auth configured, allow access (for local development)
        return "anonymous"

    # Use constant-time comparison to prevent timing attacks
    correct_username = secrets.compare_digest(
        credentials.username.encode("utf8"),
        AUTH_USERNAME.encode("utf8")
    )
    correct_password = secrets.compare_digest(
        credentials.password.encode("utf8"),
        AUTH_PASSWORD.encode("utf8")
    )

    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )

    return credentials.username
