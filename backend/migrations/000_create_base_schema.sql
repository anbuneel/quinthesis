-- Base schema for Quinthesis conversations
-- This migration creates the core tables that were previously created manually in Supabase
--
-- ORDERING NOTE: The "000" prefix ensures this runs FIRST (alphabetically) for new deployments.
-- For existing deployments where tables already exist, IF NOT EXISTS makes this idempotent.
-- Columns like user_id, models, lead_model are added by later migrations (003, ensure_schema).

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT,
    message_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(conversation_id, message_order);

-- Stage 1 responses (individual model opinions)
CREATE TABLE IF NOT EXISTS stage1_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage1_message_id ON stage1_responses(message_id);

-- Stage 2 rankings (peer review evaluations)
CREATE TABLE IF NOT EXISTS stage2_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    ranking TEXT NOT NULL,
    parsed_ranking JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage2_message_id ON stage2_rankings(message_id);

-- Stage 3 synthesis (final answer from lead model)
CREATE TABLE IF NOT EXISTS stage3_synthesis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage3_message_id ON stage3_synthesis(message_id);
