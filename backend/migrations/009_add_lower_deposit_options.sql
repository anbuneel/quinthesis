-- Migration 009: Add $1 and $2 deposit options for lower barrier to entry

-- Soft-delete existing options (safer than hard delete during active checkouts)
UPDATE deposit_options SET is_active = false WHERE is_active = true;

-- Insert new deposit tiers
INSERT INTO deposit_options (name, amount_cents, sort_order) VALUES
    ('$1 Try It', 100, 1),
    ('$2 Starter', 200, 2),
    ('$5 Deposit', 500, 3),
    ('$10 Deposit', 1000, 4),
    ('$20 Deposit', 2000, 5);
