# Codebase Snapshot Timeline

This document tracks the evolution of the Quinthesis codebase over time.

---

## Snapshot: 2026-01-05 at 15:30 EST

**Author:** Claude (Opus 4.5)
**Captured:** 2026-01-05T15:30:00-05:00

### Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                              QUINTHESIS ARCHITECTURE                              |
+-----------------------------------------------------------------------------------+

                                  +-------------------+
                                  |      USERS        |
                                  | (Browser Clients) |
                                  +--------+----------+
                                           |
                                           | HTTPS
                                           v
+------------------------------------------+-------------------------------------------+
|                                    VERCEL (Frontend)                                |
|  +--------------------------------------------------------------------------------+ |
|  |                          React SPA (Vite Build)                                | |
|  |                                                                                | |
|  |  +------------+  +---------------+  +-------------+  +------------------+      | |
|  |  | Login/     |  | Inquiry       |  | Chat        |  | Account          |      | |
|  |  | OAuth      |  | Composer      |  | Interface   |  | (Billing/BYOK)   |      | |
|  |  +------------+  +---------------+  +-------------+  +------------------+      | |
|  |                                                                                | |
|  |  +------------+  +------------+  +------------+  +--------------------+        | |
|  |  | Stage 1    |  | Stage 2    |  | Stage 3    |  | Demo View          |        | |
|  |  | (Responses)|  | (Rankings) |  | (Synthesis)|  | (Public Examples)  |        | |
|  |  +------------+  +------------+  +------------+  +--------------------+        | |
|  +--------------------------------------------------------------------------------+ |
+------------------------------------------+-------------------------------------------+
                                           |
                                           | REST + SSE (Streaming)
                                           v
+------------------------------------------+-------------------------------------------+
|                                   FLY.IO (Backend)                                  |
|  +--------------------------------------------------------------------------------+ |
|  |                      FastAPI Application (Python 3.10+)                        | |
|  |                                                                                | |
|  |  +--------------------+  +--------------------+  +--------------------+        | |
|  |  | OAuth Handlers     |  | Council Logic      |  | Billing/Stripe     |        | |
|  |  | (Google, GitHub)   |  | (3-Stage Pipeline) |  | (Usage-Based)      |        | |
|  |  +--------------------+  +--------------------+  +--------------------+        | |
|  |                                                                                | |
|  |  +--------------------+  +--------------------+  +--------------------+        | |
|  |  | JWT Auth           |  | Rate Limiting      |  | OpenRouter Proxy   |        | |
|  |  | (Access/Refresh)   |  | (Per-User/IP)      |  | (Provisioning API) |        | |
|  |  +--------------------+  +--------------------+  +--------------------+        | |
|  |                                                                                | |
|  |  +--------------------+  +--------------------+  +--------------------+        | |
|  |  | Storage Layer      |  | Encryption         |  | Notifications      |        | |
|  |  | (PostgreSQL/JSON)  |  | (MultiFernet)      |  | (Resend Email)     |        | |
|  |  +--------------------+  +--------------------+  +--------------------+        | |
|  +--------------------------------------------------------------------------------+ |
+------------------------------------------+-------------------------------------------+
                         |                                      |
                         | asyncpg                              | httpx
                         v                                      v
+------------------------+-----+                  +-------------+--------------+
|        SUPABASE              |                  |        OPENROUTER          |
|      (PostgreSQL)            |                  |     (LLM Gateway API)      |
|                              |                  |                            |
|  +------------------------+  |                  |  +-----------------------+ |
|  | Users and OAuth        |  |                  |  | GPT-5.1               | |
|  | Conversations          |  |                  |  | Gemini 3 Pro Preview  | |
|  | Stage 1/2/3 Data       |  |                  |  | Claude Sonnet 4.5     | |
|  | Balances and Usage     |  |                  |  +-----------------------+ |
|  | API Keys (Encrypted)   |  |                  |                            |
|  +------------------------+  |                  |  Per-user provisioned keys |
+------------------------------+                  +----------------------------+
                                                              |
                                  +---------------------------+---+
                                  |          STRIPE               |
                                  |    (Payment Processing)       |
                                  |  Checkout Sessions            |
                                  |  Webhooks (deposits)          |
                                  +-------------------------------+
```

### Data Flow: Multi-AI Deliberation

```
User Question
      |
      v
+-----+------+
| Stage 1    |-----> Parallel queries to 3 LLMs (GPT-5.1, Gemini, Claude)
| Responses  |       Each model generates independent response
+-----+------+
      |
      v
+-----+------+
| Stage 2    |-----> Anonymize responses (Response A, B, C)
| Rankings   |       Each model ranks all responses (peer review)
+-----+------+       Parse rankings, calculate aggregate scores
      |
      v
+-----+------+
| Stage 3    |-----> Lead model synthesizes final Quintessence
| Synthesis  |       Full context: question + all responses + rankings
+------------+
      |
      v
   Response (Streaming via SSE)
```

### Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| **Frontend** | | |
| Framework | React | 19.2.0 |
| Build Tool | Vite | 7.2.4 |
| Routing | react-router-dom | 7.11.0 |
| Markdown | react-markdown | 10.1.0 |
| Sanitization | rehype-sanitize | 6.0.0 |
| Error Tracking | @sentry/react | 9.0.0 |
| Testing | Vitest | 3.2.4 |
| Test Utils | @testing-library/react | 16.3.0 |
| Test DOM | jsdom | 26.1.0 |
| API Mocking | msw | 2.8.4 |
| Linting | ESLint | 9.39.1 |
| **Backend** | | |
| Framework | FastAPI | >=0.115.0 |
| Server | Uvicorn | >=0.32.0 |
| HTTP Client | httpx | >=0.27.0 |
| Validation | Pydantic | >=2.9.0 |
| Database Driver | asyncpg | >=0.29.0 |
| Auth | PyJWT | >=2.8.0 |
| Encryption | cryptography | >=41.0.0 |
| Payments | stripe | >=8.0.0 |
| Error Tracking | sentry-sdk | >=2.0.0 |
| Testing | pytest | >=7.0 |
| Async Testing | pytest-asyncio | >=0.21 |
| Coverage | pytest-cov | >=4.0 |
| Mocking | pytest-mock, respx | >=3.10, >=0.20 |
| Time Mocking | freezegun | >=1.2 |
| **Database** | | |
| Database | PostgreSQL (Supabase) | - |
| Migrations | 14 SQL files | 000-013 |
| **Infrastructure** | | |
| Frontend Hosting | Vercel | - |
| Backend Hosting | Fly.io | sjc region |
| Database Hosting | Supabase | AWS |
| Payments | Stripe | - |
| LLM Gateway | OpenRouter | - |
| Error Monitoring | Sentry | - |
| Email | Resend | - |

### Production Deployment

- **Frontend Platform:** Vercel
- **Frontend URL:** https://quinthesis.vercel.app
- **Backend Platform:** Fly.io (app: quinthesis-api)
- **Backend URL:** https://quinthesis-api.fly.dev
- **Backend Region:** sjc (San Jose)
- **Backend Resources:** 1 GB RAM, shared CPU
- **Database:** Supabase PostgreSQL (connection pooler, port 6543)
- **CI/CD:** Vercel auto-deploy (frontend), Fly.io deploy via CLI (backend)
- **HTTPS:** Enforced on both platforms
- **Health Check:** GET / every 30s

### Code Metrics

| Metric | Count |
|--------|-------|
| **Total Application Code** | **19,412 lines** |
| Backend Python (excl. tests) | 6,609 lines |
| Frontend JSX | 4,868 lines |
| Frontend JS | 837 lines |
| Frontend CSS | 6,778 lines |
| SQL Migrations | 320 lines |
| **Testing** | |
| Backend Test Files | 6 files |
| Backend Test Lines | 250 lines |
| Frontend Test Files | 1 file |
| Frontend Test Lines | ~187 lines |
| **Components** | |
| Backend Modules | 18 files |
| Frontend Components | 22 files |
| Database Migrations | 14 files |
| **Documentation** | |
| CLAUDE.md + README.md | 1,074 lines |
| docs/ folder | 10,105 lines |
| **Build Output** | |
| Bundle Size (JS) | 479 KB |
| Bundle Size (CSS) | 88 KB |
| Total Assets | 572 KB |

### Feature Summary

**Core Features:**
- Multi-AI deliberation with 3 LLMs (GPT-5.1, Gemini 3 Pro, Claude Sonnet 4.5)
- 3-stage pipeline: Independent responses -> Peer review rankings -> Lead synthesis
- Real-time streaming via Server-Sent Events (SSE)
- Anonymized peer review to prevent model bias
- Aggregate ranking calculation with leaderboard display

**Authentication and Users:**
- OAuth 2.0 with Google and GitHub (PKCE for Google)
- JWT access/refresh tokens
- Account linking by email
- Account deletion with data export

**Billing System (Usage-Based):**
- Deposit tiers: $1, $2, $5, $10
- Pay-per-query at OpenRouter cost + 5% margin
- Real-time cost tracking via OpenRouter generation API
- BYOK (Bring Your Own Key) mode for direct OpenRouter billing
- Per-user OpenRouter key provisioning

**Security:**
- Server-side OAuth state validation
- Rate limiting (10 req/min for queries, auth endpoints protected)
- Request body size limits (1MB)
- API key encryption with MultiFernet (supports key rotation)
- XSS protection via rehype-sanitize
- SSE keepalive pings (15s)

**UI/UX:**
- Editorial "Paper of Record" design theme
- Two-pane layout (Archive sidebar + main content)
- Collapsible Stage 1/2 with prominent Quintessence (Stage 3)
- Keyboard navigation and ARIA accessibility
- Mobile-responsive drawer
- Custom confirmation dialogs
- Demo mode with precomputed examples

### API Endpoints Summary

| Category | Endpoints |
|----------|-----------|
| OAuth | GET/POST /api/auth/oauth/{provider}, /callback, /refresh, /me |
| Account | DELETE /api/auth/account, GET /api/auth/export |
| Models | GET /api/models |
| Conversations | POST /api/conversations, GET/DELETE /api/conversations/{id} |
| Messages | POST /api/conversations/{id}/message, /message/stream (SSE) |
| Billing | GET /api/balance, /deposits/options, /usage/history |
| Checkout | POST /api/deposits/checkout |
| BYOK | GET/POST/DELETE /api/settings/api-mode, /byok |
| Webhooks | POST /api/webhooks/stripe |

### Testing Infrastructure (New)

**Backend (pytest):**
- Test directory: backend/tests/ with unit/integration/api subdirs
- Configuration: pyproject.toml with asyncio_mode=auto
- Fixtures: auth_headers, mock_storage, isolated_storage
- Custom markers: @pytest.mark.postgres for DB-dependent tests
- Current coverage: Council module (parse_ranking, calculate_aggregate)

**Frontend (vitest):**
- Configuration: vitest.config.js with jsdom environment
- Setup: src/test/setup.js with jest-dom matchers
- API mocking: MSW (Mock Service Worker) available
- Current coverage: Stage1 component (rendering, tabs, keyboard nav, a11y)

### Database Schema (14 Migrations)

| Migration | Purpose |
|-----------|---------|
| 000 | Base schema (users, conversations, stages, credits) |
| 001-004 | Users, API keys, conversation ownership, OAuth |
| 005-006 | Credits and usage-based billing |
| 007 | BYOK support |
| 008-010 | Deposit option adjustments |
| 011-012 | Encryption key version tracking |
| 013 | Row-level security (RLS) |

### Notable Configuration

- **Available Models:** openai/gpt-5.1, google/gemini-3-pro-preview, anthropic/claude-sonnet-4.5
- **Default Lead Model:** google/gemini-3-pro-preview
- **Frontend Dev Port:** 5175
- **Backend Port:** 8080 (both local and production)
- **Minimum Balance:** $0.50 required for queries
- **Billing Margin:** 5% on OpenRouter costs

---

*This is the first snapshot. Future snapshots will appear above this line.*
