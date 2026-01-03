-- Migration 012: Add key version tracking for provisioned OpenRouter keys
-- Enables lazy re-encryption for system-provisioned keys

ALTER TABLE users ADD COLUMN IF NOT EXISTS openrouter_key_version INTEGER DEFAULT 1;
COMMENT ON COLUMN users.openrouter_key_version IS 'Provisioned OpenRouter key version (1 = original, increments on rotation)';
