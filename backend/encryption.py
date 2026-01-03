"""Encryption utilities for API key storage.

Uses MultiFernet for key rotation support:
- Multiple keys can be configured (comma-separated in API_KEY_ENCRYPTION_KEY)
- Newest key is listed first and used for all new encryptions
- Older keys are retained for decrypting existing data
- Enables zero-downtime key rotation
 - Optional API_KEY_ENCRYPTION_KEY_VERSION for monotonic version tracking
"""

from cryptography.fernet import Fernet, MultiFernet, InvalidToken

from .config import API_KEY_ENCRYPTION_KEYS, API_KEY_ENCRYPTION_KEY_VERSION


def _get_fernets() -> list[Fernet]:
    """Build Fernet instances for all configured keys."""
    if not API_KEY_ENCRYPTION_KEYS:
        raise ValueError(
            "API_KEY_ENCRYPTION_KEY not configured. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )

    fernets = []
    for i, key in enumerate(API_KEY_ENCRYPTION_KEYS):
        try:
            fernets.append(Fernet(key.encode("utf-8")))
        except Exception as e:
            raise ValueError(f"Invalid Fernet key at position {i}: {e}")

    return fernets


def _get_primary_fernet() -> Fernet:
    """Get the primary (newest) Fernet instance for encryption."""
    return _get_fernets()[0]


def _get_fernet() -> MultiFernet:
    """Get the MultiFernet instance for API key encryption.

    Returns MultiFernet configured with all available keys.
    The first key is used for encryption, all keys are tried for decryption.
    """
    return MultiFernet(_get_fernets())


def encrypt_api_key(api_key: str) -> str:
    """Encrypt an API key for storage.

    Uses the first (newest) key in the rotation list.
    """
    fernet = _get_fernet()
    return fernet.encrypt(api_key.encode("utf-8")).decode("utf-8")


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an API key from storage.

    Tries all keys in the rotation list until one succeeds.
    This allows old data encrypted with previous keys to still be decrypted.
    """
    fernet = _get_fernet()
    try:
        return fernet.decrypt(encrypted_key.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        raise ValueError("Failed to decrypt API key - invalid token or key")


def rotate_api_key(encrypted_key: str) -> tuple[str, bool]:
    """Re-encrypt an API key with the current (newest) key.

    Returns:
        tuple: (new_encrypted_key, was_rotated)
        - new_encrypted_key: The re-encrypted key (or original if already current)
        - was_rotated: True if the key was re-encrypted, False if already using newest key

    This is useful for lazy re-encryption: when a user accesses their key,
    we can transparently upgrade it to the newest encryption key.
    """
    primary = _get_primary_fernet()
    try:
        # If primary key can decrypt, no rotation needed
        primary.decrypt(encrypted_key.encode("utf-8"))
        return encrypted_key, False
    except InvalidToken:
        pass

    fernet = _get_fernet()
    try:
        decrypted = fernet.decrypt(encrypted_key.encode("utf-8"))
        new_encrypted = primary.encrypt(decrypted).decode("utf-8")
        return new_encrypted, True
    except InvalidToken:
        raise ValueError("Failed to rotate API key - invalid token or key")


def get_key_hint(api_key: str) -> str:
    """Get a hint for displaying the API key.

    Shows the last 6 characters for user identification.
    """
    if len(api_key) > 6:
        return f"...{api_key[-6:]}"
    return api_key


def get_key_count() -> int:
    """Get the number of encryption keys configured.

    Useful for diagnostics and rotation status checks.
    """
    return len(API_KEY_ENCRYPTION_KEYS)


def get_current_key_version() -> int:
    """Get the current encryption key version.

    Uses API_KEY_ENCRYPTION_KEY_VERSION if set, otherwise falls back to the
    number of configured keys (newest-first ordering).
    """
    if API_KEY_ENCRYPTION_KEY_VERSION is not None:
        return API_KEY_ENCRYPTION_KEY_VERSION
    return len(API_KEY_ENCRYPTION_KEYS)
