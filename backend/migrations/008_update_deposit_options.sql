-- Migration 008: Update deposit options to $5, $10, $20

-- Delete existing options and replace with new tiers
DELETE FROM deposit_options;

INSERT INTO deposit_options (name, amount_cents, sort_order) VALUES
    ('$5 Deposit', 500, 1),
    ('$10 Deposit', 1000, 2),
    ('$20 Deposit', 2000, 3);
