-- Add user_id to conversations table for data isolation
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
