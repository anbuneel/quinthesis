# Automated Testing Plan

Comprehensive testing strategy for Quinthesis backend (Python/FastAPI) and frontend (React).

**Created:** 2026-01-05
**Updated:** 2026-01-05 (implementation complete)
**Status:** ✅ Implemented (678 tests: 236 backend + 442 frontend)

---

## Goals

- Catch regressions in core flows: auth, conversations, SSE streaming, billing, BYOK, and settings
- Keep tests deterministic by mocking external APIs and time
- Enable local runs without real network access or paid services
- Establish a CI baseline that is fast enough to run on every PR

## Non-Goals

- Load or performance testing (can be added later)
- End-to-end validation of third-party vendors (OpenRouter, Stripe, Google, GitHub)
- 100% coverage (diminishing returns)

---

## Current State

The project has **comprehensive testing infrastructure** implemented:

**Backend (236 tests):**
- Unit tests: council, auth_jwt, encryption, rate_limit, oauth_state, models
- Integration tests: storage_local, SSE streaming, openrouter, stripe, provisioning
- API tests: auth, conversations, billing, BYOK, settings endpoints

**Frontend (442 tests):**
- Component tests: Stage1, Stage2, Stage3, ChatInterface, Account, Sidebar, Login, etc.
- API client tests: auth, conversations, billing, SSE parsing
- MSW handlers for mocked API responses

**CI/CD:**
- GitHub Actions workflow (`.github/workflows/test.yml`)
- Runs backend and frontend tests on push/PR to master
- Codecov integration for coverage reporting

---

## Test Strategy Overview

| Phase | Focus | Estimated Tests | Effort |
|-------|-------|-----------------|--------|
| 1 | Backend unit tests | ~75 | 4-6 hours |
| 2 | Backend integration tests (incl. SSE, local storage) | ~85 | 8-10 hours |
| 3 | API endpoint tests (incl. BYOK lifecycle) | ~140 | 10-12 hours |
| 4 | Frontend tests (incl. SSE parsing) | ~105 | 12-14 hours |
| 5 | E2E tests + CI/CD (incl. /demo) | ~15 | 4-6 hours |

**Total:** ~420 tests, 38-48 hours

---

## Phase 1: Backend Unit Tests (Priority 1)

### Dependencies

Add to `pyproject.toml`:

```toml
[project.optional-dependencies]
test = [
    "pytest>=7.0",
    "pytest-asyncio>=0.21",
    "pytest-cov>=4.0",
    "pytest-mock>=3.10",
    "respx>=0.20",  # Mock httpx (cleaner than httpx-mock)
    "freezegun>=1.2",  # Time control for TTL, token expiration, rate limiting
]
```

### Critical Modules to Test

| Module | Key Functions | Tests | Why Critical |
|--------|---------------|-------|--------------|
| `council.py` | `parse_ranking_from_text()`, `calculate_aggregate_rankings()` | 18 | Core business logic, parsing edge cases |
| `auth_jwt.py` | `create_access_token()`, `verify_token()`, `create_refresh_token()` | 15 | Security-critical |
| `encryption.py` | `encrypt_api_key()`, `decrypt_api_key()`, `rotate_api_key()` | 12 | Data protection |
| `rate_limit.py` | `RateLimiter.check()`, `get_remaining()` | 10 | DoS prevention |
| `oauth_state.py` | `create_state()`, `validate_state()`, PKCE functions | 10 | CSRF protection |
| `models.py` | Pydantic model validation | 10 | Input validation |

### Example Tests

```python
# backend/tests/unit/test_council.py
import pytest
from backend.council import parse_ranking_from_text, calculate_aggregate_rankings

class TestParseRanking:
    def test_standard_format(self):
        text = """
        FINAL RANKING:
        1. Response C
        2. Response A
        3. Response B
        """
        result = parse_ranking_from_text(text)
        assert result == ["C", "A", "B"]

    def test_no_ranking_header(self):
        text = "1. Response A\n2. Response B"
        result = parse_ranking_from_text(text)
        assert result == ["A", "B"]

    def test_fallback_regex(self):
        text = "I think Response B is best, then Response A"
        result = parse_ranking_from_text(text)
        assert result == ["B", "A"]

    def test_empty_input(self):
        result = parse_ranking_from_text("")
        assert result == []

class TestAggregateRankings:
    def test_basic_aggregation(self):
        rankings = [
            {"model": "gpt-4", "parsed_ranking": ["A", "B", "C"]},
            {"model": "claude", "parsed_ranking": ["B", "A", "C"]},
        ]
        label_to_model = {"A": "model1", "B": "model2", "C": "model3"}
        result = calculate_aggregate_rankings(rankings, label_to_model)
        assert result[0]["model"] == "model2"  # B: avg 1.5
        assert result[1]["model"] == "model1"  # A: avg 1.5 (tie)
```

```python
# backend/tests/unit/test_auth_jwt.py
import pytest
from datetime import datetime, timezone, timedelta
from backend.auth_jwt import create_access_token, verify_token, create_refresh_token

class TestJWT:
    def test_create_access_token(self):
        token = create_access_token(user_id="user-123", email="test@example.com")
        assert token is not None
        payload = verify_token(token)
        assert payload["sub"] == "user-123"
        assert payload["email"] == "test@example.com"
        assert payload["type"] == "access"

    def test_verify_expired_token(self):
        # Create token that's already expired
        token = create_access_token(
            user_id="user-123",
            email="test@example.com",
            expires_delta=timedelta(seconds=-1)
        )
        with pytest.raises(Exception):
            verify_token(token)

    def test_verify_invalid_token(self):
        with pytest.raises(Exception):
            verify_token("invalid-token")

    def test_refresh_token_type(self):
        token = create_refresh_token(user_id="user-123")
        payload = verify_token(token)
        assert payload["type"] == "refresh"
```

---

## Phase 2: Backend Integration Tests (Priority 2)

### Test Environment Strategy

**Default: Local JSON storage** (no `DATABASE_URL` set)
- Tests run against `storage_local.py` by default
- No database setup required for most tests
- Faster test execution

**Optional: PostgreSQL tests** (when `DATABASE_URL` is set)
- Gated behind `@pytest.mark.skipif(not DATABASE_URL)`
- CI can optionally run with Postgres service

### Modules Requiring Mocked External Services

| Module | Mock Target | Tests |
|--------|-------------|-------|
| `openrouter.py` | httpx calls to OpenRouter API | 15 |
| `oauth.py` | Google/GitHub OAuth APIs | 12 |
| `stripe_client.py` | Stripe SDK | 10 |
| `openrouter_provisioning.py` | OpenRouter Provisioning API | 8 |
| `storage.py` | asyncpg pool | 15 |
| `storage_local.py` | File system (temp dirs) | 12 |

### Example Tests

```python
# backend/tests/integration/test_openrouter.py
import pytest
import respx
from httpx import Response
from backend.openrouter import query_model, query_models_parallel, get_generation_cost

@pytest.mark.asyncio
class TestOpenRouter:
    @respx.mock
    async def test_query_model_success(self):
        respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
            return_value=Response(200, json={
                "choices": [{"message": {"content": "Hello!"}}],
                "id": "gen-abc123"
            })
        )
        result = await query_model(
            "openai/gpt-4",
            [{"role": "user", "content": "Hi"}],
            api_key="test-key"
        )
        assert result["content"] == "Hello!"
        assert result["generation_id"] == "gen-abc123"

    @respx.mock
    async def test_query_model_rate_limit_retry(self):
        # First call returns 429, second succeeds
        route = respx.post("https://openrouter.ai/api/v1/chat/completions")
        route.side_effect = [
            Response(429, json={"error": "rate limited"}),
            Response(200, json={
                "choices": [{"message": {"content": "OK"}}],
                "id": "gen-xyz"
            })
        ]
        result = await query_model(
            "openai/gpt-4",
            [{"role": "user", "content": "test"}],
            api_key="test-key"
        )
        assert result["content"] == "OK"
        assert route.call_count == 2

    @respx.mock
    async def test_get_generation_cost(self):
        respx.get("https://openrouter.ai/api/v1/generation?id=gen-123").mock(
            return_value=Response(200, json={
                "data": {"total_cost": 0.0025}
            })
        )
        cost = await get_generation_cost("gen-123", api_key="prov-key")
        assert cost == 0.0025
```

```python
# backend/tests/integration/test_stripe.py
import pytest
from unittest.mock import MagicMock, patch
from backend.stripe_client import create_checkout_session, verify_webhook_signature

class TestStripe:
    @patch("backend.stripe_client.stripe")
    def test_create_checkout_session(self, mock_stripe):
        mock_stripe.checkout.Session.create.return_value = MagicMock(
            id="cs_test_123",
            url="https://checkout.stripe.com/test"
        )

        result = create_checkout_session(
            user_id="user-123",
            amount_cents=500,
            success_url="https://example.com/success",
            cancel_url="https://example.com/cancel"
        )

        assert result["session_id"] == "cs_test_123"
        assert result["checkout_url"] == "https://checkout.stripe.com/test"

    @patch("backend.stripe_client.stripe")
    def test_verify_webhook_signature_invalid(self, mock_stripe):
        mock_stripe.Webhook.construct_event.side_effect = \
            stripe.error.SignatureVerificationError("Invalid", "sig")

        with pytest.raises(Exception):
            verify_webhook_signature(b"payload", "invalid-sig")
```

### Local Storage Tests (Temp Directory Isolation)

```python
# backend/tests/integration/test_storage_local.py
import pytest
from pathlib import Path

@pytest.fixture
def isolated_storage(tmp_path, monkeypatch):
    """Isolate storage_local to temp directories for test safety."""
    monkeypatch.setattr("backend.storage_local.DATA_DIR", tmp_path / "data")
    monkeypatch.setattr("backend.storage_local.USERS_DIR", tmp_path / "users")
    monkeypatch.setattr("backend.storage_local.API_KEYS_DIR", tmp_path / "keys")
    # Create directories
    (tmp_path / "data").mkdir()
    (tmp_path / "users").mkdir()
    (tmp_path / "keys").mkdir()

    from backend import storage_local
    return storage_local

@pytest.mark.asyncio
class TestLocalStorage:
    async def test_create_conversation(self, isolated_storage):
        conv_id = await isolated_storage.create_conversation(
            user_id="user-123",
            models=["openai/gpt-4"],
            lead_model="openai/gpt-4"
        )
        assert conv_id is not None

        conv = await isolated_storage.get_conversation(conv_id, user_id="user-123")
        assert conv["models"] == ["openai/gpt-4"]

    async def test_user_crud(self, isolated_storage):
        user = await isolated_storage.get_or_create_user(
            email="test@example.com",
            name="Test User",
            oauth_provider="google",
            oauth_id="google-123"
        )
        assert user["email"] == "test@example.com"

        found = await isolated_storage.find_user_by_email("test@example.com")
        assert found["id"] == user["id"]

    async def test_balance_operations(self, isolated_storage):
        user = await isolated_storage.get_or_create_user(
            email="billing@test.com", name="Billing User",
            oauth_provider="github", oauth_id="gh-456"
        )

        await isolated_storage.add_user_balance(user["id"], 5.00, "stripe-session-123")
        balance = await isolated_storage.get_balance(user["id"])
        assert balance["balance"] == 5.00
```

### SSE Streaming Tests (Critical Path)

The `/api/conversations/{id}/message/stream` endpoint is core UX. Test comprehensively.

**Important:** The streaming endpoint directly calls `stage1_collect_responses`, `stage2_collect_rankings`, and `stage3_synthesize_final` from `backend.council`. Mock these functions, NOT a non-existent `run_full_council_streaming`.

```python
# backend/tests/integration/test_sse_streaming.py
import pytest
import json
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
import asyncio

@pytest.fixture
def app():
    from backend.main import app
    return app

@pytest.mark.asyncio
class TestSSEStreaming:
    async def test_event_ordering(self, app, auth_headers):
        """Verify SSE events arrive in correct order."""
        # Mock the actual council functions called by the streaming endpoint
        mock_stage1 = AsyncMock(return_value=[
            {"model": "openai/gpt-4", "response": "Stage 1 response", "generation_id": "gen-1"}
        ])
        mock_stage2 = AsyncMock(return_value=[
            {"model": "openai/gpt-4", "ranking": "1. Response A", "parsed_ranking": ["A"]}
        ])
        mock_stage3 = AsyncMock(return_value={
            "response": "Final synthesis", "generation_id": "gen-3"
        })
        mock_costs = AsyncMock(return_value=[
            {"generation_id": "gen-1", "total_cost": 0.01}
        ])

        with patch("backend.main.stage1_collect_responses", mock_stage1), \
             patch("backend.main.stage2_collect_rankings", mock_stage2), \
             patch("backend.main.stage3_synthesize_final", mock_stage3), \
             patch("backend.main.get_generation_costs_batch", mock_costs):

            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/conversations/conv-123/message/stream",
                    json={"content": "test question"},
                    headers=auth_headers
                )

                events = []
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        events.append(json.loads(line[6:]))

                # Verify ordering
                event_types = [e["type"] for e in events]
                assert "stage1_start" in event_types
                assert "stage1_complete" in event_types
                assert event_types.index("stage1_start") < event_types.index("stage1_complete")

    async def test_error_propagation(self, app, auth_headers):
        """Verify errors are sent as error events."""
        mock_stage1 = AsyncMock(side_effect=Exception("OpenRouter API failure"))

        with patch("backend.main.stage1_collect_responses", mock_stage1):
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/conversations/conv-123/message/stream",
                    json={"content": "test"},
                    headers=auth_headers
                )

                events = []
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        events.append(json.loads(line[6:]))

                # Should have error event
                error_events = [e for e in events if e.get("type") == "error"]
                assert len(error_events) >= 1

    async def test_cost_calculation_on_completion(self, app, auth_headers):
        """Verify costs are calculated after successful completion."""
        cost_call_count = 0

        async def mock_get_costs(*args, **kwargs):
            nonlocal cost_call_count
            cost_call_count += 1
            return [{"generation_id": "gen-1", "total_cost": 0.01}]

        mock_stage1 = AsyncMock(return_value=[
            {"model": "openai/gpt-4", "response": "Response", "generation_id": "gen-1"}
        ])
        mock_stage2 = AsyncMock(return_value=[])
        mock_stage3 = AsyncMock(return_value={"response": "Final", "generation_id": "gen-3"})

        with patch("backend.main.stage1_collect_responses", mock_stage1), \
             patch("backend.main.stage2_collect_rankings", mock_stage2), \
             patch("backend.main.stage3_synthesize_final", mock_stage3), \
             patch("backend.main.get_generation_costs_batch", mock_get_costs):

            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/conversations/conv-123/message/stream",
                    json={"content": "test"},
                    headers=auth_headers
                )
                # Consume the stream
                async for _ in response.aiter_lines():
                    pass

        assert cost_call_count > 0, "Cost calculation should be called on completion"
```

---

## Phase 3: API Endpoint Tests (Priority 1)

### Endpoint Groups

| Group | Endpoints | Tests |
|-------|-----------|-------|
| Auth | 8 | 30 |
| Conversations | 6 | 25 |
| Streaming (`/message/stream`) | 1 | 15 |
| Billing | 9 | 35 |
| BYOK Lifecycle | 3 | 12 |
| Settings | 4 | 15 |
| Models | 1 | 5 |
| Health | 1 | 2 |

### Test Structure

```python
# backend/tests/api/conftest.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

@pytest.fixture
def client():
    from backend.main import app
    return TestClient(app)

@pytest.fixture
def mock_storage():
    with patch("backend.main.storage") as mock:
        mock.get_conversation = AsyncMock(return_value=None)
        mock.create_conversation = AsyncMock(return_value="conv-123")
        mock.list_conversations = AsyncMock(return_value=[])
        yield mock

@pytest.fixture
def auth_headers():
    from backend.auth_jwt import create_access_token
    token = create_access_token(user_id="test-user", email="test@example.com")
    return {"Authorization": f"Bearer {token}"}
```

```python
# backend/tests/api/test_conversations.py
import pytest

class TestConversationEndpoints:
    def test_create_conversation_success(self, client, mock_storage, auth_headers):
        response = client.post(
            "/api/conversations",
            json={"models": ["openai/gpt-4"], "lead_model": "openai/gpt-4"},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert "id" in response.json()

    def test_create_conversation_unauthorized(self, client, mock_storage):
        response = client.post(
            "/api/conversations",
            json={"models": ["openai/gpt-4"]}
        )
        assert response.status_code == 401

    def test_get_conversation_not_found(self, client, mock_storage, auth_headers):
        mock_storage.get_conversation.return_value = None
        response = client.get(
            "/api/conversations/nonexistent",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_list_conversations(self, client, mock_storage, auth_headers):
        mock_storage.list_conversations.return_value = [
            {"id": "conv-1", "title": "Test", "created_at": "2026-01-01T00:00:00Z"}
        ]
        response = client.get("/api/conversations", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 1
```

```python
# backend/tests/api/test_billing.py
import pytest
from unittest.mock import patch, AsyncMock

class TestBillingEndpoints:
    def test_get_balance(self, client, mock_storage, auth_headers):
        mock_storage.get_balance.return_value = {
            "balance": 4.97,
            "total_deposited": 5.00,
            "total_spent": 0.03
        }
        response = client.get("/api/balance", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["balance"] == 4.97

    def test_get_deposit_options(self, client, mock_storage, auth_headers):
        mock_storage.get_deposit_options.return_value = [
            {"id": "opt-1", "name": "$1 Try It", "amount_cents": 100}
        ]
        response = client.get("/api/deposits/options", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) >= 1

    @patch("backend.main.stripe_client")
    def test_create_checkout(self, mock_stripe, client, mock_storage, auth_headers):
        mock_stripe.create_checkout_session.return_value = {
            "session_id": "cs_test",
            "checkout_url": "https://checkout.stripe.com/test"
        }
        mock_storage.get_deposit_option.return_value = {
            "id": "opt-1",
            "amount_cents": 500
        }

        response = client.post(
            "/api/deposits/checkout",
            json={
                "option_id": "opt-1",
                "success_url": "https://example.com/success",
                "cancel_url": "https://example.com/cancel"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        assert "checkout_url" in response.json()
```

### BYOK Lifecycle Tests

```python
# backend/tests/api/test_byok.py
import pytest
from unittest.mock import patch, AsyncMock

class TestBYOKEndpoints:
    """Test BYOK (Bring Your Own Key) complete lifecycle."""

    @patch("backend.main.openrouter.validate_api_key")
    async def test_set_byok_key_success(
        self, mock_validate, client, mock_storage, auth_headers
    ):
        """Valid OpenRouter key is accepted and mode switches."""
        mock_validate.return_value = True
        mock_storage.set_byok_key = AsyncMock()
        mock_storage.get_api_mode = AsyncMock(return_value={"mode": "byok"})

        response = client.post(
            "/api/settings/byok",
            json={"api_key": "sk-or-v1-valid-key-here"},
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["mode"] == "byok"
        mock_storage.set_byok_key.assert_called_once()

    @patch("backend.main.openrouter.validate_api_key")
    async def test_set_byok_key_invalid_format(
        self, mock_validate, client, mock_storage, auth_headers
    ):
        """Key with wrong prefix is rejected."""
        response = client.post(
            "/api/settings/byok",
            json={"api_key": "invalid-key-no-prefix"},
            headers=auth_headers
        )

        assert response.status_code == 422  # Validation error
        mock_validate.assert_not_called()

    @patch("backend.main.openrouter.validate_api_key")
    async def test_set_byok_key_validation_failure(
        self, mock_validate, client, mock_storage, auth_headers
    ):
        """Key that fails OpenRouter validation is rejected."""
        mock_validate.return_value = False

        response = client.post(
            "/api/settings/byok",
            json={"api_key": "sk-or-v1-invalid-key"},
            headers=auth_headers
        )

        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower()

    async def test_delete_byok_key(self, client, mock_storage, auth_headers):
        """Deleting BYOK key reverts to credits mode."""
        mock_storage.delete_byok_key = AsyncMock()
        mock_storage.get_api_mode = AsyncMock(return_value={"mode": "credits"})

        response = client.delete("/api/settings/byok", headers=auth_headers)

        assert response.status_code == 200
        assert response.json()["mode"] == "credits"

    async def test_get_api_mode_byok(self, client, mock_storage, auth_headers):
        """API mode endpoint returns BYOK status."""
        mock_storage.get_api_mode = AsyncMock(return_value={
            "mode": "byok",
            "has_byok_key": True,
            "byok_key_preview": "...abc123",
            "byok_validated_at": "2026-01-01T12:00:00Z"
        })

        response = client.get("/api/settings/api-mode", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "byok"
        assert data["has_byok_key"] is True

    @patch("backend.main.openrouter_provisioning.create_user_key")
    async def test_provisioning_retry_on_failure(
        self, mock_provision, client, mock_storage, auth_headers
    ):
        """Provisioning endpoint retries failed key creation."""
        mock_provision.side_effect = Exception("OpenRouter down")
        mock_storage.get_balance = AsyncMock(return_value={"balance": 5.00})

        response = client.post("/api/credits/provision-key", headers=auth_headers)

        assert response.status_code == 500
        assert "provision" in response.json()["detail"].lower()

    @patch("backend.main.openrouter_provisioning.update_key_limit")
    async def test_key_limit_update_failure(
        self, mock_update, client, mock_storage, auth_headers
    ):
        """Partial state handled when limit update fails."""
        mock_update.side_effect = Exception("Rate limited")

        # This tests that balance is still recorded even if limit update fails
        # Implementation depends on actual error handling
```

---

## Phase 4: Frontend Tests (Priority 2)

### Dependencies

Add to `frontend/package.json`:

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "msw": "^2.0.0",
    "jsdom": "^22.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### Configuration

```javascript
// frontend/vitest.config.js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
  },
})
```

```javascript
// frontend/src/__tests__/setup.js
import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

export const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### MSW Handlers

```javascript
// frontend/src/__tests__/mocks/handlers.js
import { http, HttpResponse } from 'msw'

const API_BASE = 'http://localhost:8080'

export const handlers = [
  // Auth
  http.get(`${API_BASE}/api/auth/me`, () => {
    return HttpResponse.json({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    })
  }),

  // Conversations
  http.get(`${API_BASE}/api/conversations`, () => {
    return HttpResponse.json([
      { id: 'conv-1', title: 'Test Conversation', created_at: '2026-01-01T00:00:00Z' }
    ])
  }),

  http.post(`${API_BASE}/api/conversations`, () => {
    return HttpResponse.json({ id: 'conv-new', created_at: '2026-01-05T00:00:00Z' })
  }),

  // SSE Streaming endpoint (critical for testing)
  http.post(`${API_BASE}/api/conversations/:id/message/stream`, () => {
    // Return SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const events = [
          'data: {"type":"stage1_start"}\n\n',
          'data: {"type":"stage1_complete","data":[{"model":"openai/gpt-5.1","content":"Test response"}]}\n\n',
          'data: {"type":"stage2_start"}\n\n',
          'data: {"type":"stage2_complete","data":[],"metadata":{}}\n\n',
          'data: {"type":"stage3_start"}\n\n',
          'data: {"type":"stage3_complete","data":{"content":"Final answer"}}\n\n',
          'data: {"type":"title_complete","data":{"title":"Test Question"}}\n\n',
          'data: {"type":"complete"}\n\n',
        ]
        events.forEach((event, i) => {
          setTimeout(() => {
            controller.enqueue(encoder.encode(event))
            if (i === events.length - 1) controller.close()
          }, i * 10)
        })
      }
    })

    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    })
  }),

  // Billing
  http.get(`${API_BASE}/api/balance`, () => {
    return HttpResponse.json({
      balance: 4.97,
      total_deposited: 5.00,
      total_spent: 0.03,
      has_openrouter_key: true
    })
  }),

  // Models
  http.get(`${API_BASE}/api/models`, () => {
    return HttpResponse.json({
      models: ['openai/gpt-5.1', 'anthropic/claude-sonnet-4.5'],
      default_models: ['openai/gpt-5.1'],
      default_lead_model: 'openai/gpt-5.1'
    })
  }),

  // BYOK Settings
  http.get(`${API_BASE}/api/settings/api-mode`, () => {
    return HttpResponse.json({
      mode: 'credits',
      has_byok_key: false,
      balance: 4.97
    })
  }),

  http.post(`${API_BASE}/api/settings/byok`, async ({ request }) => {
    const body = await request.json()
    if (!body.api_key?.startsWith('sk-or-')) {
      return HttpResponse.json({ detail: 'Invalid key format' }, { status: 422 })
    }
    return HttpResponse.json({ mode: 'byok', has_byok_key: true })
  }),

  http.delete(`${API_BASE}/api/settings/byok`, () => {
    return HttpResponse.json({ mode: 'credits', has_byok_key: false })
  }),
]
```

### Component Tests

**Important:** Stage1 component uses `{ model, response }` shape (not `content`), and displays tabs as "Model A", "Model B" etc., not model IDs directly.

```javascript
// frontend/src/__tests__/components/Stage1.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import Stage1 from '../../components/Stage1'

describe('Stage1', () => {
  // Note: Stage1 expects { model, response } not { model, content }
  const mockResponses = [
    { model: 'openai/gpt-5.1', response: 'Response from GPT' },
    { model: 'anthropic/claude-sonnet-4.5', response: 'Response from Claude' },
  ]

  it('renders all model tabs as Model A, Model B, etc.', () => {
    render(<Stage1 responses={mockResponses} />)
    // Tabs show "Model A", "Model B" - not the actual model IDs
    expect(screen.getByText('Model A')).toBeInTheDocument()
    expect(screen.getByText('Model B')).toBeInTheDocument()
  })

  it('shows model identifier in the content area', () => {
    render(<Stage1 responses={mockResponses} />)
    // Model ID is shown in the content header, not the tab
    expect(screen.getByText('openai/gpt-5.1')).toBeInTheDocument()
  })

  it('shows first response by default', () => {
    render(<Stage1 responses={mockResponses} />)
    expect(screen.getByText('Response from GPT')).toBeInTheDocument()
  })

  it('switches tabs on click', async () => {
    const user = userEvent.setup()
    render(<Stage1 responses={mockResponses} />)

    // Click on "Model B" tab
    await user.click(screen.getByRole('tab', { name: /Model B/i }))
    expect(screen.getByText('Response from Claude')).toBeInTheDocument()
    // Model identifier updates
    expect(screen.getByText('anthropic/claude-sonnet-4.5')).toBeInTheDocument()
  })

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<Stage1 responses={mockResponses} />)

    // Find first tab and focus it
    const firstTab = screen.getByRole('tab', { name: /Model A/i })
    firstTab.focus()
    await user.keyboard('{ArrowRight}')

    // Should switch to Model B and show Claude's response
    expect(screen.getByText('Response from Claude')).toBeInTheDocument()
  })

  it('returns null when no responses', () => {
    const { container } = render(<Stage1 responses={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
```

```javascript
// frontend/src/__tests__/components/Account.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import Account from '../../components/Account'

const renderAccount = (props = {}) => {
  return render(
    <BrowserRouter>
      <Account user={{ id: 'user-123', email: 'test@example.com' }} {...props} />
    </BrowserRouter>
  )
}

describe('Account', () => {
  it('renders balance after loading', async () => {
    renderAccount()
    await waitFor(() => {
      expect(screen.getByText('$4.97')).toBeInTheDocument()
    })
  })

  it('switches between Account and History tabs', async () => {
    const user = userEvent.setup()
    renderAccount()

    // Default is Account tab
    await waitFor(() => {
      expect(screen.getByText('Add Funds')).toBeInTheDocument()
    })

    // Switch to History tab
    await user.click(screen.getByText('History'))
    await waitFor(() => {
      expect(screen.getByText('Usage History')).toBeInTheDocument()
    })
  })

  it('shows BYOK form', async () => {
    renderAccount()
    await waitFor(() => {
      expect(screen.getByText('API Settings')).toBeInTheDocument()
    })
  })
})
```

```javascript
// frontend/src/__tests__/api.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { auth, conversations, billing, setTokens, clearTokens } from '../../api'

describe('API Client', () => {
  beforeEach(() => {
    clearTokens()
  })

  describe('auth', () => {
    it('getMe returns user info when authenticated', async () => {
      setTokens({ access_token: 'valid-token', refresh_token: 'refresh' })
      const user = await auth.getMe()
      expect(user.email).toBe('test@example.com')
    })

    it('getMe throws when not authenticated', async () => {
      await expect(auth.getMe()).rejects.toThrow()
    })
  })

  describe('conversations', () => {
    beforeEach(() => {
      setTokens({ access_token: 'valid-token', refresh_token: 'refresh' })
    })

    it('list returns conversations', async () => {
      const convs = await conversations.list()
      expect(Array.isArray(convs)).toBe(true)
    })
  })

  describe('billing', () => {
    beforeEach(() => {
      setTokens({ access_token: 'valid-token', refresh_token: 'refresh' })
    })

    it('getBalance returns balance info', async () => {
      const balance = await billing.getBalance()
      expect(balance.balance).toBe(4.97)
    })
  })
})
```

### Frontend SSE Parsing Tests (Critical)

Test the `sendMessageStream()` function in `api.js` which handles SSE parsing.

```javascript
// frontend/src/__tests__/api-sse.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendMessageStream, setTokens, clearTokens } from '../../api'

describe('SSE Streaming Parser', () => {
  beforeEach(() => {
    setTokens({ access_token: 'valid-token', refresh_token: 'refresh' })
  })

  it('parses SSE events in correct order', async () => {
    const events = []
    const callbacks = {
      onStage1Start: () => events.push('stage1_start'),
      onStage1Complete: (data) => events.push({ type: 'stage1_complete', data }),
      onStage2Start: () => events.push('stage2_start'),
      onStage2Complete: (data, meta) => events.push({ type: 'stage2_complete', data, meta }),
      onStage3Start: () => events.push('stage3_start'),
      onStage3Complete: (data) => events.push({ type: 'stage3_complete', data }),
      onTitleComplete: (title) => events.push({ type: 'title', title }),
      onComplete: () => events.push('complete'),
      onError: (err) => events.push({ type: 'error', err }),
    }

    await sendMessageStream('conv-123', 'test question', callbacks)

    // Verify ordering
    expect(events[0]).toBe('stage1_start')
    expect(events[1].type).toBe('stage1_complete')
    expect(events[events.length - 1]).toBe('complete')
  })

  it('handles chunk boundary buffering', async () => {
    // Test that partial SSE data across chunks is handled correctly
    // This tests the buffering logic in the SSE parser
    const events = []
    const callbacks = {
      onStage1Start: () => events.push('stage1_start'),
      onComplete: () => events.push('complete'),
      onError: vi.fn(),
    }

    await sendMessageStream('conv-123', 'test', callbacks)

    // Should not have any parsing errors
    expect(callbacks.onError).not.toHaveBeenCalled()
  })

  it('routes error events to onError callback', async () => {
    // Override MSW handler to return error
    server.use(
      http.post('http://localhost:8080/api/conversations/:id/message/stream', () => {
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"type":"error","message":"Model failed"}\n\n'))
            controller.close()
          }
        })
        return new HttpResponse(stream, {
          headers: { 'Content-Type': 'text/event-stream' }
        })
      })
    )

    const onError = vi.fn()
    await sendMessageStream('conv-123', 'test', { onError })

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('failed'))
  })

  it('handles connection errors gracefully', async () => {
    server.use(
      http.post('http://localhost:8080/api/conversations/:id/message/stream', () => {
        return HttpResponse.error()
      })
    )

    const onError = vi.fn()
    await sendMessageStream('conv-123', 'test', { onError })

    expect(onError).toHaveBeenCalled()
  })

  it('UI recovers to usable state after error', async () => {
    // This tests that after an error, the UI can still function
    // (e.g., user can submit another query)
    server.use(
      http.post('http://localhost:8080/api/conversations/:id/message/stream', () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 })
      })
    )

    let errorOccurred = false
    await sendMessageStream('conv-123', 'test', {
      onError: () => { errorOccurred = true }
    })

    expect(errorOccurred).toBe(true)

    // Reset handler to success
    server.resetHandlers()

    // Verify subsequent request works
    const events = []
    await sendMessageStream('conv-123', 'test2', {
      onComplete: () => events.push('complete')
    })
    expect(events).toContain('complete')
  })
})
```

---

## Phase 5: E2E Tests + CI/CD

### Playwright Setup

```bash
npm init playwright@latest
```

```javascript
// frontend/e2e/oauth-flow.spec.js
import { test, expect } from '@playwright/test'

test.describe('OAuth Flow', () => {
  test('redirects to login screen when not authenticated', async ({ page }) => {
    // Clear any existing auth
    await page.addInitScript(() => {
      localStorage.removeItem('ai_council_access_token')
      localStorage.removeItem('ai_council_refresh_token')
    })

    await page.goto('/')

    // App shows login UI when not authenticated (no /login route - it's inline)
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /github/i })).toBeVisible()
  })

  test('shows OAuth provider buttons', async ({ page }) => {
    await page.goto('/')
    // Login UI is shown on main page when unauthenticated
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /continue with github/i })).toBeVisible()
  })
})
```

```javascript
// frontend/e2e/conversation-flow.spec.js
import { test, expect } from '@playwright/test'

test.describe('Conversation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth state using correct localStorage keys
    await page.addInitScript(() => {
      localStorage.setItem('ai_council_access_token', 'test-token')
      localStorage.setItem('ai_council_refresh_token', 'test-refresh')
    })
  })

  test('creates new conversation and displays stages', async ({ page }) => {
    await page.goto('/')

    // Use actual selectors - textarea and button (no data-testid attributes)
    // Find the query textarea by placeholder or role
    const textarea = page.getByRole('textbox', { name: /question|ask|inquiry/i })
      .or(page.locator('textarea'))
    await textarea.fill('What is the meaning of life?')

    // Find submit button by text or role
    const submitButton = page.getByRole('button', { name: /ask|submit|send/i })
    await submitButton.click()

    // Wait for stages - these are actual text in the UI
    await expect(page.getByText('Quintessence')).toBeVisible({ timeout: 60000 })
  })
})
```

```javascript
// frontend/e2e/demo-flow.spec.js
import { test, expect } from '@playwright/test'

test.describe('Demo Page (Unauthenticated)', () => {
  test('public /demo route accessible without auth', async ({ page }) => {
    // Clear any existing auth
    await page.addInitScript(() => {
      localStorage.removeItem('ai_council_access_token')
      localStorage.removeItem('ai_council_refresh_token')
    })

    await page.goto('/demo')

    // Should not redirect - demo is public
    await expect(page).toHaveURL(/.*demo/)

    // Should show demo content (check for actual UI text)
    await expect(page.getByText(/example|demo/i)).toBeVisible()
  })

  test('demo displays deliberation stages', async ({ page }) => {
    await page.goto('/demo')

    // Demo should show example deliberations
    // Use flexible selectors since exact text may vary
    await expect(page.getByText('Quintessence').or(page.getByText('Final Answer'))).toBeVisible()
  })

  test('demo has navigation to sign up', async ({ page }) => {
    await page.goto('/demo')

    // Should have link to login/sign up
    await expect(
      page.getByRole('link', { name: /sign|login|try|start/i })
        .or(page.getByRole('button', { name: /sign|login|try|start/i }))
    ).toBeVisible()
  })
})
```

### GitHub Actions CI

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v1

      - name: Install dependencies
        run: uv sync --extra test

      - name: Run tests (local storage)
        run: uv run pytest --cov=backend --cov-report=xml
        # Tests run against storage_local.py by default (no DATABASE_URL)

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml

  # Optional: Run PostgreSQL integration tests
  backend-postgres:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: quinthesis_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v1

      - name: Install dependencies
        run: uv sync --extra test

      - name: Run migrations
        run: uv run python -m backend.migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/quinthesis_test

      - name: Run Postgres tests
        run: uv run pytest -m "postgres" --cov=backend --cov-report=xml
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/quinthesis_test

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Run tests
        run: cd frontend && npm test -- --run

      - name: Build
        run: cd frontend && npm run build

  e2e:
    runs-on: ubuntu-latest
    needs: [backend, frontend]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Install Playwright
        run: cd frontend && npx playwright install --with-deps

      - name: Run E2E tests
        run: cd frontend && npx playwright test
```

### Postgres Test Gating

Use pytest markers to gate tests that require PostgreSQL:

```python
# backend/tests/conftest.py
import pytest
import os

# Custom marker for Postgres-only tests
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "postgres: mark test as requiring PostgreSQL"
    )

# Skip Postgres tests when DATABASE_URL not set
requires_postgres = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set - skipping Postgres tests"
)

# Example usage in tests:
# @requires_postgres
# async def test_postgres_storage():
#     ...
```

```ini
# pytest.ini or pyproject.toml [tool.pytest.ini_options]
markers = [
    "postgres: mark test as requiring PostgreSQL database",
]
```

---

## Directory Structure

```
backend/
├── tests/
│   ├── __init__.py
│   ├── conftest.py                 # Shared fixtures, Postgres marker
│   ├── unit/
│   │   ├── __init__.py
│   │   ├── test_council.py
│   │   ├── test_auth_jwt.py
│   │   ├── test_encryption.py
│   │   ├── test_rate_limit.py
│   │   ├── test_oauth_state.py
│   │   └── test_models.py
│   ├── integration/
│   │   ├── __init__.py
│   │   ├── test_openrouter.py
│   │   ├── test_oauth.py
│   │   ├── test_stripe.py
│   │   ├── test_provisioning.py
│   │   ├── test_storage.py         # Postgres tests (@requires_postgres)
│   │   ├── test_storage_local.py   # Local JSON storage (temp dirs)
│   │   └── test_sse_streaming.py   # SSE event ordering, keepalive, errors
│   └── api/
│       ├── __init__.py
│       ├── conftest.py             # API-specific fixtures
│       ├── test_auth_endpoints.py
│       ├── test_conversation_endpoints.py
│       ├── test_billing_endpoints.py
│       ├── test_byok_endpoints.py  # BYOK lifecycle tests
│       └── test_settings_endpoints.py

frontend/
├── vitest.config.js
├── src/
│   └── __tests__/
│       ├── setup.js                # Global test setup
│       ├── mocks/
│       │   └── handlers.js         # MSW handlers (incl. SSE streaming)
│       ├── components/
│       │   ├── Stage1.test.jsx
│       │   ├── Stage2.test.jsx
│       │   ├── Stage3.test.jsx
│       │   ├── ChatInterface.test.jsx
│       │   ├── Account.test.jsx
│       │   ├── Login.test.jsx
│       │   └── Sidebar.test.jsx
│       ├── api.test.js
│       ├── api-sse.test.js         # SSE parsing, buffering, error handling
│       └── integration/
│           └── oauth-flow.test.jsx
├── e2e/
│   ├── oauth-flow.spec.js
│   ├── conversation-flow.spec.js
│   ├── demo-flow.spec.js           # Public /demo route (unauthenticated)
│   └── billing-flow.spec.js
└── playwright.config.js
```

---

## Key Mocking Challenges

### 1. Async Database Operations

**Problem:** Storage functions use asyncpg with async/await
**Solution:** Use `pytest.mark.asyncio` and `AsyncMock`

```python
@pytest.fixture
async def mock_db_pool(mocker):
    pool = AsyncMock()
    pool.fetch.return_value = []
    pool.fetchrow.return_value = None
    return pool
```

### 2. SSE Streaming Responses

**Problem:** `POST /message/stream` returns Server-Sent Events
**Solution:** Mock at the function level, not HTTP level

```python
@pytest.fixture
def mock_council(mocker):
    async def mock_run(*args, **kwargs):
        yield {"type": "stage1_start"}
        yield {"type": "stage1_complete", "data": [...]}
        yield {"type": "complete"}
    mocker.patch("backend.council.run_full_council_streaming", mock_run)
```

### 3. OAuth State Management

**Problem:** OAuth state uses in-memory storage with TTL
**Solution:** Test state generation and validation independently

```python
@pytest.mark.asyncio
async def test_state_expires():
    state = await create_state(user_data={}, ttl_seconds=1)
    await asyncio.sleep(2)
    with pytest.raises(ValueError):
        await validate_state(state)
```

### 4. Frontend Auth State

**Problem:** Components depend on auth context
**Solution:** Wrap components in test providers

```javascript
const renderWithAuth = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider value={{ user: mockUser, isAuthenticated: true }}>
        {component}
      </AuthProvider>
    </BrowserRouter>
  )
}
```

---

## Phased Implementation Plan

### Priority Matrix

| Area | Risk if Broken | Likelihood of Bugs | Test Complexity | Priority |
|------|----------------|-------------------|-----------------|----------|
| SSE Streaming | **Critical** (core UX) | High (async, parsing) | Medium | **P0** |
| Billing/Costs | **Critical** (money) | Medium | Low | **P0** |
| Council Logic | High (wrong answers) | Medium (parsing) | Low | **P1** |
| Auth/JWT | High (security) | Low (stable) | Low | **P1** |
| BYOK Flow | Medium | Medium | Medium | **P2** |
| Storage | Medium | Low | Medium | **P2** |

---

### Phase 0: Foundation (Day 1)

**Goal:** Get test infrastructure running with one passing test

**Effort:** 2-3 hours
**Impact:** Unblocks everything else

**Tasks:**
1. Add test dependencies to `pyproject.toml`
2. Create `backend/tests/conftest.py` with basic fixtures
3. Write ONE test (`test_council.parse_ranking_from_text`)
4. Verify `uv run pytest` works
5. Add frontend test deps to `package.json`
6. Create `vitest.config.js` and setup file
7. Write ONE frontend test (Stage1 renders)
8. Verify `npm test` works

**Deliverable:** `uv run pytest` and `npm test` both pass

---

### Phase 1: Critical Path - Backend (Week 1)

**Goal:** Cover the two highest-risk areas

#### 1A: Council Logic (4 hours)

```
backend/tests/unit/test_council.py
18 tests covering:
- parse_ranking_from_text() - 10 edge cases
- calculate_aggregate_rankings() - 8 scenarios
```

**Why first:** Pure functions, no mocking needed, high bug surface area in parsing.

#### 1B: Billing Cost Calculation (4 hours)

```
backend/tests/unit/test_billing.py
backend/tests/api/test_billing_endpoints.py
15 tests covering:
- Cost calculation (margin, rounding)
- Balance checks before query
- Webhook idempotency
```

**Why:** Money is involved. Bugs here = user complaints or revenue loss.

#### 1C: SSE Streaming Backend (6 hours)

```
backend/tests/integration/test_sse_streaming.py
10 tests covering:
- Event ordering (stage1_start → complete)
- Error propagation
- Client disconnect handling
```

**Why:** Core UX. If streaming breaks, the app is unusable.

**Phase 1 Deliverable:** ~43 tests, council + billing + SSE backend covered

---

### Phase 2: Critical Path - Frontend (Week 2)

**Goal:** Cover frontend SSE and key components

#### 2A: SSE Parser in api.js (4 hours)

```
frontend/src/__tests__/api-sse.test.js
8 tests covering:
- Event parsing and callback routing
- Chunk boundary buffering
- Error handling → UI recovery
```

#### 2B: Core Components (6 hours)

```
Stage1, Stage2, Stage3, ChatInterface
20 tests covering:
- Render with data
- Loading/error states
- Tab navigation
```

#### 2C: CI Pipeline (2 hours)

```
.github/workflows/test.yml
- Backend tests (local storage)
- Frontend tests
- Build verification
```

**Phase 2 Deliverable:** ~28 tests, CI running on every PR

---

### Phase 3: Auth & Security (Week 3)

**Goal:** Secure the security-critical paths

#### 3A: JWT Tests (3 hours)

```
backend/tests/unit/test_auth_jwt.py
15 tests: create, verify, expired, invalid, refresh
```

#### 3B: OAuth State/PKCE (3 hours)

```
backend/tests/unit/test_oauth_state.py
10 tests: state generation, validation, TTL, PKCE
```

#### 3C: Rate Limiting (2 hours)

```
backend/tests/unit/test_rate_limit.py
10 tests: under limit, at limit, cleanup
```

#### 3D: Auth Endpoints (4 hours)

```
backend/tests/api/test_auth_endpoints.py
20 tests: OAuth flow, refresh, /me, account deletion
```

**Phase 3 Deliverable:** ~55 tests, auth fully covered

---

### Phase 4: BYOK & Storage (Week 4)

**Goal:** Cover remaining integration points

#### 4A: BYOK Lifecycle (4 hours)

```
backend/tests/api/test_byok_endpoints.py
12 tests: set/validate/delete, mode switching
```

#### 4B: Local Storage (3 hours)

```
backend/tests/integration/test_storage_local.py
12 tests: CRUD with temp directory isolation
```

#### 4C: Encryption (2 hours)

```
backend/tests/unit/test_encryption.py
12 tests: encrypt/decrypt/rotate
```

#### 4D: Account Page Frontend (3 hours)

```
frontend/src/__tests__/components/Account.test.jsx
10 tests: tabs, balance, BYOK form, history
```

**Phase 4 Deliverable:** ~46 tests

---

### Phase 5: E2E & Polish (Week 5)

**Goal:** End-to-end confidence + coverage gaps

#### 5A: E2E Tests (4 hours)

```
Playwright tests:
- demo-flow.spec.js (unauthenticated)
- oauth-flow.spec.js (login gate)
- conversation-flow.spec.js (full query)
```

#### 5B: Remaining Frontend Components (4 hours)

```
Sidebar, Login, ConfirmDialog
~15 tests
```

#### 5C: Postgres Tests (Optional, 3 hours)

```
@requires_postgres marked tests
CI job with Postgres service
```

**Phase 5 Deliverable:** ~15 E2E + ~15 component tests

---

### Time-Constrained Option (8 Hours)

If you only have **8 hours**, focus on highest-risk areas:

| Hours | Task | Tests | Coverage |
|-------|------|-------|----------|
| 0-2 | Setup + council parsing | 10 | Core logic |
| 2-4 | SSE streaming backend | 8 | Critical UX |
| 4-6 | Billing cost calculation | 8 | Money safety |
| 6-8 | CI pipeline + 1 frontend test | 1 | Regression prevention |

This gives **~27 tests** covering the highest-risk areas with CI running.

---

### Phase Summary

| Phase | Focus | Tests | Cumulative | Time |
|-------|-------|-------|------------|------|
| 0 | Foundation | 2 | 2 | 2-3 hrs |
| 1 | Backend critical (council, billing, SSE) | 43 | 45 | 14 hrs |
| 2 | Frontend critical (SSE, components, CI) | 28 | 73 | 12 hrs |
| 3 | Auth & security | 55 | 128 | 12 hrs |
| 4 | BYOK & storage | 46 | 174 | 12 hrs |
| 5 | E2E & polish | 30 | 204 | 11 hrs |

**Note:** Remaining ~216 tests from the full plan are lower-priority edge cases that can be added incrementally after the core coverage is in place.

---

## Coverage Goals

| Area | Target | Notes |
|------|--------|-------|
| Backend unit | 90% | Pure logic, no external deps |
| Backend integration | 80% | External services mocked |
| API endpoints | 85% | All routes covered |
| Frontend components | 70% | Critical paths |
| E2E | Critical paths only | OAuth, query, billing |

---

## Running Tests

### Backend

```bash
# Install test dependencies
uv sync --extra test

# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=backend --cov-report=html

# Run specific test file
uv run pytest backend/tests/unit/test_council.py

# Run with verbose output
uv run pytest -v
```

### Frontend

```bash
cd frontend

# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run E2E tests
npx playwright test
```

---

## Next Steps

### Immediate (Phase 0)
```bash
# Backend - add test dependencies
uv add --optional test pytest pytest-asyncio pytest-cov pytest-mock respx freezegun

# Create test directories
mkdir -p backend/tests/unit backend/tests/integration backend/tests/api
touch backend/tests/__init__.py backend/tests/conftest.py

# Frontend - add test dependencies
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event msw jsdom
```

### Then Follow Phased Plan
1. **Phase 0:** Get `uv run pytest` and `npm test` passing with 1 test each
2. **Phase 1:** Council logic + billing + SSE streaming (~43 tests)
3. **Phase 2:** Frontend SSE + components + CI pipeline (~28 tests)
4. **Phase 3:** Auth & security (~55 tests)
5. **Phase 4:** BYOK & storage (~46 tests)
6. **Phase 5:** E2E & polish (~30 tests)

### Progress Tracking
- [x] Phase 0 complete - foundation
- [x] Phase 1 complete - critical backend (council, billing, SSE)
- [x] Phase 2 complete - critical frontend + CI (442 frontend tests, GitHub Actions)
- [x] Phase 3 complete - auth & security (JWT, OAuth state, rate limiting)
- [x] Phase 4 complete - BYOK & storage (local storage, encryption)
- [x] Phase 5 complete - third-party mocks (openrouter, stripe, provisioning) + CI workflow
- [ ] Phase 5 E2E tests - skipped (Playwright E2E tests not implemented)
