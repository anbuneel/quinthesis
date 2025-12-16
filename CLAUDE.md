# CLAUDE.md - Technical Notes for LLM Council

This file contains technical details, architectural decisions, and important implementation notes for future development sessions.

## Project Overview

LLM Council is a 3-stage deliberation system where multiple LLMs collaboratively answer user questions. The key innovation is anonymized peer review in Stage 2, preventing models from playing favorites.

## Architecture

### Backend Structure (`backend/`)

**`config.py`**
- Contains `COUNCIL_MODELS` (list of OpenRouter model identifiers)
- Contains `CHAIRMAN_MODEL` (model that synthesizes final answer)
- Uses environment variable `OPENROUTER_API_KEY` from `.env`
- Backend runs on **port 8001** (NOT 8000 - user had another app on 8000)

**`openrouter.py`**
- `query_model()`: Single async model query
- `query_models_parallel()`: Parallel queries using `asyncio.gather()`
- Returns dict with 'content' and optional 'reasoning_details'
- Graceful degradation: returns None on failure, continues with successful responses

**`council.py`** - The Core Logic
- `stage1_collect_responses()`: Parallel queries to all council models
- `stage2_collect_rankings()`:
  - Anonymizes responses as "Response A, B, C, etc."
  - Creates `label_to_model` mapping for de-anonymization
  - Prompts models to evaluate and rank (with strict format requirements)
  - Returns tuple: (rankings_list, label_to_model_dict)
  - Each ranking includes both raw text and `parsed_ranking` list
- `stage3_synthesize_final()`: Chairman synthesizes from all responses + rankings
- `parse_ranking_from_text()`: Extracts "FINAL RANKING:" section, handles both numbered lists and plain format
- `calculate_aggregate_rankings()`: Computes average rank position across all peer evaluations

**`storage.py`** (PostgreSQL - production)
- PostgreSQL-based conversation storage for production deployment
- Each conversation: `{id, created_at, messages[]}`
- Assistant messages contain: `{role, stage1, stage2, stage3}`
- Note: metadata (label_to_model, aggregate_rankings) is NOT persisted to storage, only returned via API

**`storage_local.py`** (JSON - local development)
- JSON-based conversation storage in `data/conversations/`
- Same async interface as `storage.py`
- Used automatically when `DATABASE_URL` is not set
- Each conversation stored as individual `.json` file

**`main.py`**
- FastAPI app with CORS enabled for localhost:5173 and localhost:3000
- Conditional storage import: uses `storage_local.py` when `DATABASE_URL` not set
- POST `/api/conversations/{id}/message` returns metadata in addition to stages
- Metadata includes: label_to_model mapping and aggregate_rankings

### Frontend Structure (`frontend/src/`)

**Design: "The Modern Chamber"**
- Dark deliberative theme evoking a high-stakes council chamber
- Three-panel layout: Sidebar (The Docket), Main Chamber, Right Panel (Council Composition)
- Typography: DM Serif Display (headlines), Inter (body), JetBrains Mono (code)
- See `DESIGN_PROPOSAL.md` for complete design documentation

**`App.jsx`**
- Main orchestration: manages conversations list and current conversation
- Three-panel layout with collapsible RightPanel
- Handles message sending and metadata storage
- Important: metadata is stored in the UI state for display but not persisted to backend JSON

**`components/RightPanel.jsx`** (NEW)
- Council composition panel showing active models
- Displays models as "Councilor A/B/C" with real names
- Chairman display with golden styling
- "Blind Mode" toggle (UI placeholder for future)
- Collapsible via toggle button

**`components/ProgressOrbit.jsx`** (NEW)
- Stage stepper: `[ I ] Opinions — [ II ] Review — [ III ] Ruling`
- Active stage: pulsing glow
- Completed stages: solid gold
- Pending stages: muted steel blue

**`components/ChatInterface.jsx`**
- Multiline textarea (3 rows, resizable)
- Enter to send, Shift+Enter for new line
- "Petitioner" (user) / "The Council" (assistant) terminology
- "Deliberate" button with thematic loading messages
- Integrates ProgressOrbit component

**`components/Sidebar.jsx`** (The Docket)
- "AI Council - Where AI Minds Convene" branding
- Cases with status indicators (pulsing blue = in deliberation, gold = resolved)
- "New Case" / "Leave Chamber" buttons

**`components/Login.jsx`**
- Dark chamber styling with golden emblem
- "Enter the Chamber" button

**`components/Stage1.jsx`**
- "STAGE I: FIRST OPINIONS" with steel blue theme
- Pill-style tabs: "Councilor A/B/C" labels
- Native tooltip shows real model name on hover
- ReactMarkdown rendering with markdown-content wrapper

**`components/Stage2.jsx`**
- "STAGE II: THE REVIEW" with purple theme (#7C5E99)
- **Critical Feature**: Tab view showing RAW evaluation text from each model
- De-anonymization happens CLIENT-SIDE for display (models receive anonymous labels)
- "Council Standing" leaderboard with position badges (gold/silver/bronze)
- Shows "Extracted Ranking" below each evaluation so users can validate parsing

**`components/Stage3.jsx`**
- "Final Resolution" with golden glow hero card
- Golden left border, gradient background
- Chairman badge with 👑 icon
- Entrance animation (verdict-appear)

**Styling (`*.css`)**
- Dark mode theme ("The Modern Chamber")
- Color palette: `--bg-chamber` (#050713), `--bg-card` (#141829), `--accent-gold` (#D4AF37)
- Global markdown styling in `index.css` with `.markdown-content` class
- Animations: pulse-blue, pulse-gold, fade-in-up, verdict-appear

## Key Design Decisions

### Stage 2 Prompt Format
The Stage 2 prompt is very specific to ensure parseable output:
```
1. Evaluate each response individually first
2. Provide "FINAL RANKING:" header
3. Numbered list format: "1. Response C", "2. Response A", etc.
4. No additional text after ranking section
```

This strict format allows reliable parsing while still getting thoughtful evaluations.

### De-anonymization Strategy
- Models receive: "Response A", "Response B", etc.
- Backend creates mapping: `{"Response A": "openai/gpt-5.1", ...}`
- Frontend displays model names in **bold** for readability
- Users see explanation that original evaluation used anonymous labels
- This prevents bias while maintaining transparency

### Error Handling Philosophy
- Continue with successful responses if some models fail (graceful degradation)
- Never fail the entire request due to single model failure
- Log errors but don't expose to user unless all models fail

### UI/UX Transparency
- All raw outputs are inspectable via tabs
- Parsed rankings shown below raw text for validation
- Users can verify system's interpretation of model outputs
- This builds trust and allows debugging of edge cases

## Important Implementation Details

### Relative Imports
All backend modules use relative imports (e.g., `from .config import ...`) not absolute imports. This is critical for Python's module system to work correctly when running as `python -m backend.main`.

### Port Configuration
- Backend: 8001 (changed from 8000 to avoid conflict)
- Frontend: 5173 (Vite default)
- Update both `backend/main.py` and `frontend/src/api.js` if changing

### Markdown Rendering
All ReactMarkdown components must be wrapped in `<div className="markdown-content">` for proper spacing. This class is defined globally in `index.css`.

### Model Configuration
Models are hardcoded in `backend/config.py`. Chairman can be same or different from council members. The current default is Gemini as chairman per user preference.

## Common Gotchas

1. **Module Import Errors**: Always run backend as `python -m backend.main` from project root, not from backend directory
2. **CORS Issues**: Frontend must match allowed origins in `main.py` CORS middleware
3. **Ranking Parse Failures**: If models don't follow format, fallback regex extracts any "Response X" patterns in order
4. **Missing Metadata**: Metadata is ephemeral (not persisted), only available in API responses

## Future Enhancement Ideas

- Configurable council/chairman via UI instead of config file
- Streaming responses instead of batch loading
- Export conversations to markdown/PDF
- Model performance analytics over time
- Custom ranking criteria (not just accuracy/insight)
- Support for reasoning models (o1, etc.) with special handling

## Testing Notes

Use `test_openrouter.py` to verify API connectivity and test different model identifiers before adding to council. The script tests both streaming and non-streaming modes.

## Data Flow Summary

```
User Query
    ↓
Stage 1: Parallel queries → [individual responses]
    ↓
Stage 2: Anonymize → Parallel ranking queries → [evaluations + parsed rankings]
    ↓
Aggregate Rankings Calculation → [sorted by avg position]
    ↓
Stage 3: Chairman synthesis with full context
    ↓
Return: {stage1, stage2, stage3, metadata}
    ↓
Frontend: Display with tabs + validation UI
```

The entire flow is async/parallel where possible to minimize latency.
