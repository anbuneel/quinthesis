# AGENTS.md - Technical Notes for Quinthesis

## Project: Quinthesis
A multi-AI deliberation platform where multiple LLMs collaboratively answer questions with anonymized peer review. The name combines "quintessence" (the purest essence) with "synthesis" (combining ideas).

**Primary goal:** Learn to use AI agents (Claude Code, Codex) to build a full-stack SaaS application from scratch.

Status: Production application deployed on Vercel (frontend), Fly.io (backend), and Supabase (database).

This file and CLAUDE.md should stay in sync.

---

## Documentation Rules

- **Always update `docs/INDEX.md`** when creating or updating any document in the `docs/` folder
- Keep INDEX.md organized chronologically with brief descriptions

---

## Quick Start Commands

### Backend
```bash
uv sync                          # Install dependencies
uv run python -m backend.main    # Run backend on port 8080 (local dev)
```

### Frontend
```bash
cd frontend
npm install                      # Install dependencies
npm run dev                      # Run on http://localhost:5173
```

### Both (One Command)
```bash
./start.sh                       # Runs both backend and frontend in parallel
```

---

## Environment Setup

Create `.env` in project root:
```
# Database (required for production)
DATABASE_URL=postgresql://user:pass@host/dbname

# JWT Authentication (required)
JWT_SECRET=your-secure-random-secret-here

# API Key Encryption (required for production)
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Supports comma-separated keys for rotation (newest first): "new-key,old-key"
API_KEY_ENCRYPTION_KEY=your-fernet-key-here
# Optional: monotonic key version (increment when you rotate keys)
API_KEY_ENCRYPTION_KEY_VERSION=1

# OAuth Configuration (required for production)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
OAUTH_REDIRECT_BASE=http://localhost:5173  # or https://your-frontend.vercel.app

# CORS origins
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://your-vercel-frontend.vercel.app

# Stripe Configuration (for credit purchases)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenRouter Provisioning (for per-user API keys)
OPENROUTER_PROVISIONING_KEY=sk-or-prov-...

# Sentry (for error tracking and monitoring - optional but recommended)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**Authentication:** Users sign in via Google or GitHub OAuth. Existing users are linked by email address to preserve their archives.

**Monetization (Usage-Based Billing):** Users have two options:
1. **Credits Mode:** Users deposit funds via Stripe ($1/$2/$5/$10 options). Each query is charged at actual OpenRouter cost + 10% margin. Costs are calculated after query completion using OpenRouter's generation API.
2. **BYOK Mode (Bring Your Own Key):** Users can provide their own OpenRouter API key to bypass the credit system entirely. They pay OpenRouter directly for API usage with no margin added.

**Database Migrations:** Run before first use:
```bash
uv run python -m backend.migrate
```

Note: If `DATABASE_URL` is not set, backend falls back to local JSON storage in `data/conversations/`.

---

## Deployment Architecture

### Frontend (Vercel)
- Build Command: `npm run build` (via `vercel.json`)
- Output: `dist/` directory (Vite bundle)
- Environment Variables: `VITE_API_BASE=https://your-fly-backend.fly.dev`
- Framework: Vite + React
- Rewrite Rules: SPA routing (`/(.*) -> /index.html`)

### Backend (Fly.io)
- App Name: `quinthesis-api`
- Region: `sjc` (San Jose)
- Port: 8080 (exposed; local dev also uses 8080)
- Server: Uvicorn with FastAPI
- Memory: 1GB shared CPU
- Health Check: `GET /` every 30s
- Auto-scaling: Min 0 machines (stops when idle)
- HTTPS: Force HTTPS enabled
- **Important:** OAuth state storage is in-memory; must run single instance (max 1 machine) until Redis is implemented

### Database (Supabase)
- Type: PostgreSQL
- Connection: Via `DATABASE_URL` environment variable
- Schema: Tables auto-created via `storage.py` migrations
- Credentials: Stored in `.env` and Fly.io/Vercel secret management

**Free Tier Analysis:** See `docs/infrastructure/infra-prod-readiness-claude.md` for limits, costs, and scaling triggers.

---

## Key File Locations

### Backend (`backend/`)
- `main.py` - FastAPI server, OAuth endpoints, billing endpoints, runs on port 8080
- `config.py` - Models, CORS, DB, JWT, OAuth, Stripe environment variables
- `oauth.py` - Google and GitHub OAuth handlers (code exchange, user info)
- `council.py` - Core logic: stage1/2/3, parsing, aggregation, returns generation IDs
- `openrouter.py` - OpenRouter API wrapper, parallel queries, cost retrieval via generation API
- `openrouter_provisioning.py` - OpenRouter Provisioning API for per-user key management
- `stripe_client.py` - Stripe Checkout and webhook handling (supports deposits and legacy credits)
- `storage.py` - PostgreSQL storage with user, OAuth, balance, and usage tracking
- `storage_local.py` - JSON file storage (fallback when `DATABASE_URL` not set)
- `database.py` - Async PostgreSQL connection pool (asyncpg)
- `auth_jwt.py` - JWT token creation and verification
- `encryption.py` - API key encryption (MultiFernet + rotation/version tracking)
- `models.py` - Pydantic schemas for OAuth, billing, and checkout endpoints
- `migrate.py` - Database migration runner
- `migrations/` - SQL migration files (011_add_key_version.sql for encryption key rotation)

### Frontend (`frontend/src/`)
- `App.jsx` - Main orchestration with BrowserRouter, OAuth callback, balance state
- `components/ChatInterface.jsx` - Main view, question display, SSE streaming, stage tabs
- `components/InquiryComposer.jsx` - Home page inquiry form with model selection
- `components/Stage1.jsx` - Expert opinions with tabbed navigation and keyboard support
- `components/Stage2.jsx` - Peer review with rankings leaderboard and tabbed evaluations
- `components/Stage3.jsx` - Final answer (lead model synthesis)
- `components/Sidebar.jsx` - Inquiry list, mobile drawer
- `components/OAuthCallback.jsx` - Handles OAuth provider redirects
- `components/Login.jsx` - OAuth login UI (Google and GitHub buttons)
- `components/Account.jsx` - Account page: balance, deposits, usage history, member info
- `components/BalanceCard.jsx` - Balance card with stats (used in Account page)
- `components/TransactionLedger.jsx` - Transaction history with expandable details
- `components/CreditBalance.jsx` - Header dollar balance indicator (links to Account page)
- `components/PaymentSuccess.jsx` - Post-checkout success page
- `components/PaymentCancel.jsx` - Checkout cancelled page
- `components/AvatarMenu.jsx` - User avatar dropdown with account/logout
- `components/Masthead.jsx` - Shared header component with variants (full, centered, minimal)
- `components/ConfirmDialog.jsx` - Custom styled confirmation/alert dialogs
- `components/DemoView.jsx` - Public demo page showing precomputed deliberations (no auth required)
- `demoData/demos.json` - Static demo data with 3 example deliberations
- `api.js` - Backend communication with OAuth auth, JWT tokens, billing API, SSE streaming
- `config.js` - Frontend constants (cost estimate, demo version) with review dates

---

## Port Configuration

- Backend (Local): 8080
- Backend (Fly.io): 8080 (exposed via HTTPS)
- Frontend (Local): 5173 (Vite default)
- Frontend (Vercel): HTTPS (auto-assigned)

Important: Changed from original 8001 to 8080 for Fly.io compatibility.

---

## Critical Implementation Notes

### Relative Imports
Always use relative imports in backend (e.g., `from .config import ...`). Run as `python -m backend.main` from project root, not from backend directory.

### Database Connection Pool
Backend uses `asyncpg` for async PostgreSQL:
- Pool created on app startup (in lifespan)
- Closed on app shutdown
- Only initialized if `DATABASE_URL` is set
- Falls back to local JSON storage if not configured

### Stage 2 Anonymization
- Models receive: `Response A`, `Response B`, etc. (not real model names)
- Backend creates mapping: `{"Response A": "openai/gpt-5.1", ...}`
- Frontend de-anonymizes for display (client-side)
- Prevents bias in peer review

### Stage 2 Prompt Format (Must Be Exact)
Models must follow this format to parse correctly:
```
1. Evaluate each response individually
2. Provide "FINAL RANKING:" header
3. Numbered list: "1. Response C", "2. Response A", etc.
4. No additional text after ranking
```

### Streaming Responses
- Backend has `/api/conversations/{id}/message/stream` endpoint (Server-Sent Events)
- Frontend `api.js` has `sendMessageStream()` with event callback
- Events: `stage1_start`, `stage1_complete`, `stage2_start`, `stage2_complete`, `stage3_start`, `stage3_complete`, `title_complete`, `complete`, `error`
- Title generation happens in parallel with stages

### Metadata Handling
- Metadata (label_to_model, aggregate_rankings) is not persisted to the database
- Only available in API responses (non-streaming and streaming)
- Frontend stores in UI state for display only
- UI uses client-side `updated_at` timestamps during streaming (not persisted)

### Markdown Rendering
All ReactMarkdown must be wrapped: `<div className="markdown-content">`

---

## Common Gotchas

1. Module errors -> Run backend as `python -m backend.main` from project root
2. CORS errors -> Update `CORS_ORIGINS` environment variable to include frontend URL
3. Database connection errors -> Verify `DATABASE_URL` format: `postgresql://user:pass@host/db`
4. API_BASE issues -> Frontend uses `VITE_API_BASE` env var; set to Fly.io backend URL in production
5. Ranking parse failures -> Fallback regex extracts any "Response X" patterns in order
6. Missing metadata -> Only available in API response, check response structure

---

## API Endpoints

### OAuth Authentication

#### GET `/api/auth/oauth/{provider}`
Get OAuth authorization URL (provider: `google` or `github`):
```json
{
  "authorization_url": "https://accounts.google.com/...",
  "state": "random-csrf-token"
}
```

#### POST `/api/auth/oauth/{provider}/callback`
Complete OAuth flow with authorization code:
```json
{
  "code": "authorization-code-from-provider",
  "state": "csrf-token"
}
```
Returns JWT tokens:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

#### POST `/api/auth/refresh`
Refresh access token using refresh token.

#### GET `/api/auth/me`
Get current user info (requires auth):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "avatar_url": "https://...",
  "oauth_provider": "google",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### DELETE `/api/auth/account`
Delete user account and all associated data (requires auth). Irreversible.
Returns:
```json
{
  "status": "ok",
  "message": "Account deleted successfully"
}
```

#### GET `/api/auth/export`
Export all user data as a ZIP file (requires auth).
Returns a ZIP archive containing:
- `data.json` - Complete data export (account, conversations, transactions, usage history, summary, schema_version)
- `conversations/*.md` - Each conversation as a Markdown file
- `conversations/index.md` - Table of contents for all conversations
- `account_summary.md` - Account overview in Markdown
- `manifest.json` - SHA-256 checksums and file sizes for integrity verification

### GET `/api/models`
Returns available models and defaults:
```json
{
  "models": ["openai/gpt-5.1", "..."],
  "default_models": ["openai/gpt-5.1", "..."],
  "default_lead_model": "google/gemini-3-pro-preview"
}
```

### POST `/api/conversations`
Create a new conversation with optional model selection:
```json
{
  "models": ["openai/gpt-5.1", "..."],
  "lead_model": "google/gemini-3-pro-preview"
}
```

### POST `/api/conversations/{id}/message`
Non-streaming request:
```json
{
  "content": "Your question here"
}
```

Response:
```json
{
  "stage1": [
    {"role": "councilor", "content": "Response 1", "model": "openai/gpt-5.1"}
  ],
  "stage2": [
    {
      "model": "google/gemini-3-pro-preview",
      "ranking": "Raw ranking text...",
      "parsed_ranking": ["C", "A", "B"]
    }
  ],
  "stage3": {"role": "chairman", "content": "Final answer..."},
  "metadata": {
    "label_to_model": {"Response A": "openai/gpt-5.1", ...},
    "aggregate_rankings": [{"model": "...", "average_rank": 1.5}, ...]
  }
}
```

### POST `/api/conversations/{id}/message/stream`
Server-Sent Events (SSE) streaming:
```
data: {"type":"stage1_start"}

data: {"type":"stage1_complete","data":[...]}

data: {"type":"stage2_start"}

data: {"type":"stage2_complete","data":[...],"metadata":{...}}

data: {"type":"stage3_start"}

data: {"type":"stage3_complete","data":{...}}

data: {"type":"title_complete","data":{"title":"..."}}

data: {"type":"complete"}
```

### Billing API (Usage-Based)

#### GET `/api/balance`
Get current dollar balance and billing info (requires auth):
```json
{
  "balance": 4.97,
  "total_deposited": 5.00,
  "total_spent": 0.03,
  "has_openrouter_key": true
}
```

#### GET `/api/deposits/options`
List available deposit options:
```json
[
  {"id": "uuid", "name": "$1 Try It", "amount_cents": 100},
  {"id": "uuid", "name": "$2 Starter", "amount_cents": 200},
  {"id": "uuid", "name": "$5 Deposit", "amount_cents": 500},
  {"id": "uuid", "name": "$10 Deposit", "amount_cents": 1000}
]
```

#### GET `/api/usage/history`
Get usage history with cost breakdowns (requires auth):
```json
[
  {
    "id": "uuid",
    "conversation_id": "uuid",
    "openrouter_cost": 0.0234,
    "margin_cost": 0.0023,
    "total_cost": 0.0257,
    "model_breakdown": {"openai/gpt-4o": 0.015, "anthropic/claude-3.5-sonnet": 0.008},
    "created_at": "2026-01-01T12:00:00Z"
  }
]
```

#### POST `/api/deposits/checkout`
Create Stripe Checkout session for deposit (requires auth):
```json
{
  "option_id": "uuid",
  "success_url": "https://example.com/credits/success",
  "cancel_url": "https://example.com/credits/cancel"
}
```
Returns:
```json
{
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_..."
}
```

### BYOK API (Bring Your Own Key)

#### GET `/api/settings/api-mode`
Get user's current API mode (requires auth):
```json
{
  "mode": "byok",  // or "credits"
  "has_byok_key": true,
  "byok_key_preview": "...abc123",
  "byok_validated_at": "2026-01-01T12:00:00Z",
  "has_provisioned_key": true,
  "balance": 4.97
}
```

#### POST `/api/settings/byok`
Set BYOK OpenRouter API key (validates key first, requires auth):
```json
{
  "api_key": "sk-or-v1-..."
}
```
Returns mode info on success.

#### DELETE `/api/settings/byok`
Remove BYOK key and switch back to credits mode (requires auth).

### Credits API (Legacy)

#### GET `/api/credits`
Get current credit balance (legacy endpoint, requires auth):
```json
{
  "credits": 10
}
```

#### POST `/api/credits/provision-key`
Retry OpenRouter key provisioning (for users with credits but no key):
```json
{
  "status": "ok",
  "message": "OpenRouter key provisioned successfully"
}
```

#### POST `/api/webhooks/stripe`
Stripe webhook endpoint (signature verified). Handles `checkout.session.completed` events for both deposits and legacy credits.

---

## Data Flow

```
User Query
  -> Stage 1: Parallel queries to all models -> individual responses
  -> Stage 2: Anonymize -> parallel ranking queries -> evaluations + parsed rankings
  -> Calculate aggregate rankings (avg position)
  -> Stage 3: Lead model synthesizes with full context
  -> Return all stages + metadata to frontend (streaming or non-streaming)
  -> Frontend displays conversation entries, leaderboard, final answer
  -> Save to Supabase database (via storage.py)
```

All stages are async/parallel where possible to minimize latency.

---

## Model Configuration

Edit `backend/config.py`:
```python
AVAILABLE_MODELS = [
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4",
]

DEFAULT_MODELS = list(AVAILABLE_MODELS)

DEFAULT_LEAD_MODEL = "google/gemini-3-pro-preview"
```

Use OpenRouter model identifiers. Verify with `test_openrouter.py` before adding.

---

## Storage

### Production (Supabase PostgreSQL)
- Enabled when `DATABASE_URL` is set
- Uses `storage.py` with asyncpg connection pool
- Conversation schema: `{id, created_at, title, models[], lead_model, messages[]}`
- Message schema:
  - User: `{role, content}`
  - Assistant: `{role, stage1, stage2, stage3}`

### Development (Local JSON)
- Default fallback if `DATABASE_URL` not set
- JSON files in `data/conversations/{id}.json`
- User data in `data/users/` and `data/api_keys/`
- Uses `storage_local.py`
- Same async interface as PostgreSQL version

---

## Error Handling

- Graceful degradation: If one model fails, continue with others
- Never fail entire request due to single model failure
- Log errors but do not expose to user unless all models fail
- Streaming errors sent as `{"type":"error","message":"..."}`

---

## Design Theme: The Paper of Record

An editorial/newspaper-inspired light theme that treats Quinthesis as a prestigious publication.

### Color Palette
- Paper tones: `--paper-cream` (#FAF8F5), `--paper-aged` (#F5F0E8)
- Ink tones: `--ink-black` (#1A1614), `--ink-dark` (#2D2926)
- Accents: `--accent-vermillion` (#C43D2E), `--accent-forest` (#2D5A3D), `--accent-ochre` (#C4943D)

### Typography
- Display: Playfair Display (headlines, Final Answer)
- Body: Source Serif 4 (readable article text)
- UI: IBM Plex Sans (labels, buttons)
- Mono: IBM Plex Mono (code, model identifiers)

### Design Philosophy
- "Answer-First" hierarchy: Stage 3 (Final Answer) is the hero with editorial flourishes (drop cap, two-column layout)
- Supporting details as secondary: Stage 1 & 2 are collapsed by default
- Editorial conventions: Double-rule borders, pull-quote questions, masthead styling
- Warm, authoritative feel inspired by The Economist and The New York Times

### Design Docs
- `docs/design/ui-redesign-proposal.md` - Full design proposal
- `docs/design/ui-ux-review.md` - Latest UI/UX review and recommendations

## UX Features (Latest Implementation)

### Two-Pane Layout
- Left pane shows prior conversations (Archive drawer)
- Right pane shows the inquiry with question, final answer, and collapsible Stage 1/2 details
- Stage 1/2 are collapsed by default; Stage 3 is always prominent

### Sticky Header + Input
- Question header stays pinned within each inquiry view
- Status pill and last-updated line shown under the question
- Input stays sticky at the bottom of the main pane

### Header User Controls
- Avatar menu dropdown in masthead (top-right) with user initial
  - Shows email, Settings button, and Logout option
  - Closes on Escape key or clicking outside
- "New Inquiry" button in masthead when viewing existing conversation
- Settings modal auto-opens for new users without API key

### Archive Sidebar
- Search box to filter conversations by title
- Date-based grouping: Today, Yesterday, This Week, This Month, Older
- Collapsible sections with item counts
- Conversations only appear after first response (prevents empty entries)

### Mobile Drawer + Accessibility
- Sidebar becomes a drawer on mobile with overlay
- Escape key closes the drawer
- Stage 1 tabs support Arrow/Home/End keys
- Toggle buttons use `aria-expanded` and `aria-controls`

### Keyboard Shortcuts
- `Ctrl/Cmd + K` - Toggle archive drawer
- `Ctrl/Cmd + N` - New conversation
- `Escape` - Close drawer or modal

### Loading States
- Skeleton loaders with shimmer animation for Stage 3, Stage 1, and Stage 2
- Status text with spinner during each stage
- Staggered reveal animations on page load

### Custom Dialogs
- ConfirmDialog component replaces browser confirm/alert modals
- Editorial styling with support for danger/alert variants
- Focus trap and keyboard navigation (Escape, Enter, Tab)

### Demo Mode (Launch Readiness)
- Public `/demo` route accessible without authentication
- Shows 3 precomputed example deliberations with full Stage 1/2/3 data
- Users can browse demos to understand product value before signing up
- Login page prominently links to demos ("See example deliberations")
- Demo data stored in `frontend/src/demoData/demos.json`

**Updating Demo Data:**
1. Edit `frontend/src/demoData/demos.json` with new deliberations
2. Update `DEMO_VERSION` in `frontend/src/config.js` (increment version, update date)
3. Ensure model names match current `AVAILABLE_MODELS` in `backend/config.py`
4. Test locally: visit `/demo` and verify all tabs render correctly

### Cost Preview
- Static "Typical cost: $0.05–0.20" shown before query submission
- Helps users understand pricing before committing

### Deposit Options
- $1, $2, $5, $10 tiers (lower barrier to entry)
- Stored in `deposit_options` database table

---

## Quick Links

- GitHub: https://github.com/anbuneel/quinthesis
- Frontend (Vercel): https://quinthesis.vercel.app
- Backend (Fly.io): https://quinthesis-api.fly.dev (health check at `GET /`)

---

## Testing & Verification

Run `test_openrouter.py` to verify API connectivity and test model identifiers.

---

## Deployment Checklist

### OAuth App Setup
- [ ] **Google Cloud Console** (https://console.cloud.google.com/apis/credentials)
  - Create OAuth 2.0 Client ID (Web application)
  - Add redirect URIs: `http://localhost:5173/auth/callback/google` (dev), `https://your-frontend.vercel.app/auth/callback/google` (prod)
- [ ] **GitHub Developer Settings** (https://github.com/settings/developers)
  - Create OAuth App
  - Set callback URLs: `http://localhost:5173/auth/callback/github` (dev), `https://your-frontend.vercel.app/auth/callback/github` (prod)

### Vercel (Frontend)
- [ ] Set `VITE_API_BASE` environment variable to Fly.io backend URL
- [ ] Set `VITE_SENTRY_DSN` environment variable (optional, for error tracking)
- [ ] Verify `vercel.json` has correct build command and output directory
- [ ] Test SPA routing (all paths redirect to `/index.html`)

### Fly.io (Backend)
- [ ] Set `JWT_SECRET` in Fly.io secrets (required)
- [ ] Set `API_KEY_ENCRYPTION_KEY` in Fly.io secrets (required)
- [ ] Set `API_KEY_ENCRYPTION_KEY_VERSION` when rotating keys (optional)
- [ ] Set OAuth secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- [ ] Set `OAUTH_REDIRECT_BASE` to Vercel frontend URL
- [ ] Set `DATABASE_URL` pointing to Supabase PostgreSQL
- [ ] Set `CORS_ORIGINS` to include Vercel frontend URL
- [ ] Set `SENTRY_DSN` in Fly.io secrets (optional, for error tracking)
- [ ] Verify `fly.toml` configuration (port 8080, region, memory)
- [ ] Test health check endpoint: `GET /`
- [ ] Run database migrations: `uv run python -m backend.migrate`

### Supabase
- [ ] Create PostgreSQL database
- [ ] Generate connection string and set as `DATABASE_URL`
- [ ] Enable `gen_random_uuid()` extension (usually enabled by default)
- [ ] Run migrations (includes 006_usage_based_billing.sql for usage-based billing)

### Stripe Setup (for deposits)
- [ ] Create Stripe account at https://stripe.com
- [ ] Get API keys from https://dashboard.stripe.com/apikeys
- [ ] Set `STRIPE_SECRET_KEY` in Fly.io secrets
- [ ] Add webhook endpoint: `https://quinthesis-api.fly.dev/api/webhooks/stripe`
- [ ] Select event: `checkout.session.completed`
- [ ] Copy webhook signing secret and set as `STRIPE_WEBHOOK_SECRET`
- [ ] Test with Stripe CLI: `stripe listen --forward-to localhost:8080/api/webhooks/stripe`
- [ ] Deposit options are $1, $2, $5, $10 (configured via migrations 009-010)

### OpenRouter Provisioning (for per-user API keys)
- [ ] Go to https://openrouter.ai/settings/provisioning-keys
- [ ] Create a provisioning key (not a regular API key)
- [ ] Set `OPENROUTER_PROVISIONING_KEY` in Fly.io secrets
- [ ] Add credits to your OpenRouter account (this is the pool for all users)
- [ ] Monitor usage at https://openrouter.ai/activity

### Sentry (for error tracking - recommended)
- [ ] Create Sentry account at https://sentry.io
- [ ] Create a new project (select Python for backend)
- [ ] Copy DSN and set `SENTRY_DSN` in Fly.io secrets
- [ ] Create another project (select React for frontend)
- [ ] Copy DSN and set `VITE_SENTRY_DSN` in Vercel environment variables
- [ ] Configure alerts for error spikes (optional)

---

## Browser Support

Tested on latest Chrome/Firefox. Frontend uses modern React patterns (hooks, streaming SSE via EventSource API).

---

## Security Review Status

A comprehensive security review was conducted on 2025-12-28 (see `docs/security/codex-review-2025-12-28.md`).

**Completed security fixes (Phase 1 - Critical):**
- [x] OAuth state validation (server-side) - `backend/oauth_state.py`
- [x] PKCE implementation for Google OAuth (S256 code challenge)
- [x] Frontend strict state validation (fail hard on mismatch)
- [x] Fail-fast secret validation at startup - `backend/config.py:validate_secrets()`
- [x] Rate limiting (10 req/min for council queries) - `backend/rate_limit.py`
- [x] Request body size limit (1MB max)

**Completed quality fixes (Phase 2 - Medium):**
- [x] SSE parsing with proper buffering - `frontend/src/api.js`
- [x] GitHub users without verified email - explicit error handling
- [x] ORDER BY for stage response queries - consistent display order

**Completed accessibility/polish fixes (Phase 3 - Low):**
- [x] Archive items keyboard accessibility - `frontend/src/components/Sidebar.jsx`
- [x] Settings modal replaced with Account page - `frontend/src/components/Account.jsx`
- [x] Local storage API key ID fix - `backend/storage_local.py`
- [x] Documentation field name corrections - `CLAUDE.md`, `AGENTS.md`

**Launch readiness:** All Phase 1, Phase 2, and Phase 3 items are complete.

See `docs/security/security-fixes-plan.md` for the detailed implementation plan.

**Production Readiness Review (2025-12-31):**

A follow-up production readiness review was conducted by Codex (see `docs/security/production-readiness-2025-12-31.md`).

Completed fixes:
- [x] Base schema migration (`000_create_base_schema.sql`) for new deployments
- [x] Transaction safety for message persistence with `FOR UPDATE` locks
- [x] Client disconnect detection in streaming (cancels API calls, saves costs)
- [x] N+1 query optimization (batch fetch stage data: 5 queries vs 1+3*N)
- [x] Shared OpenRouter HTTP client with retry/backoff for 429/5xx
- [x] OAuth error sanitization (generic errors to client, full logs server-side)
- [x] Rate limiting on auth endpoints (OAuth callback, refresh, settings)
- [x] XSS protection via `rehype-sanitize` on all markdown rendering
- [x] SSE keepalive pings every 15s (prevents proxy timeouts)

Deferred/Accepted:
- [ ] Redis for OAuth state/rate limiting (needed before autoscaling)
- [x] Content-Length bypass - accepted (low risk, defense in depth)
- [x] JWTs in localStorage - accepted (standard SPA, CSP is better mitigation)
- [x] Blocking file I/O in local storage - accepted (dev-only)

**Billing System Security Review (2025-12-31):**

A security review of the Stripe billing implementation was conducted.

Completed fixes:
- [x] Payment status verification (check `payment_status == "paid"`)
- [x] Webhook idempotency via unique constraint on `stripe_session_id`
- [x] Session verification from Stripe API (don't trust webhook metadata alone)
- [x] Amount/currency validation against pack/deposit price
- [x] Balance check before query (minimum $0.50)
- [x] No upfront charge - cost deducted only on successful completion
- [x] Atomic OpenRouter limit increment (prevents race conditions)
- [x] URL allowlisting for success/cancel redirects (prevents open redirect)
- [x] Provisioning retry endpoint for users with balance but no key
- [x] Decimal precision (NUMERIC(10,6)) for cost calculations
- [x] Local storage billing stubs for dev mode

**Usage-Based Billing Update (2026-01-01):**

Converted from credit-based (1 credit = 1 query) to usage-based billing:
- [x] Users deposit funds ($1/$2/$5/$10) instead of buying credit packs
- [x] Queries charged at actual OpenRouter cost + 10% margin
- [x] Cost calculated after completion via OpenRouter generation API
- [x] Transparent cost breakdown shown to users
- [x] Per-query usage history with model breakdowns
- [x] Minimum $0.50 balance required (no upfront charge)

**Security Review (2026-01-01):**

Follow-up review by Codex (see `docs/security/codex-review-2026-01-01.md`).

Repeat findings (already accepted/deferred):
- [x] JWTs in localStorage - accepted (standard SPA pattern, CSP is better mitigation)
- [x] In-memory rate limiting - deferred (single-instance, Redis needed before autoscaling)
- [x] Webhook metadata trust - already addressed (verifies session from Stripe API)
- [x] CORS_ORIGINS for redirect allowlist - acceptable (scheme validated)

Completed:
- [x] Rate limiting on checkout/provisioning endpoints (10 req/min via `checkout_rate_limiter`)

---

## Encryption Key Rotation

The application uses MultiFernet for API key encryption, supporting zero-downtime key rotation.

### How It Works

1. **Multiple keys**: `API_KEY_ENCRYPTION_KEY` accepts comma-separated Fernet keys (newest first)
2. **Encrypt with newest**: New encryptions always use the first (newest) key
3. **Decrypt with any**: Decryption tries all keys until one succeeds
4. **Lazy re-encryption**: When a key is accessed, it's automatically re-encrypted with the newest key
5. **Version tracking**: `API_KEY_ENCRYPTION_KEY_VERSION` tracks the current generation (optional but recommended)

### When to Rotate

- Suspected key compromise or accidental exposure
- Production access changes (new operator, vendor, or CI secret exposure)
- On a scheduled cadence (e.g., every 6–12 months)

### Rotation Procedure

1. **Generate a new key:**
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

2. **Update the environment variable** (prepend new key):
   ```bash
   # Before: API_KEY_ENCRYPTION_KEY=old-key
   # After:  API_KEY_ENCRYPTION_KEY=new-key,old-key
   fly secrets set API_KEY_ENCRYPTION_KEY="new-key,old-key"
   ```

3. **Bump key version** (recommended for monotonic tracking):
   ```bash
   fly secrets set API_KEY_ENCRYPTION_KEY_VERSION=2
   ```

4. **Deploy**: The app will immediately use the new key for all new encryptions

5. **Lazy migration**: Existing keys are automatically re-encrypted when accessed

6. **Remove old key** (after all keys have been accessed/rotated):
   ```bash
   fly secrets set API_KEY_ENCRYPTION_KEY="new-key"
   ```

### Key Version Tracking

- `user_api_keys.key_version` - Tracks encryption version for legacy API keys
- `users.byok_key_version` - Tracks encryption version for BYOK keys
- `users.openrouter_key_version` - Tracks encryption version for provisioned OpenRouter keys
- Version is set to the current key generation when rotated (not incremented per access)

### Migrations 011-012

Run `uv run python -m backend.migrate` to add key version columns.

---

## Development Lessons Learned

### Database Schema Verification (2026-01-02)

When writing database queries, always verify the schema first:

1. **Read migration files before writing SQL** - Don't assume column names exist. The stage tables (`stage1_responses`, `stage2_rankings`, `stage3_synthesis`) use `message_id`, not `conversation_id`.

2. **Verify table names** - The transactions table is named `credit_transactions`, not `transactions`. Check migrations before referencing tables.

3. **Check imports when using new symbols** - Using `timezone.utc` requires `from datetime import datetime, timezone`, not just `datetime`.

4. **Update both storage implementations** - This project has `storage.py` (PostgreSQL) and `storage_local.py` (JSON fallback). New functions must be added to both.

5. **Verify claims in documentation** - The privacy policy claimed IPs were "not logged" but they're used for rate limiting. Always verify documentation accuracy against actual code behavior.
