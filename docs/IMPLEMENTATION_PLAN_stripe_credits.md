# Implementation Plan: Credit-Based Monetization with Stripe + OpenRouter Provisioning

> **SUPERSEDED**: This plan has been replaced by usage-based billing. See [IMPLEMENTATION_PLAN_usage_based_billing.md](IMPLEMENTATION_PLAN_usage_based_billing.md) for the current billing model.
>
> The credit-based system (1 credit = 1 query) was replaced with transparent usage-based billing (actual OpenRouter cost + 10% margin) as of 2026-01-01.

## Summary (Historical)
Remove BYOK requirement. Users purchase credit packs via Stripe. Each user gets a **dedicated OpenRouter API key** (via Provisioning API) with spending limits. Compliant with OpenRouter ToS for SaaS platforms.

---

## Architecture Overview

```
User buys credits (Stripe)
  → Backend creates/updates OpenRouter provisioned key with credit limit
  → User queries use their dedicated provisioned key
  → OpenRouter enforces spending limit per key
```

**Why Provisioning API?**
- OpenRouter ToS prohibits "selling access" - provisioned keys are explicitly supported for SaaS
- Per-user spending limits enforced by OpenRouter
- Better isolation and usage tracking

---

## Phase 1: Database Schema

**New migration**: `backend/migrations/005_user_credits.sql`

```sql
-- Add credits and OpenRouter provisioning to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS openrouter_key_hash VARCHAR(255);  -- For provisioning API calls
ALTER TABLE users ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT;  -- Encrypted, for actual API calls

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_openrouter_key_hash ON users(openrouter_key_hash);

-- Transaction audit trail
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,  -- 'purchase', 'usage', 'refund', 'bonus'
    description TEXT,
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_session ON credit_transactions(stripe_session_id);

-- Credit packs (configurable pricing)
CREATE TABLE IF NOT EXISTS credit_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    openrouter_credit_limit NUMERIC(10,2),  -- OpenRouter credit limit in dollars
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default packs (price includes margin over OpenRouter costs)
INSERT INTO credit_packs (name, credits, price_cents, openrouter_credit_limit, sort_order) VALUES
    ('Starter Pack', 10, 500, 2.00, 1),    -- $5 for 10 queries (~$2 OpenRouter limit)
    ('Value Pack', 50, 2000, 10.00, 2),    -- $20 for 50 queries (~$10 OpenRouter limit)
    ('Pro Pack', 150, 5000, 30.00, 3)      -- $50 for 150 queries (~$30 OpenRouter limit)
ON CONFLICT DO NOTHING;
```

---

## Phase 2: Backend Changes

### 2.1 Configuration (`backend/config.py`)

```python
# Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# OpenRouter Provisioning (NOT a regular API key)
OPENROUTER_PROVISIONING_KEY = os.getenv("OPENROUTER_PROVISIONING_KEY")
```

### 2.2 New OpenRouter Provisioning Module (`backend/openrouter_provisioning.py`)

```python
"""OpenRouter Provisioning API for per-user key management."""

PROVISIONING_BASE_URL = "https://openrouter.ai/api/v1/keys"

async def create_user_key(user_id: str, name: str, limit_dollars: float) -> dict:
    """Create a provisioned API key for a user.

    Returns: {"key": "sk-or-...", "hash": "abc123", "limit": 200}
    """
    # POST /api/v1/keys with name and limit
    pass

async def update_key_limit(key_hash: str, new_limit_dollars: float) -> dict:
    """Update spending limit on existing key.

    Called when user buys more credits.
    """
    # PATCH /api/v1/keys/{keyHash}
    pass

async def get_key_usage(key_hash: str) -> dict:
    """Get current usage for a key."""
    # GET /api/v1/keys/{keyHash}
    pass

async def disable_key(key_hash: str) -> None:
    """Disable a key (e.g., when credits exhausted)."""
    # PATCH /api/v1/keys/{keyHash} with disabled=true
    pass
```

### 2.3 Storage Functions (`backend/storage.py`)

Add:
- `get_user_credits(user_id)` - Get balance
- `add_credits(user_id, amount, type, ...)` - Add credits + record transaction
- `consume_credit(user_id)` - Atomic decrement
- `get_user_openrouter_key(user_id)` - Get provisioned key (decrypted)
- `save_user_openrouter_key(user_id, key, hash)` - Store provisioned key
- `get_active_credit_packs()` - List packs
- `was_session_processed(session_id)` - Idempotency check

### 2.4 Stripe Module (`backend/stripe_client.py`)

- `create_checkout_session()` - Stripe Checkout for credit purchase
- `verify_webhook_signature()` - Verify webhook
- `is_stripe_configured()` - Check config

### 2.5 New API Endpoints (`backend/main.py`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/credits` | GET | Get credit balance |
| `/api/credits/packs` | GET | List credit packs |
| `/api/credits/history` | GET | Transaction history |
| `/api/credits/checkout` | POST | Create Stripe Checkout session |
| `/api/webhooks/stripe` | POST | Handle Stripe webhook |

### 2.6 Webhook Handler Flow

When `checkout.session.completed` received:
1. Verify signature
2. Check idempotency (session_id not already processed)
3. Get user and pack from metadata
4. If user has no OpenRouter key:
   - Call `create_user_key()` with initial limit
   - Encrypt and store key + hash
5. Else:
   - Get current limit via `get_key_usage()`
   - Call `update_key_limit()` to increase limit
6. Add credits to user balance
7. Record transaction

### 2.7 Modify Query Endpoints

Update `send_message` and `send_message_stream`:

1. Check credits: `consume_credit(user_id)` - return 402 if insufficient
2. Get user's provisioned key: `get_user_openrouter_key(user_id)`
3. If no key exists, return 402 "Please purchase credits"
4. Pass user's key to `query_models_parallel()`

---

## Phase 3: Frontend Changes

### 3.1 API Client (`frontend/src/api.js`)

```javascript
export const credits = {
  getBalance(),
  getPacks(),
  getHistory(),
  purchasePack(packId)  // Redirects to Stripe Checkout
};
```

### 3.2 Transform Settings.jsx

Replace API key management with:
- Credit balance display (prominent)
- Credit packs with "Buy" buttons
- Transaction history (collapsible)

### 3.3 New Components

- `CreditBalance.jsx` - Header balance display
- `PaymentSuccess.jsx` - Post-checkout success
- `PaymentCancel.jsx` - Checkout cancelled

### 3.4 Update App.jsx

- Add credit state
- Add routes: `/credits/success`, `/credits/cancel`
- Handle 402 errors → open Settings modal

---

## Phase 4: Environment Variables

### Fly.io (Backend)
```bash
fly secrets set STRIPE_SECRET_KEY=sk_live_...
fly secrets set STRIPE_WEBHOOK_SECRET=whsec_...
fly secrets set OPENROUTER_PROVISIONING_KEY=sk-or-prov-...
fly secrets set API_KEY_ENCRYPTION_KEY=<fernet-key>  # For encrypting provisioned keys
```

### Vercel (Frontend)
No new variables needed (Stripe Checkout is redirect-based).

---

## Phase 5: External Setup

### OpenRouter Setup
1. Go to https://openrouter.ai/settings/provisioning-keys
2. Create a provisioning key
3. Copy to `OPENROUTER_PROVISIONING_KEY`
4. Add credits to your OpenRouter account (this is the "pool" for all users)

### Stripe Setup
1. Create Stripe account
2. Add webhook: `https://ai-council-api.fly.dev/api/webhooks/stripe`
3. Select event: `checkout.session.completed`
4. Copy signing secret

---

## Critical Files

| File | Changes |
|------|---------|
| `backend/migrations/005_user_credits.sql` | **New** |
| `backend/openrouter_provisioning.py` | **New** |
| `backend/stripe_client.py` | **New** |
| `backend/config.py` | Add Stripe + provisioning config |
| `backend/models.py` | Add credit/checkout schemas |
| `backend/storage.py` | Add credit + provisioned key functions |
| `backend/main.py` | Add endpoints, modify query to use user's key |
| `frontend/src/api.js` | Add credits module |
| `frontend/src/components/Settings.jsx` | Credits UI |
| `frontend/src/components/Settings.css` | Credits styles |
| `frontend/src/components/CreditBalance.jsx` | **New** |
| `frontend/src/components/PaymentSuccess.jsx` | **New** |
| `frontend/src/components/PaymentCancel.jsx` | **New** |
| `frontend/src/App.jsx` | Credit state, routes |

---

## Security Considerations

1. **Webhook signature** - Always verify Stripe signatures
2. **Idempotency** - Check `stripe_session_id` before crediting
3. **Key encryption** - Encrypt provisioned keys at rest (Fernet)
4. **Atomic credits** - Use `UPDATE ... WHERE credits > 0 RETURNING`
5. **OpenRouter limits** - Provisioned keys have hard spending limits

---

## Implementation Order

1. Database migration
2. Config variables
3. OpenRouter provisioning module
4. Stripe module
5. Storage credit functions
6. Backend endpoints + webhook
7. Modify query endpoints
8. Frontend API client
9. Frontend Settings transformation
10. Frontend new components
11. OpenRouter + Stripe dashboard setup
12. Test with Stripe test mode
13. Deploy

---

## Testing

```bash
# Local Stripe webhook forwarding
stripe listen --forward-to localhost:8080/api/webhooks/stripe

# Test card
4242424242424242
```

---

## Cost Model

Your margin = `price_cents` - OpenRouter actual cost

Example with Starter Pack ($5 for 10 queries):
- You charge: $5
- OpenRouter limit set: $2 (covers ~10 queries at ~$0.15-0.20 each)
- Your margin: ~$3

Adjust `openrouter_credit_limit` based on actual model costs.
