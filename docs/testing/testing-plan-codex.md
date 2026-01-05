# Testing Plan and Tooling (Codex)

This document defines the initial testing strategy for Quinthesis, with tooling choices and a phased rollout plan. It is designed to reduce regressions in core product flows (SSE streaming, billing, OAuth, BYOK, storage) while keeping local development fast and deterministic.

## Goals

- Catch regressions in core flows: auth, conversations, streaming, billing, and settings.
- Keep tests deterministic by mocking external APIs and time.
- Enable local runs without real network access or paid services.
- Establish a CI baseline that is fast enough to run on every PR.

## Non-goals

- Load or performance testing (can be added later).
- End-to-end validation of third-party vendors (OpenRouter, Stripe, Google, GitHub).

## Tooling choices

### Backend
- Test runner: `pytest`
- Async support: `pytest-asyncio`
- HTTP mocking: `respx` (or `httpx.MockTransport`)
- Coverage: `pytest-cov`
- Time control: `freezegun` (optional)

### Frontend
- Unit tests: `vitest`
- React testing: `@testing-library/react` + `@testing-library/user-event`
- API mocking: `msw` (Mock Service Worker)

### E2E
- Browser tests: `playwright`

### CI
- GitHub Actions with caching for `uv` and `npm`

## Test matrix (priority order)

1. **Auth and session**
   - OAuth callback state validation, refresh token flow, `/api/auth/me`
2. **Conversations**
   - Create conversation, send message, list, delete
3. **Streaming SSE**
   - Event ordering, buffering, error propagation, client disconnect handling
4. **Billing**
   - Balance, deposit checkout, usage cost calculation, webhook verification
5. **BYOK**
   - Set key, validate key, delete key, mode switching
6. **Storage**
   - `storage_local` CRUD, migration logic, Postgres integration (optional)

## Environments and mocks

- Default test mode uses local JSON storage (`DATABASE_URL` unset).
- Use temp directories in tests by patching `storage_local.DATA_DIR`, `USERS_DIR`, `API_KEYS_DIR`.
- Mock external HTTP calls:
  - OpenRouter (LLM responses and generation cost endpoint)
  - Stripe (checkout session and webhook verification)
  - OAuth providers (Google/GitHub)

## Suggested structure

```
backend/tests/
  unit/
  integration/
frontend/src/__tests__/
e2e/
```

## Local commands (proposed)

```
uv run pytest
cd frontend && npm run test
npx playwright test
```

## Phased rollout

### Phase 1: Core unit tests (fast)
- Pure functions and utilities:
  - `parse_ranking_from_text` and aggregate ranking logic
  - encryption key rotation helpers
  - usage cost calculation
  - rate limiter logic

### Phase 2: Backend API integration
- FastAPI routes via `httpx.AsyncClient`
- Streaming SSE endpoint with deterministic mocked OpenRouter responses
- Billing endpoints with mocked Stripe

### Phase 3: Frontend unit tests
- `api.js` SSE parsing and error handling
- Stage components render (Stage1/2/3)
- Account page with empty/loaded states

### Phase 4: E2E and CI
- Playwright smoke tests:
  - `/demo` browsing
  - auth gate to login
  - staged response rendering (mocked API)
- GitHub Actions pipelines to run unit, integration, and e2e tests

## Notes for SSE testing

- Use `httpx.AsyncClient` with `ASGITransport` to simulate streaming.
- Validate event types and ordering (`stage1_start` -> `stage1_complete` -> ... -> `complete`).
- Ensure error events surface cleanly and leave UI in a recoverable state.
