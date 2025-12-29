# CLAUDE.md - Technical Notes for AI Council

## Project: AI Council
A 3-stage deliberation system where multiple LLMs collaboratively answer questions with anonymized peer review.

Status: Production application deployed on Vercel (frontend), Fly.io (backend), and Supabase (database).

This file and CLAUDE.md should stay in sync.

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
API_KEY_ENCRYPTION_KEY=your-fernet-key-here

# OAuth Configuration (required for production)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
OAUTH_REDIRECT_BASE=http://localhost:5173  # or https://your-frontend.vercel.app

# CORS origins
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://your-vercel-frontend.vercel.app

# Optional: Fallback OpenRouter API key for local dev (users provide their own in production)
OPENROUTER_API_KEY=sk-or-v1-...
```

**Authentication:** Users sign in via Google or GitHub OAuth. Existing users are linked by email address to preserve their archives. Each user provides their own OpenRouter API key in Settings.

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
- App Name: `ai-council-api`
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

---

## Key File Locations

### Backend (`backend/`)
- `main.py` - FastAPI server, OAuth endpoints, runs on port 8080
- `config.py` - Models, CORS, DB, JWT, OAuth environment variables
- `oauth.py` - Google and GitHub OAuth handlers (code exchange, user info)
- `council.py` - Core logic: stage1/2/3, parsing, aggregation
- `openrouter.py` - OpenRouter API wrapper, parallel queries, accepts per-user API keys
- `storage.py` - PostgreSQL storage with user, OAuth, and API key management
- `storage_local.py` - JSON file storage (fallback when `DATABASE_URL` not set)
- `database.py` - Async PostgreSQL connection pool (asyncpg)
- `auth_jwt.py` - JWT token creation and verification
- `encryption.py` - API key encryption (Fernet)
- `models.py` - Pydantic schemas for OAuth and API key endpoints
- `migrate.py` - Database migration runner
- `migrations/` - SQL migration files (includes 004_oauth_users.sql)

### Frontend (`frontend/src/`)
- `App.jsx` - Main orchestration with BrowserRouter, OAuth callback routing
- `components/ChatInterface.jsx` - Main view, question display, SSE streaming, stage tabs
- `components/InquiryComposer.jsx` - Home page inquiry form with model selection
- `components/Stage1.jsx` - Expert opinions with tabbed navigation and keyboard support
- `components/Stage2.jsx` - Peer review with rankings leaderboard and tabbed evaluations
- `components/Stage3.jsx` - Final answer (lead model synthesis)
- `components/Sidebar.jsx` - Inquiry list, mobile drawer
- `components/OAuthCallback.jsx` - Handles OAuth provider redirects
- `components/Login.jsx` - OAuth login UI (Google and GitHub buttons)
- `components/Settings.jsx` - API key management modal
- `components/AvatarMenu.jsx` - User avatar dropdown with settings/logout
- `components/ConfirmDialog.jsx` - Custom styled confirmation/alert dialogs
- `api.js` - Backend communication with OAuth auth, JWT tokens, SSE streaming

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

An editorial/newspaper-inspired light theme that treats AI Council as a prestigious publication.

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
- `docs/UI_REDESIGN_PROPOSAL_opus_claude.md` - Full design proposal
- `docs/UI_UX_REVIEW.md` - Latest UI/UX review and recommendations

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

---

## Quick Links

- GitHub: https://github.com/anbuneel/ai-council
- Frontend (Vercel): https://ai-council-anbs.vercel.app
- Backend (Fly.io): https://ai-council-api.fly.dev (health check at `GET /`)

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
- [ ] Verify `vercel.json` has correct build command and output directory
- [ ] Test SPA routing (all paths redirect to `/index.html`)

### Fly.io (Backend)
- [ ] Set `JWT_SECRET` in Fly.io secrets (required)
- [ ] Set `API_KEY_ENCRYPTION_KEY` in Fly.io secrets (required)
- [ ] Set OAuth secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- [ ] Set `OAUTH_REDIRECT_BASE` to Vercel frontend URL
- [ ] Set `DATABASE_URL` pointing to Supabase PostgreSQL
- [ ] Set `CORS_ORIGINS` to include Vercel frontend URL
- [ ] Verify `fly.toml` configuration (port 8080, region, memory)
- [ ] Test health check endpoint: `GET /`
- [ ] Run database migrations: `uv run python -m backend.migrate`

### Supabase
- [ ] Create PostgreSQL database
- [ ] Generate connection string and set as `DATABASE_URL`
- [ ] Enable `gen_random_uuid()` extension (usually enabled by default)
- [ ] Run migrations (includes OAuth user columns in 004_oauth_users.sql)

---

## Browser Support

Tested on latest Chrome/Firefox. Frontend uses modern React patterns (hooks, streaming SSE via EventSource API).

---

## Security Review Status

A comprehensive security review was conducted on 2025-12-28 (see `docs/ai-council-review-codex-20251228-154048.md`).

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
- [x] Settings modal dialog semantics with focus trap - `frontend/src/components/Settings.jsx`
- [x] Local storage API key ID fix - `backend/storage_local.py`
- [x] Documentation field name corrections - `CLAUDE.md`, `AGENTS.md`

**Launch readiness:** All Phase 1, Phase 2, and Phase 3 items are complete.

See `docs/IMPLEMENTATION_PLAN_security_fixes.md` for the detailed implementation plan.
