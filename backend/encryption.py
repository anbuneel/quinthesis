"""Encryption utilities for password hashing and API key storage."""

import bcrypt
from cryptography.fernet import Fernet, InvalidToken

from .config import API_KEY_ENCRYPTION_KEY


# ============== Password Hashing ==============

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8")
        )
    except Exception:
        return False


# ============== API Key Encryption ==============

def _get_fernet() -> Fernet:
    """Get the Fernet instance for API key encryption."""
    if not API_KEY_ENCRYPTION_KEY:
        raise ValueError(
            "API_KEY_ENCRYPTION_KEY not configured. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(API_KEY_ENCRYPTION_KEY.encode("utf-8"))


def encrypt_api_key(api_key: str) -> str:
    """Encrypt an API key for storage."""
    fernet = _get_fernet()
    return fernet.encrypt(api_key.encode("utf-8")).decode("utf-8")


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an API key from storage."""
    fernet = _get_fernet()
    try:
        return fernet.decrypt(encrypted_key.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        raise ValueError("Failed to decrypt API key - invalid token or key")


def get_key_hint(api_key: str) -> str:
    """
    Get a hint for displaying the API key.
    Shows the last 6 characters for user identification.
    """
    if len(api_key) > 6:
        return f"...{api_key[-6:]}"
    return api_key
