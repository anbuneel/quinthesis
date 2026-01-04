# OpenRouter Provisioning Keys

How Quinthesis uses OpenRouter's Provisioning API to manage per-user API keys.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR OPENROUTER ACCOUNT                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Provisioning Key (sk-or-prov-...)                          │ │
│  │  - Master key that can create child keys                    │ │
│  │  - Your OpenRouter balance funds ALL child keys             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│              creates/manages │                                   │
│                              ▼                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ User A   │  │ User B   │  │ User C   │  ... per-user keys    │
│  │ Key      │  │ Key      │  │ Key      │                       │
│  │ limit:$5 │  │ limit:$2 │  │ limit:$10│                       │
│  └──────────┘  └──────────┘  └──────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Provisioning Key** | Your master key (`sk-or-prov-...`) that creates child keys |
| **Child Key** | Per-user API key with its own spending limit |
| **Limit** | Max $ the child key can spend (enforced by OpenRouter) |
| **Your Balance** | Funds all child keys - you pay OpenRouter directly |

## When Keys Are Created

Keys are created on **first deposit**, not on signup:

| Event | What Happens | Key Created? |
|-------|--------------|--------------|
| User signs up | Account created, balance = $0 | No |
| User deposits $5 | Stripe webhook → `create_user_key()` | **Yes** |
| User deposits again | `update_key_limit()` increases limit | No (same key) |
| User deletes account | `delete_key()` removes it | Key deleted |

## Flow: User Deposits → Query

1. **User deposits $5** → Stripe webhook fires
2. **Backend creates/updates child key** with `limit += $5`
3. **User queries** → Backend uses their child key to call OpenRouter
4. **OpenRouter enforces limit** → Rejects if over budget
5. **After query** → Backend fetches actual cost via Generation API, updates local balance

## Usage Tracking (Two Layers)

### 1. OpenRouter-side (automatic)

```python
# Get usage from OpenRouter
key_info = await get_key_info(key_hash)
# Returns: {"usage": 3.45, "limit": 5.00, ...}
```

### 2. Quinthesis-side (detailed)

```
query_costs table:
- user_id, conversation_id
- openrouter_cost, margin_cost, total_cost
- model_breakdown (JSON: {"gpt-4": 0.05, "claude": 0.03})
- generation_ids (for audit trail)
```

## Two Balance Systems

| System | Purpose | Source of Truth |
|--------|---------|-----------------|
| **OpenRouter limit** | Hard spending cap (safety) | OpenRouter enforces |
| **Quinthesis balance** | Your tracking + margin calculation | `users.balance` in DB |

They should stay roughly in sync, but Quinthesis balance is what users see and what you use for billing.

## Where to See Usage

| View | Location |
|------|----------|
| **User's Account page** | Shows balance, deposits, per-query costs |
| **OpenRouter Dashboard** | https://openrouter.ai/activity - see all API calls |
| **Provisioned Keys** | https://openrouter.ai/settings/provisioning-keys |
| **Database** | `query_costs` and `credit_transactions` tables |

## OpenRouter Dashboard View

At `https://openrouter.ai/settings/provisioning-keys`, you'll see child keys named like:

```
Quinthesis User (user:550e8400-e29b-41d4-a716-446655440000)
Quinthesis User (user:6ba7b810-9dad-11d1-80b4-00c04fd430c8)
...
```

Each shows:
- **Limit**: Total $ they've deposited
- **Usage**: How much they've spent via OpenRouter
- **Status**: Active/Disabled

## BYOK Users

BYOK (Bring Your Own Key) users **don't get a provisioned key** — they use their own OpenRouter key directly:

- You won't see them in your provisioning dashboard
- You don't pay for their API usage
- They pay OpenRouter directly
- No margin is charged to them

## Code References

- `backend/openrouter_provisioning.py` - Provisioning API wrapper
- `backend/storage.py:864` - `get_user_openrouter_key()`
- `backend/storage.py:912` - `save_user_openrouter_key()`
- `backend/main.py:1122` - Key creation on deposit
- `backend/main.py:402` - Key deletion on account deletion

## Environment Variables

```bash
# Required for provisioning
OPENROUTER_PROVISIONING_KEY=sk-or-prov-...
```

Get your provisioning key at: https://openrouter.ai/settings/provisioning-keys

## Cost Management Tips

1. **Set daily spend alerts** on OpenRouter dashboard
2. **Monitor provisioned keys** for unusual usage patterns
3. **Keep OpenRouter balance funded** - all child keys draw from it
4. **Review `query_costs` table** for per-user spending trends
