# Data Storage Reference

What user data Quinthesis stores and how it's handled.

---

## User Account Data

| Field | Source | Purpose |
|-------|--------|---------|
| `email` | OAuth (Google/GitHub) | Identification, account linking |
| `name` | OAuth | Display name |
| `avatar_url` | OAuth | Profile picture URL |
| `oauth_provider` | OAuth | "google" or "github" |
| `oauth_provider_id` | OAuth | Provider's unique user ID |
| `created_at` | System | Account creation timestamp |
| `updated_at` | System | Last modification timestamp |

---

## Financial Data

| Field | Purpose |
|-------|---------|
| `balance` | Current dollar balance (NUMERIC precision) |
| `total_deposited` | Lifetime deposit total |
| `total_spent` | Lifetime spending total |
| `stripe_customer_id` | Stripe customer reference (for repeat purchases) |
| `openrouter_key_hash` | Hash of system-provisioned OpenRouter key |
| `openrouter_total_limit` | Spending limit allocated on OpenRouter |

---

## BYOK (Bring Your Own Key)

If a user provides their own OpenRouter API key:

| Field | Purpose |
|-------|---------|
| `encrypted_key` | Fernet-encrypted OpenRouter API key |
| `key_hint` | Last 6 characters for display ("...abc123") |
| `byok_validated_at` | When the key was last validated |

**Security:** Keys are encrypted at rest using Fernet symmetric encryption. The encryption key is stored as an environment variable, never in code or database.

---

## Conversation Data

| Table | Data Stored |
|-------|-------------|
| `conversations` | ID, title, timestamps, selected models, lead model |
| `messages` | User questions (role='user'), ordering |
| `stage1_responses` | Individual model opinions (model name, response text) |
| `stage2_rankings` | Peer review evaluations (model name, ranking text, parsed ranking) |
| `stage3_synthesis` | Final synthesized answer (model name, response text) |

**Retention:** Conversations are stored indefinitely. No automatic deletion.

---

## Transaction History

### Deposits
| Field | Purpose |
|-------|---------|
| `amount` | Deposit amount in dollars |
| `transaction_type` | "deposit" |
| `stripe_session_id` | Stripe checkout session reference |
| `stripe_payment_intent_id` | Stripe payment intent reference |
| `created_at` | Transaction timestamp |

### Query Costs
| Field | Purpose |
|-------|---------|
| `conversation_id` | Which conversation |
| `openrouter_cost` | Actual cost from OpenRouter |
| `margin_cost` | 10% margin added |
| `total_cost` | Total charged to user balance |
| `model_breakdown` | Cost per model (JSON) |
| `generation_ids` | OpenRouter generation IDs for audit |

---

## What We DON'T Store

| Data | Reason |
|------|--------|
| Passwords | OAuth-only authentication |
| Credit card numbers | Handled entirely by Stripe |
| Raw API keys | Only encrypted (BYOK) or hashed (provisioned) |
| IP addresses | Not logged or stored |
| Browser fingerprints | Not collected |

---

## Third-Party Data Sharing

### OpenRouter
- **What:** User queries and conversation context
- **Why:** Required to get LLM responses
- **Flow:** Query → OpenRouter API → LLM provider (OpenAI, Google, Anthropic, etc.)

### Stripe
- **What:** Email, payment info
- **Why:** Process deposits
- **Note:** Credit card data never touches our servers

### OAuth Providers (Google/GitHub)
- **What:** Email, name, avatar URL
- **Why:** Authentication
- **Note:** We only receive what user authorizes

---

## Data Locations

| Data | Location |
|------|----------|
| User accounts | Supabase PostgreSQL |
| Conversations | Supabase PostgreSQL |
| Encrypted keys | Supabase PostgreSQL |
| Payment processing | Stripe (external) |
| LLM queries | OpenRouter → various providers (external) |

---

## Security Measures

- **Encryption at rest:** Supabase handles database encryption
- **API key encryption:** Fernet symmetric encryption
- **Transport:** HTTPS only (enforced)
- **Authentication:** OAuth 2.0 with PKCE
- **Session tokens:** JWT with 30-minute expiry + refresh tokens

---

## Data Export & Deletion

### Export (Data Portability)
- **Endpoint:** `GET /api/auth/export` (authenticated)
- **Format:** ZIP archive containing:
  - `data.json` (account, conversations, transactions, usage history, summary, schema_version)
  - `account_summary.md` (human-readable account summary)
  - `conversations/*.md` (one Markdown file per conversation)
  - `conversations/index.md` (table of contents)
  - `manifest.json` (SHA-256 checksums + file sizes for integrity)
- **Exclusions:** Decrypted API keys are never included in exports.

### Deletion (Account Offboarding)
- **Endpoint:** `DELETE /api/auth/account` (authenticated)
- **Deletes:** query costs, stage responses, messages, conversations, credit transactions, API keys, and the user record (transactional).
- **Post-delete:** Best-effort revocation of provisioned OpenRouter keys (if configured).
- **External services:** OAuth accounts (Google/GitHub) and Stripe customer records are not deleted by this endpoint.

---

## User Rights

| Right | Status |
|-------|--------|
| View data | Available (Account page, conversation history) |
| Export data | Available (Account page > Data & Privacy) |
| Delete account | Available (Account page > Data & Privacy) |
| Delete conversations | Available (Archive sidebar) |

---

*Last updated: 2026-01-03*
