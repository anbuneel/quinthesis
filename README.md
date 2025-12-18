# AI Council

![llmcouncil](header.jpg)

A collaborative deliberation system where multiple LLMs answer your questions, then review and rank each other's work anonymously. A Chairman LLM synthesizes the insights into a final response.

Instead of asking a single LLM provider, submit your question to the "AI Council"—a group of leading models (OpenAI GPT-5.1, Google Gemini 3.0 Pro, Anthropic Claude Sonnet 4.5, xAI Grok 4, etc.). The Council deliberates in three stages: individual responses, peer review, and final synthesis.

**Production Application**: Deployed on Vercel (frontend), Fly.io (backend), and Supabase (database).

In a bit more detail, here is what happens when you submit a query:

1. **Stage 1: First opinions**. The user query is given to all LLMs individually, and the responses are collected. The individual responses are shown in a "tab view", so that the user can inspect them all one by one.
2. **Stage 2: Review**. Each individual LLM is given the responses of the other LLMs. Under the hood, the LLM identities are anonymized so that the LLM can't play favorites when judging their outputs. The LLM is asked to rank them in accuracy and insight.
3. **Stage 3: Final response**. The designated Chairman of the AI Council takes all of the model's responses and compiles them into a single final answer that is presented to the user.

## Status

Originally a vibe-coded exploration, AI Council is now a fully-featured production application deployed to Vercel, Fly.io, and Supabase. See `AGENTS.md` for deployment and development reference, and `CLAUDE.md` for detailed technical implementation notes.

## Setup

### 1. Install Dependencies

The project uses [uv](https://docs.astral.sh/uv/) for project management.

**Backend:**
```bash
uv sync
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

### 2. Configure Environment

Create a `.env` file in the project root:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
AUTH_USERNAME=admin
AUTH_PASSWORD=your-password
DATABASE_URL=postgresql://user:pass@host/db       # Optional: for production (uses JSON if not set)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

Get your OpenRouter API key at [openrouter.ai](https://openrouter.ai/). Purchase credits or enable automatic top-up.

For production deployment, set `DATABASE_URL` to a Supabase PostgreSQL connection string. Without it, the app falls back to local JSON file storage in `data/conversations/`.

### 3. Configure Models (Optional)

Edit `backend/config.py` to customize the council:

```python
COUNCIL_MODELS = [
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4",
]

CHAIRMAN_MODEL = "google/gemini-3-pro-preview"
```

## Running the Application

**Option 1: Use the start script**
```bash
./start.sh
```

**Option 2: Run manually**

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

## Tech Stack

- **Backend:** FastAPI (Python 3.10+), Uvicorn, asyncpg, OpenRouter API
- **Frontend:** React + Vite, react-markdown rendering
- **Storage:** PostgreSQL (production via Supabase), JSON fallback (local development)
- **Deployment:** Vercel (frontend), Fly.io (backend), Supabase (database)
- **Package Management:** uv for Python, npm for JavaScript
