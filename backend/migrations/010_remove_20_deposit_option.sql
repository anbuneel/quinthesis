-- Migration 010: Remove $20 deposit option (soft-delete)

UPDATE deposit_options SET is_active = false WHERE amount_cents = 2000;
