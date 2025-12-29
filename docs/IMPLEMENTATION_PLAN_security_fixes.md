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
| 2.x | Medium Priority Fixes | ⏳ Pending | - |
| 3.x | Low Priority Fixes | ⏳ Pending | - |

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

### 2.1 Fix SSE Parsing

**File:** `frontend/src/api.js`

```javascript
// Replace current SSE parsing with proper buffering
async sendMessageStream(conversationId, content, onEvent) {
    // ... existing setup ...

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';  // Keep incomplete line in buffer

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                try {
                    const event = JSON.parse(data);
                    onEvent(event.type, event);
                } catch (e) {
                    console.error('Failed to parse SSE event:', e);
                }
            }
        }
    }

    // Process any remaining buffer
    decoder.decode();  // Flush
}
```

### 2.2 Handle GitHub Users Without Verified Email

**File:** `backend/oauth.py`

```python
# After email lookup loop, add fallback
if not email:
    raise HTTPException(
        status_code=400,
        detail="GitHub account requires a verified email address"
    )
```

### 2.3 Add ORDER BY to Stage Response Queries

**File:** `backend/storage.py`

```python
# Line ~151
stage1_rows = await db.fetch(
    """
    SELECT model, response
    FROM stage1_responses
    WHERE message_id = $1
    ORDER BY display_order ASC, model ASC
    """,
    message_id
)

# Similar for stage2_responses
```

### 2.4 Title Generation Model Fallback

**File:** `backend/council.py`

```python
async def generate_title(user_query: str, api_key: str, lead_model: str = None) -> str:
    # Use lead model if provided, else fallback
    title_model = lead_model or "google/gemini-2.5-flash"

    # Try with selected model, fallback to default if it fails
    response = await query_model(title_model, messages, timeout=30.0, api_key=api_key)
    if response is None and title_model != "google/gemini-2.5-flash":
        response = await query_model("google/gemini-2.5-flash", messages, timeout=30.0, api_key=api_key)
    # ...
```

---

## Phase 3: Low Priority Fixes

### 3.1 Archive Items Keyboard Accessibility

**File:** `frontend/src/components/Sidebar.jsx`

```jsx
// Replace div with button or add keyboard support
<div
    key={conv.id}
    className={`case-item ${conv.id === currentConversationId ? 'active' : ''}`}
    onClick={() => handleSelectConversation(conv.id)}
    onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelectConversation(conv.id);
        }
    }}
    role="button"
    tabIndex={0}
    aria-current={conv.id === currentConversationId ? 'true' : undefined}
>
```

### 3.2 Settings Modal Dialog Semantics

**File:** `frontend/src/components/Settings.jsx`

```jsx
<div
    className="settings-overlay"
    onClick={onClose}
    role="presentation"
>
    <div
        className="settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
    >
        <h2 id="settings-title">Settings</h2>
        {/* ... */}
    </div>
</div>
```

Add focus trap using a library like `focus-trap-react` or manual implementation.

### 3.3 Local Storage API Key ID Fix

**File:** `backend/storage_local.py`

Ensure returned API key metadata includes an `id` field:

```python
return {
    "id": key_file.stem,  # Use filename as ID
    "provider": data.get("provider"),
    "hint": data.get("hint"),
    # ...
}
```

### 3.4 Documentation Updates

**Files:** `CLAUDE.md`, `AGENTS.md`

Update field names to match actual API:
- `evaluation` -> `ranking` (Stage 2)
- `avg_position` -> `average_rank` (aggregate rankings)

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
