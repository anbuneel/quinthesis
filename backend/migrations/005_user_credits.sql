-- Migration 005: User Credits and Stripe Integration
-- Adds credit system for monetization with OpenRouter provisioned keys

-- Add credits and OpenRouter provisioning columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS openrouter_key_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT;
-- Total OpenRouter limit allocated (in dollars) - used to avoid race conditions
ALTER TABLE users ADD COLUMN IF NOT EXISTS openrouter_total_limit NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_openrouter_key_hash ON users(openrouter_key_hash);

-- Credit transactions table for audit trail
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    description TEXT,
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_session ON credit_transactions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- Unique constraint on stripe_session_id for idempotency (only for purchase transactions)
-- This prevents double-crediting from webhook retries
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_stripe_session_unique
    ON credit_transactions(stripe_session_id)
    WHERE stripe_session_id IS NOT NULL;

-- Credit packs table for configurable pricing
CREATE TABLE IF NOT EXISTS credit_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    openrouter_credit_limit NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_packs_active ON credit_packs(is_active, sort_order);

-- Insert default credit packs
INSERT INTO credit_packs (name, credits, price_cents, openrouter_credit_limit, sort_order) VALUES
    ('Starter Pack', 10, 500, 2.00, 1),
    ('Value Pack', 50, 2000, 10.00, 2),
    ('Pro Pack', 150, 5000, 30.00, 3)
ON CONFLICT DO NOTHING;
