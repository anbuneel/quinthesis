# Key Rotation (API Key Encryption)

Guidance for rotating encryption keys used to protect API keys (BYOK and provisioned).

---

## When to Rotate

- Suspected key compromise or accidental exposure
- Production access changes (new operator/vendor/CI secret exposure)
- On a periodic cadence (every 6-12 months)

---

## How It Works

- `API_KEY_ENCRYPTION_KEY` accepts comma-separated Fernet keys (newest first).
- New encryptions always use the first key.
- Decryption tries all keys in order.
- Lazy re-encryption upgrades old data when keys are accessed.
- `API_KEY_ENCRYPTION_KEY_VERSION` (optional) provides monotonic version tracking.

---

## Manual Rotation Procedure

1. Generate a new key:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

2. Prepend the new key and bump the version:
   ```bash
   fly secrets set API_KEY_ENCRYPTION_KEY="new-key,old-key"
   fly secrets set API_KEY_ENCRYPTION_KEY_VERSION=2
   ```

3. Deploy the backend.

4. Apply migrations (includes key version tracking columns):
   ```bash
   uv run python -m backend.migrate
   ```

5. Allow lazy rotation (keys re-encrypt on access).

6. Remove old keys once rotation is complete:
   ```bash
   fly secrets set API_KEY_ENCRYPTION_KEY="new-key"
   ```

---

## Notes

- If you omit `API_KEY_ENCRYPTION_KEY_VERSION`, the system falls back to the number of keys.
- The version value should be monotonic (always increasing) across rotations.
- Provisioned OpenRouter keys are rotated using the same mechanism.
