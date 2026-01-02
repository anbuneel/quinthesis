-- Migration 009: Add $1 and $2 deposit options for lower barrier to entry

-- Delete existing options and replace with new tiers including lower amounts
DELETE FROM deposit_options;

INSERT INTO deposit_options (name, amount_cents, sort_order) VALUES
    ('$1 Try It', 100, 1),
    ('$2 Starter', 200, 2),
    ('$5 Deposit', 500, 3),
    ('$10 Deposit', 1000, 4),
    ('$20 Deposit', 2000, 5);
