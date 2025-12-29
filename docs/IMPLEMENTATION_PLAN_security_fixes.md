# Implementation Plan: Security & Quality Fixes

**Created:** 2025-12-28
**Updated:** 2025-12-28
**Based on:** ai-council-review-codex-20251228-154048.md (Codex review + Claude Opus 4.5 response)
**Priority:** Must complete High items before public launch

---

## Progress Summary

| Phase | Item | Status | PR |
|-------|------|--------|-----|
| 1.1 | OAuth State Validation & PKCE | ✅ Complete | [#16](https://github.com/anbuneel/ai-council/pull/16) |
| 1.2 | Fail-Fast Secret Validation | ✅ Complete | [#17](https://github.com/anbuneel/ai-council/pull/17) |
| 1.3 | Complete Database Migrations | ⚠️ Deprioritized | N/A (DevOps, not security) |
| 1.4 | Rate Limiting & Request Size Limits | ✅ Complete | [#18](https://github.com/anbuneel/ai-council/pull/18) |
| 2.1 | Fix SSE Parsing | ✅ Complete | [#19](https://github.com/anbuneel/ai-council/pull/19) |
| 2.2 | GitHub Users Without Verified Email | ✅ Complete | [#19](https://github.com/anbuneel/ai-council/pull/19) |
| 2.3 | ORDER BY Stage Response Queries | ✅ Complete | [#19](https://github.com/anbuneel/ai-council/pull/19) |
| 2.4 | Title Generation Model Fallback | ⏭️ Skipped | N/A (current behavior acceptable) |
| 3.1 | Archive Items Keyboard Accessibility | ✅ Complete | [#20](https://github.com/anbuneel/ai-council/pull/20) |
| 3.2 | Settings Modal Dialog Semantics | ✅ Complete | [#20](https://github.com/anbuneel/ai-council/pull/20) |
| 3.3 | Local Storage API Key ID Fix | ✅ Complete | [#20](https://github.com/anbuneel/ai-council/pull/20) |
| 3.4 | Documentation Updates | ✅ Complete | [#20](https://github.com/anbuneel/ai-council/pull/20) |

---

## Phase 1: Critical Security Fixes (Launch Blockers)

### 1.1 OAuth State Validation & PKCE ✅ COMPLETED

**Status:** Implemented in PR #16 (`security/oauth-state-validation`)
**Completed:** 2025-12-28

**Files created/modified:**
- `backend/oauth_state.py` (NEW) - Server-side state storage with PKCE
- `backend/oauth.py` - Added PKCE parameters to OAuth handlers
- `backend/main.py` - Uses state validation before token exchange
- `backend/models.py` - Made state field required
- `frontend/src/api.js` - Strict state validation with explicit errors

**Implementation details:**
- Server-side state storage with 10-minute TTL
- PKCE implementation using S256 code challenge method
- One-time state consumption (prevents replay attacks)
- Frontend fails hard on missing/mismatched state
- Google OAuth uses full PKCE flow
- GitHub OAuth uses state validation (PKCE not supported by GitHub)

---

### 1.2 Fail-Fast Secret Validation ✅ COMPLETED

**Status:** Implemented in PR #17 (`security/fail-fast-secrets`)
**Completed:** 2025-12-28

**Files modified:**
- `backend/config.py` - Added `IS_PRODUCTION` detection and `validate_secrets()` function
- `backend/main.py` - Calls `validate_secrets()` in lifespan startup

**Implementation details:**
- Production detection via `FLY_APP_NAME` or `PRODUCTION=true` env vars
- Validates at startup: JWT_SECRET, API_KEY_ENCRYPTION_KEY, OAuth credentials, DATABASE_URL
- In production: raises `RuntimeError` with all errors listed (fails fast)
- In development: logs warnings only, allows app to start
- Provides helpful error messages with generation commands for keys

---

### 1.3 Complete Database Migrations

**Files to create:**
- `backend/migrations/005_create_conversations_table.sql`
- `backend/migrations/006_create_messages_table.sql`
- `backend/migrations/007_create_stage_responses_tables.sql`

**Implementation steps:**

1. **Create conversations table migration**
   ```sql
   -- 005_create_conversations_table.sql
   CREATE TABLE IF NOT EXISTS conversations (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       title VARCHAR(255) DEFAULT 'New Conversation',
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       models JSONB,
       lead_model TEXT,
       user_id UUID REFERENCES users(id) ON DELETE CASCADE
   );

   CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
   CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
   ```

2. **Create messages table migration**
   ```sql
   -- 006_create_messages_table.sql
   CREATE TABLE IF NOT EXISTS messages (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
       role VARCHAR(50) NOT NULL,
       content TEXT,
       message_order INTEGER NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
   ```

3. **Create stage responses tables migration**
   ```sql
   -- 007_create_stage_responses_tables.sql
   CREATE TABLE IF NOT EXISTS stage1_responses (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
       model TEXT NOT NULL,
       response TEXT,
       display_order INTEGER DEFAULT 0
   );

   CREATE TABLE IF NOT EXISTS stage2_responses (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
       model TEXT NOT NULL,
       evaluation TEXT,
       ranking JSONB,
       display_order INTEGER DEFAULT 0
   );

   CREATE INDEX IF NOT EXISTS idx_stage1_message_id ON stage1_responses(message_id);
   CREATE INDEX IF NOT EXISTS idx_stage2_message_id ON stage2_responses(message_id);
   ```

4. **Fix ensure_schema() error handling**
   ```python
   # backend/storage.py
   async def ensure_schema():
       global _schema_ready
       if _schema_ready:
           return
       try:
           await db.execute("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS models JSONB")
           await db.execute("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_model TEXT")
           await db.execute("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id UUID")
           _schema_ready = True
       except Exception as e:
           import logging
           logging.error(f"Schema migration failed: {e}")
           raise  # Don't swallow errors
   ```

---

### 1.4 Rate Limiting & Request Size Limits ✅ COMPLETED

**Status:** Implemented in PR #18 (`security/rate-limiting`)
**Completed:** 2025-12-28

**Files created/modified:**
- `backend/rate_limit.py` (NEW) - Rate limiter with sliding window algorithm
- `backend/main.py` - Request size middleware and rate limit checks

**Implementation details:**
- Request body size limit: 1MB max (returns 413 if exceeded)
- Streaming/message endpoints: 10 requests/minute per user
- Thread-safe with asyncio.Lock
- Sliding window algorithm for accurate rate limiting
- Logs warnings when rate limit exceeded
- Single-instance only (same as OAuth state - use Redis for multi-instance)

**Rate limits applied to:**
- `POST /api/conversations/{id}/message` - 10/min
- `POST /api/conversations/{id}/message/stream` - 10/min

3. **Apply to streaming endpoint**
   ```python
   @app.post("/api/conversations/{conversation_id}/message/stream")
   async def stream_message(...):
       rate_limiter.check(str(user_id))
       # ... rest of handler
   ```

---

## Phase 2: Medium Priority Fixes

### 2.1 Fix SSE Parsing ✅ COMPLETED

**Status:** Implemented in PR #19 (`security/phase2-medium-fixes`)
**Completed:** 2025-12-28

**File modified:** `frontend/src/api.js`

**Implementation details:**
- Added buffer to accumulate incomplete lines between chunks
- Use `decoder.decode(value, { stream: true })` for proper UTF-8 handling
- Keep incomplete line in buffer with `buffer = lines.pop() || ''`
- Flush decoder and process remaining buffer at stream end
- Prevents silent data loss when JSON payloads span multiple chunks

---

### 2.2 Handle GitHub Users Without Verified Email ✅ COMPLETED

**Status:** Implemented in PR #19 (`security/phase2-medium-fixes`)
**Completed:** 2025-12-28

**File modified:** `backend/oauth.py`

**Implementation details:**
- Added explicit check after email lookup loop
- Raises `ValueError` with user-friendly message if no verified email found
- Error is caught by existing exception handler and returned as HTTP 400
- Message: "GitHub account requires a verified primary email address. Please add and verify an email in your GitHub settings."

---

### 2.3 Add ORDER BY to Stage Response Queries ✅ COMPLETED

**Status:** Implemented in PR #19 (`security/phase2-medium-fixes`)
**Completed:** 2025-12-28

**File modified:** `backend/storage.py`

**Implementation details:**
- Added `ORDER BY model ASC` to stage1_responses query
- Added `ORDER BY model ASC` to stage2_rankings query
- Ensures consistent ordering across page loads
- Note: `display_order` column not implemented; alphabetical by model is sufficient

---

### 2.4 Title Generation Model Fallback ⏭️ SKIPPED

**Status:** Skipped - current behavior is acceptable
**Reason:** The hardcoded `google/gemini-2.5-flash` is intentionally chosen for:
- Fast response times (title generation shouldn't block UI)
- Low cost (simple task doesn't need expensive models)
- Already has fallback to "New Conversation" if model fails

Using lead_model would increase latency and cost for marginal benefit.

---

## Phase 3: Low Priority Fixes

### 3.1 Archive Items Keyboard Accessibility ✅ COMPLETED

**Status:** Implemented in PR #20 (`security/phase3-low-priority-fixes`)
**Completed:** 2025-12-28

**File modified:** `frontend/src/components/Sidebar.jsx`

**Implementation details:**
- Added `role="button"` for semantic meaning
- Added `tabIndex={0}` for keyboard focusability
- Added `onKeyDown` handler for Enter and Space keys
- Added `aria-current="true"` for active conversation

---

### 3.2 Settings Modal Dialog Semantics ✅ COMPLETED

**Status:** Implemented in PR #20 (`security/phase3-low-priority-fixes`)
**Completed:** 2025-12-28

**File modified:** `frontend/src/components/Settings.jsx`

**Implementation details:**
- Added `role="presentation"` to overlay
- Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby="settings-title"` to modal
- Added `id="settings-title"` to h2 heading
- Implemented manual focus trap (Tab cycles within modal)
- Added Escape key handler to close modal
- Focus returns to previously focused element on close

---

### 3.3 Local Storage API Key ID Fix ✅ COMPLETED

**Status:** Implemented in PR #20 (`security/phase3-low-priority-fixes`)
**Completed:** 2025-12-28

**File modified:** `backend/storage_local.py`

**Implementation details:**
- Added `id` field to `get_user_api_keys()` return value
- Added fallback for `updated_at` field (uses `created_at` if missing)

---

### 3.4 Documentation Updates ✅ COMPLETED

**Status:** Implemented in PR #20 (`security/phase3-low-priority-fixes`)
**Completed:** 2025-12-28

**Files modified:** `CLAUDE.md`, `AGENTS.md`

**Implementation details:**
- Fixed `evaluation` -> `ranking` in Stage 2 response example
- Fixed `avg_position` -> `average_rank` in aggregate_rankings example

---

## Testing Checklist

### Unit Tests (Priority)
- [ ] OAuth state creation and validation
- [ ] PKCE code challenge/verifier generation
- [ ] Rate limiter behavior
- [ ] SSE parsing with chunked data

### Integration Tests
- [ ] OAuth full flow with state validation
- [ ] Token refresh with invalid/expired tokens
- [ ] API key encryption/decryption
- [ ] Database migrations on clean database

### Manual Testing
- [ ] GitHub OAuth with user without verified email (should fail gracefully)
- [ ] Rate limit trigger and recovery
- [ ] Keyboard navigation through archive
- [ ] Screen reader testing for Settings modal

---

## Deployment Notes

1. **Before deploying Phase 1:**
   - Ensure all environment secrets are set in Fly.io
   - Run database migrations: `uv run python -m backend.migrate`
   - Test OAuth flows in staging environment

2. **Rollback plan:**
   - OAuth state validation can be disabled via environment flag if issues arise
   - Rate limiting can be adjusted or disabled via config

3. **Monitoring:**
   - Add logging for rate limit triggers
   - Alert on OAuth state validation failures (potential attack indicator)
