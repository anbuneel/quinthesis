# Usage-Based Billing Implementation Plan

## Summary
Convert AI Council from credit-based (1 credit per query) to usage-based billing (actual OpenRouter cost + 10% margin).

## Key Changes

| Current | New |
|---------|-----|
| Credits (integer) | Balance (dollars, NUMERIC) |
| 1 credit per query | Actual OpenRouter cost + 10% |
| Credit packs ($5=10 credits) | Deposits ($5 = $5.00 balance) |
| Cost unknown | Transparent cost breakdown |

## Flow

1. User deposits $5+ via Stripe
2. User submits query (requires $0.50 minimum balance)
3. Council runs all stages, collects generation IDs
4. Query OpenRouter `/api/v1/generation?id={id}` for each generation's actual cost
5. Sum costs, add 10% margin, deduct from balance
6. Show user: OpenRouter cost, margin, total, remaining balance

## Database Changes

**New migration: `006_usage_based_billing.sql`**

```sql
-- Add dollar-based balance (6 decimal precision for small costs)
ALTER TABLE users ADD COLUMN balance NUMERIC(10,6) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN total_deposited NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN total_spent NUMERIC(10,6) NOT NULL DEFAULT 0;

-- Add cost tracking to transactions
ALTER TABLE credit_transactions ADD COLUMN openrouter_cost NUMERIC(10,6);
ALTER TABLE credit_transactions ADD COLUMN margin_cost NUMERIC(10,6);
ALTER TABLE credit_transactions ADD COLUMN total_cost NUMERIC(10,6);
ALTER TABLE credit_transactions ADD COLUMN balance_after_dollars NUMERIC(10,6);
ALTER TABLE credit_transactions ADD COLUMN generation_ids JSONB;

-- Deposit options (replaces credit_packs)
CREATE TABLE deposit_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    amount_cents INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0
);
INSERT INTO deposit_options (name, amount_cents, sort_order) VALUES
    ('$5 Deposit', 500, 1),
    ('$20 Deposit', 2000, 2),
    ('$50 Deposit', 5000, 3);

-- Per-query cost tracking for transparency
CREATE TABLE query_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    conversation_id UUID NOT NULL,
    generation_ids JSONB NOT NULL,
    openrouter_cost NUMERIC(10,6) NOT NULL,
    margin_cost NUMERIC(10,6) NOT NULL,
    total_cost NUMERIC(10,6) NOT NULL,
    model_breakdown JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- No migration needed (fresh start, no existing users with credits)
```

## Files to Modify

### Backend

1. **`backend/openrouter.py`**
   - Return `generation_id` from `query_model()` response
   - Add `get_generation_cost(generation_id)` - query OpenRouter for actual cost
   - Add `get_generation_costs_batch(generation_ids)` - parallel cost queries

2. **`backend/storage.py`**
   - `get_user_balance(user_id)` - return dollar balance
   - `add_deposit(user_id, amount_dollars, ...)` - add deposit
   - `deduct_query_cost(user_id, generation_ids, openrouter_cost, ...)` - deduct with breakdown
   - `check_minimum_balance(user_id, minimum=0.50)` - pre-query check
   - `get_deposit_options()` - list deposit tiers
   - `get_usage_history(user_id)` - cost breakdown history

3. **`backend/council.py`**
   - Update all stage functions to return `generation_ids` alongside results
   - `run_full_council()` returns `all_generation_ids` for cost calculation

4. **`backend/main.py`**
   - Check minimum balance BEFORE query
   - After query success, fetch costs via generation IDs
   - Deduct actual cost + 10% margin
   - Return cost breakdown in response
   - Update Stripe webhook for deposits

5. **`backend/models.py`**
   - `UserBalanceResponse` - balance, total_deposited, total_spent
   - `DepositOptionResponse` - id, name, amount_cents
   - `QueryCostResponse` - openrouter_cost, margin_cost, total_cost, new_balance

### Frontend

6. **`frontend/src/components/CreditBalance.jsx`**
   - Display `$X.XX` instead of credit count

7. **`frontend/src/components/Settings.jsx`**
   - Show dollar balance
   - List deposit options ($5/$20/$50)
   - Display usage history with cost breakdowns
   - Add note: "Each inquiry costs ~$0.02-0.10 depending on models"

8. **`frontend/src/api.js`**
   - Update billing API: `getBalance()`, `getDepositOptions()`, `createDeposit()`, `getUsageHistory()`

## API Response Changes

**Query response now includes:**
```json
{
  "stage1": [...],
  "stage2": [...],
  "stage3": {...},
  "metadata": {...},
  "cost": {
    "openrouter_cost": 0.0234,
    "margin_cost": 0.0023,
    "total_cost": 0.0257,
    "new_balance": 4.97
  }
}
```

## Error Handling

- **Cost query fails**: Use estimated cost based on tokens, flag for review
- **Balance goes negative**: Allow up to -$0.50, block further queries
- **Query fails**: No charge (cost calculated only on success)

## Implementation Order

1. [x] Database migration (add new columns, keep old for compatibility) - `006_usage_based_billing.sql`
2. [x] `openrouter.py` - generation ID tracking and cost retrieval
3. [x] `storage.py` - balance functions
4. [x] `council.py` - return generation IDs
5. [x] `main.py` - wire up usage-based billing
6. [x] `stripe_client.py` - pass is_deposit metadata
7. [x] `models.py` - new Pydantic schemas
8. [x] Frontend updates
   - `api.js` - new billing API
   - `CreditBalance.jsx` - dollar display
   - `Settings.jsx` - deposits and usage history
   - `App.jsx` - balance state management
   - `PaymentSuccess.jsx` - balance display
9. [ ] Test end-to-end
10. [ ] Deploy and monitor

## Status: Implementation Complete

All code changes for usage-based billing have been implemented. Next steps:
- Run database migration on production
- Test the complete flow (deposit → query → cost deduction)
- Monitor for any issues with cost calculation

---

*Sources: [OpenRouter API Reference](https://openrouter.ai/docs/api-reference), [OpenRouter Pricing](https://openrouter.ai/pricing)*
