"""
Unit tests for backend.encryption module.

Tests API key encryption, decryption, and key rotation.
"""
import pytest
from unittest.mock import patch
from cryptography.fernet import Fernet


# Generate test keys
TEST_KEY_1 = Fernet.generate_key().decode()
TEST_KEY_2 = Fernet.generate_key().decode()
TEST_KEY_3 = Fernet.generate_key().decode()


class TestEncryptDecrypt:
    """Tests for encrypt_api_key and decrypt_api_key functions."""

    def test_encrypt_decrypt_roundtrip(self):
        """Encrypted key can be decrypted back to original."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1]):
            from backend.encryption import encrypt_api_key, decrypt_api_key

            original = "sk-or-v1-abc123xyz789"
            encrypted = encrypt_api_key(original)

            assert encrypted != original  # Should be encrypted
            assert decrypt_api_key(encrypted) == original

    def test_encrypted_output_is_string(self):
        """Encrypted output is a string (not bytes)."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1]):
            from backend.encryption import encrypt_api_key

            encrypted = encrypt_api_key("test-key")

            assert isinstance(encrypted, str)

    def test_same_key_different_ciphertext(self):
        """Same key encrypted twice produces different ciphertext (due to IV)."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1]):
            from backend.encryption import encrypt_api_key

            original = "sk-or-v1-abc123"
            encrypted1 = encrypt_api_key(original)
            encrypted2 = encrypt_api_key(original)

            assert encrypted1 != encrypted2  # Different IVs

    def test_decrypt_invalid_token_raises(self):
        """Decrypting invalid data raises ValueError."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1]):
            from backend.encryption import decrypt_api_key

            with pytest.raises(ValueError) as exc:
                decrypt_api_key("not-a-valid-encrypted-string")
            assert "Failed to decrypt" in str(exc.value)

    def test_decrypt_with_wrong_key_raises(self):
        """Decrypting with wrong key raises ValueError."""
        # Encrypt with key 1
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1]):
            from backend.encryption import encrypt_api_key
            encrypted = encrypt_api_key("test-key")

        # Try to decrypt with key 2
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_2]):
            from backend.encryption import decrypt_api_key

            with pytest.raises(ValueError) as exc:
                decrypt_api_key(encrypted)
            assert "Failed to decrypt" in str(exc.value)


class TestKeyRotation:
    """Tests for key rotation functionality."""

    def test_decrypt_with_old_key(self):
        """Data encrypted with old key can be decrypted when both keys present."""
        # Encrypt with old key only
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1]):
            from backend.encryption import encrypt_api_key
            encrypted = encrypt_api_key("my-secret-key")

        # Decrypt with new key first, old key second (rotation scenario)
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_2, TEST_KEY_1]):
            from backend.encryption import decrypt_api_key
            decrypted = decrypt_api_key(encrypted)

            assert decrypted == "my-secret-key"

    def test_rotate_api_key_with_old_key(self):
        """Key encrypted with old key gets re-encrypted with new key."""
        # Encrypt with old key
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1]):
            from backend.encryption import encrypt_api_key
            old_encrypted = encrypt_api_key("my-secret-key")

        # Rotate to new key
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_2, TEST_KEY_1]):
            from backend.encryption import rotate_api_key, decrypt_api_key
            new_encrypted, was_rotated = rotate_api_key(old_encrypted)

            assert was_rotated is True
            assert new_encrypted != old_encrypted
            assert decrypt_api_key(new_encrypted) == "my-secret-key"

        # New encrypted version should work with only the new key
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_2]):
            from backend.encryption import decrypt_api_key
            decrypted = decrypt_api_key(new_encrypted)
            assert decrypted == "my-secret-key"

    def test_rotate_api_key_already_current(self):
        """Key already encrypted with newest key is not rotated."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1]):
            from backend.encryption import encrypt_api_key
            encrypted = encrypt_api_key("my-secret-key")

        # Same key is still primary
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1, TEST_KEY_2]):
            from backend.encryption import rotate_api_key
            new_encrypted, was_rotated = rotate_api_key(encrypted)

            assert was_rotated is False
            assert new_encrypted == encrypted

    def test_rotate_invalid_key_raises(self):
        """Rotating invalid encrypted data raises ValueError."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1]):
            from backend.encryption import rotate_api_key

            with pytest.raises(ValueError) as exc:
                rotate_api_key("invalid-encrypted-data")
            assert "Failed to rotate" in str(exc.value)


class TestGetKeyHint:
    """Tests for get_key_hint function."""

    def test_shows_last_6_chars(self):
        """Returns last 6 characters with prefix."""
        from backend.encryption import get_key_hint

        result = get_key_hint("sk-or-v1-abc123xyz")

        assert result == "...123xyz"

    def test_short_key_returns_as_is(self):
        """Keys with 6 or fewer characters returned as-is."""
        from backend.encryption import get_key_hint

        assert get_key_hint("abc") == "abc"
        assert get_key_hint("123456") == "123456"

    def test_exactly_7_chars(self):
        """Key with 7 characters shows last 6."""
        from backend.encryption import get_key_hint

        result = get_key_hint("1234567")
        assert result == "...234567"


class TestKeyManagement:
    """Tests for key management functions."""

    def test_get_key_count_single(self):
        """Returns 1 for single key."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1]):
            from backend.encryption import get_key_count
            assert get_key_count() == 1

    def test_get_key_count_multiple(self):
        """Returns correct count for multiple keys."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1, TEST_KEY_2, TEST_KEY_3]):
            from backend.encryption import get_key_count
            assert get_key_count() == 3

    def test_get_current_key_version_from_env(self):
        """Returns explicit version when set."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1]):
            with patch("backend.encryption.API_KEY_ENCRYPTION_KEY_VERSION", 5):
                from backend.encryption import get_current_key_version
                assert get_current_key_version() == 5

    def test_get_current_key_version_fallback(self):
        """Falls back to key count when version not set."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", [TEST_KEY_1, TEST_KEY_2]):
            with patch("backend.encryption.API_KEY_ENCRYPTION_KEY_VERSION", None):
                from backend.encryption import get_current_key_version
                assert get_current_key_version() == 2


class TestMissingConfiguration:
    """Tests for missing or invalid configuration."""

    def test_no_keys_configured_raises(self):
        """Raises ValueError when no encryption keys configured."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", []):
            from backend.encryption import encrypt_api_key

            with pytest.raises(ValueError) as exc:
                encrypt_api_key("test")
            assert "not configured" in str(exc.value)

    def test_invalid_key_format_raises(self):
        """Raises ValueError for invalid key format."""
        with patch("backend.encryption.API_KEY_ENCRYPTION_KEYS", ["not-a-valid-fernet-key"]):
            from backend.encryption import encrypt_api_key

            with pytest.raises(ValueError) as exc:
                encrypt_api_key("test")
            assert "Invalid Fernet key" in str(exc.value)
