# Quinthesis

![quinthesis](header.jpg)

A multi-AI deliberation platform where multiple LLMs answer your questions, review and rank each other anonymously, then synthesize the insights into a refined final response. The name combines "quintessence" (the purest essence) with "synthesis" (combining ideas).

## Project Purpose

**Primary goal:** Learn to use AI agents (Claude Code, Codex) to build a full-stack SaaS application from scratch.

This project serves as a hands-on exploration of AI-assisted development workflows, covering frontend (React/Vite), backend (FastAPI/Python), database (PostgreSQL/Supabase), authentication (OAuth), payments (Stripe), and deployment (Vercel/Fly.io).

Instead of asking a single LLM provider, submit your question to Quinthesis and get responses from a group of leading models (OpenAI GPT-5.1, Google Gemini 3 Pro, Anthropic Claude Sonnet 4.5, xAI Grok 4, etc.). The deliberation happens in three stages: individual responses, peer review, and final synthesis.

The UI uses a two-pane docket layout:
- Left pane: Archive drawer with search and date-grouped conversations (Today, Yesterday, This Week, etc.)
- Right pane: The inquiry with question, final answer, and collapsible Stage 1/2 deliberation records

**Live Demo:** https://quinthesis.vercel.app

**Try Before Signing Up:** Visit `/demo` to see example deliberations without creating an account.

Production Application: Deployed on Vercel (frontend), Fly.io (backend), and Supabase (database).

In a bit more detail, here is what happens when you submit a query:

1. Stage 1: First opinions. The user query is given to all LLMs individually, and the responses are collected. The individual responses are shown in expert tabs with full content displayed.
2. Stage 2: Review. Each individual LLM is given the responses of the other LLMs. Under the hood, the LLM identities are anonymized so that the LLM cannot play favorites when judging their outputs. The LLM is asked to rank them in accuracy and insight.
3. Stage 3: Final response. The lead model takes all of the model responses and synthesizes them into a single refined answer.

## Status

Originally a vibe-coded exploration, Quinthesis is now a fully-featured production application deployed to Vercel, Fly.io, and Supabase. See `AGENTS.md` for deployment and development reference, `CLAUDE.md` for technical notes, and `docs/design/ui-redesign-proposal.md` for the "Paper of Record" design system.

## Setup

### 1. Install Dependencies

The project uses [uv](https://docs.astral.sh/uv/) for project management.

Backend:
```bash
uv sync
```

Frontend:
```bash
cd frontend
npm install
cd ..
```

### 2. Configure Environment

Create a `.env` file in the project root:

```bash
# Database (required for production)
DATABASE_URL=postgresql://user:pass@host/db

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
OAUTH_REDIRECT_BASE=http://localhost:5173

# CORS origins
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Stripe (for deposits)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenRouter Provisioning (for per-user API keys)
OPENROUTER_PROVISIONING_KEY=sk-or-prov-...

# Sentry (optional - for error tracking and monitoring)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**Authentication:** Users sign in via Google or GitHub OAuth. Existing users are linked by email to preserve their data.

**Usage-Based Billing:** Users have two options:
- **Credits Mode:** Deposit funds via Stripe ($1/$2/$5/$10). Each query is charged at actual OpenRouter cost + 10% margin with transparent per-query cost breakdowns.
- **BYOK Mode:** Use your own OpenRouter API key to bypass the credit system entirely and pay OpenRouter directly.

**Database Migrations:** Run migrations before first use:
```bash
uv run python -m backend.migrate
```

### 3. Configure Models (Optional)

Edit `backend/config.py` to customize the council:

```python
AVAILABLE_MODELS = [
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
]

DEFAULT_MODELS = list(AVAILABLE_MODELS)
DEFAULT_LEAD_MODEL = "google/gemini-3-pro-preview"
```

## Running the Application

Option 1: Use the start script
```bash
./start.sh
```

Option 2: Run manually

Terminal 1 (Backend):
```bash
uv run python -m backend.main
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Then open http://localhost:5173 in your browser.

### Keyboard Shortcuts

- `Ctrl/Cmd + K` - Toggle archive drawer
- `Ctrl/Cmd + N` - New conversation
- `Escape` - Close drawer or modal

## Tech Stack

- Backend: FastAPI (Python 3.10+), Uvicorn, asyncpg, OpenRouter API
- Frontend: React + Vite, react-markdown rendering
- Storage: PostgreSQL (production via Supabase), JSON fallback (local development)
- Monitoring: Sentry (error tracking and performance monitoring)
- Deployment: Vercel (frontend), Fly.io (backend), Supabase (database)
- Package Management: uv for Python, npm for JavaScript
