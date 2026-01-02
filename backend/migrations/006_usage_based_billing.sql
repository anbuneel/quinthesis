-- Migration 006: Convert credits to usage-based billing with dollar balance
-- Users are charged actual OpenRouter cost + 10% margin per query

-- 1. Add dollar-based balance column (6 decimal precision for small costs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(10,6) NOT NULL DEFAULT 0;

-- 2. Add tracking columns for transparency
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_deposited NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,6) NOT NULL DEFAULT 0;

-- 3. Add cost tracking columns to credit_transactions for usage-based tracking
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS openrouter_cost NUMERIC(10,6);
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS margin_cost NUMERIC(10,6);
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10,6);
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS balance_after_dollars NUMERIC(10,6);
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS generation_ids JSONB;

-- 4. Create deposit_options table (replaces credit_packs for new billing model)
CREATE TABLE IF NOT EXISTS deposit_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    amount_cents INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_options_active ON deposit_options(is_active, sort_order);

-- Insert default deposit options
INSERT INTO deposit_options (name, amount_cents, sort_order) VALUES
    ('$5 Deposit', 500, 1),
    ('$20 Deposit', 2000, 2),
    ('$50 Deposit', 5000, 3)
ON CONFLICT DO NOTHING;

-- 5. Create query_costs table for per-query cost tracking and transparency
CREATE TABLE IF NOT EXISTS query_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(255) NOT NULL,
    message_id UUID,
    generation_ids JSONB NOT NULL,
    openrouter_cost NUMERIC(10,6) NOT NULL,
    margin_cost NUMERIC(10,6) NOT NULL,
    total_cost NUMERIC(10,6) NOT NULL,
    model_breakdown JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_costs_user_id ON query_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_query_costs_conversation_id ON query_costs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_query_costs_created_at ON query_costs(created_at DESC);

-- Note: No migration of existing credits needed (fresh start, no existing users with credits)
