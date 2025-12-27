# Phase 1 Implementation Plan: Multi-User Support

## Status: COMPLETED

**Completed**: December 26, 2025
**Commit**: `e8862b5` - "Phase 1: Multi-user support with JWT auth and BYOK API keys"

---

## Implementation Summary

### Backend Changes

**New Files:**
- `backend/auth_jwt.py` - JWT token creation/verification (access + refresh tokens)
- `backend/encryption.py` - Password hashing (bcrypt) and API key encryption (Fernet)
- `backend/models.py` - Pydantic schemas for auth and settings endpoints
- `backend/migrate.py` - Database migration runner
- `backend/migrations/` - SQL migration files:
  - `001_create_users_table.sql` - Users table with email/password_hash
  - `002_create_api_keys_table.sql` - User API keys with encryption
  - `003_add_user_id_to_conversations.sql` - Add user_id foreign key to conversations

**Modified Files:**
- `backend/main.py` - Added auth endpoints (`/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/me`) and settings endpoints (`/api/settings/api-key`, `/api/settings/api-keys`). Updated all conversation endpoints to use JWT auth with user isolation.
- `backend/storage.py` - Added user management functions (`create_user`, `get_user_by_email`, `get_user_by_id`) and API key functions (`save_user_api_key`, `get_user_api_key`, `get_user_api_keys`, `delete_user_api_key`). Updated conversation functions to accept optional `user_id` parameter.
- `backend/openrouter.py` - Added `api_key` parameter to `query_model` and `query_models_parallel` for per-user API keys
- `backend/council.py` - Pass `api_key` through all stage functions (`stage1_collect_responses`, `stage2_collect_rankings`, `stage3_synthesize_final`, `generate_conversation_title`, `run_full_council`)
- `backend/config.py` - Added `JWT_SECRET` and `API_KEY_ENCRYPTION_KEY` configuration
- `pyproject.toml` - Added dependencies: `pyjwt>=2.8.0`, `bcrypt>=4.0.0`, `cryptography>=41.0.0`, `pydantic[email]>=2.9.0`

### Frontend Changes

**New Files:**
- `frontend/src/components/Settings.jsx` - API key management modal with save/delete
- `frontend/src/components/Settings.css` - Styling for settings modal

**Modified Files:**
- `frontend/src/api.js` - Complete rewrite for JWT auth:
  - Token management (`setTokens`, `clearTokens`, `hasTokens`)
  - Auto token refresh on 401 responses
  - `auth` object with `register`, `login`, `logout`, `getMe` methods
  - `settings` object with `saveApiKey`, `listApiKeys`, `deleteApiKey` methods
- `frontend/src/components/Login.jsx` - Added login/register toggle with `isRegistering` state
- `frontend/src/components/Login.css` - Added styles for switch button
- `frontend/src/components/Sidebar.jsx` - Added Settings button with gear icon, user email display
- `frontend/src/components/Sidebar.css` - Added styles for user info and settings button
- `frontend/src/App.jsx` - Integrated Settings modal, updated auth flow to use JWT tokens

### New Environment Variables Required

```bash
# JWT Authentication (required)
JWT_SECRET=your-secure-random-secret-here

# API Key Encryption (required for production)
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
API_KEY_ENCRYPTION_KEY=your-fernet-key-here
```

### Before First Use

Run database migrations:
```bash
uv run python -m backend.migrate
```

---

## Original Plan

### Overview

**Goal**: Users can register, login, store their own OpenRouter API key, and have isolated conversations.

**Estimated Effort**: 2-3 days

---

## Task Breakdown

### Task 1: Database Schema Updates
**Status**: COMPLETED
**Priority**: Critical (blocks everything else)

#### 1.1 Create migration infrastructure
- [x] Add manual migration scripts to backend
- [x] Create `backend/migrations/` directory

#### 1.2 Create users table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

#### 1.3 Create user_api_keys table
```sql
CREATE TABLE user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'openrouter',
    encrypted_key TEXT NOT NULL,
    key_hint VARCHAR(20),  -- Last 6 chars for display: "...abc123"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

CREATE INDEX idx_user_api_keys_user_id ON user_api_keys(user_id);
```

#### 1.4 Add user_id to conversations
```sql
ALTER TABLE conversations ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
```

#### Files created/modified:
- `backend/migrations/001_create_users_table.sql` (new)
- `backend/migrations/002_create_api_keys_table.sql` (new)
- `backend/migrations/003_add_user_id_to_conversations.sql` (new)
- `backend/migrate.py` (new - migration runner)

---

### Task 2: Backend Models & Schemas
**Status**: COMPLETED
**Priority**: Critical

#### 2.1 Created Pydantic models

**File**: `backend/models.py`

- `UserRegister` - Registration request with email validation
- `UserLogin` - Login request
- `RefreshTokenRequest` - Token refresh request
- `ApiKeyCreate` - API key save request with validation
- `UserResponse` - User info response
- `ApiKeyResponse` - API key metadata response (without decrypted value)
- `TokenResponse` - JWT token pair response

---

### Task 3: Authentication System
**Status**: COMPLETED
**Priority**: Critical

#### 3.1 JWT utilities

**File**: `backend/auth_jwt.py`

- `create_access_token()` - 60-minute access tokens
- `create_refresh_token()` - 7-day refresh tokens
- `verify_token()` - Token validation with type checking
- `get_current_user()` - FastAPI dependency for protected routes
- `get_optional_user()` - Optional auth dependency

#### 3.2 Password hashing & API key encryption

**File**: `backend/encryption.py`

- `hash_password()` - bcrypt with 12 rounds
- `verify_password()` - bcrypt verification
- `encrypt_api_key()` - Fernet symmetric encryption
- `decrypt_api_key()` - Fernet decryption
- `get_key_hint()` - Display last 6 chars

#### 3.3 User storage functions

**File**: `backend/storage.py` (modified)

- `create_user()` - Create new user
- `get_user_by_email()` - Lookup by email
- `get_user_by_id()` - Lookup by UUID
- `save_user_api_key()` - Upsert API key
- `get_user_api_key()` - Get decrypted key
- `get_user_api_keys()` - List key metadata
- `delete_user_api_key()` - Remove key

---

### Task 4: Auth API Endpoints
**Status**: COMPLETED
**Priority**: Critical

#### 4.1 Auth routes added to `backend/main.py`

- `POST /api/auth/register` - Create account, return tokens
- `POST /api/auth/login` - Authenticate, return tokens
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info

#### 4.2 Settings routes added to `backend/main.py`

- `POST /api/settings/api-key` - Save/update API key
- `GET /api/settings/api-keys` - List saved keys (metadata only)
- `DELETE /api/settings/api-key/{provider}` - Remove API key

---

### Task 5: Update Existing Endpoints for User Isolation
**Status**: COMPLETED
**Priority**: Critical

#### 5.1 Conversation endpoints updated

All conversation endpoints now use `get_current_user` dependency:
- `GET /api/conversations` - List user's conversations only
- `POST /api/conversations` - Create with `user_id`
- `GET /api/conversations/{id}` - Check ownership
- `DELETE /api/conversations/{id}` - Check ownership

#### 5.2 Storage functions updated

- `list_conversations(user_id)` - Filter by user
- `get_conversation(id, user_id)` - Ownership check
- `create_conversation(..., user_id)` - Set owner
- `delete_conversation(id, user_id)` - Ownership check

#### 5.3 Council uses user's API key

- `openrouter.py` - Added `api_key` parameter
- `council.py` - Pass `api_key` through all functions
- `main.py` - Fetch user's API key before council calls

---

### Task 6: Frontend - Auth Flow
**Status**: COMPLETED
**Priority**: Critical

#### 6.1 Updated API client

**File**: `frontend/src/api.js`

- JWT token management with localStorage
- Auto-refresh on 401 responses
- `auth.register()`, `auth.login()`, `auth.logout()`, `auth.getMe()`
- `settings.saveApiKey()`, `settings.listApiKeys()`, `settings.deleteApiKey()`

#### 6.2 Updated Login component

**File**: `frontend/src/components/Login.jsx`

- Toggle between login and register modes
- Email/password validation
- Password confirmation for registration

#### 6.3 Created Settings component

**File**: `frontend/src/components/Settings.jsx`

- Modal overlay with API key management
- Display saved keys with hints
- Add/update/delete API keys

#### 6.4 Updated App.jsx

- Settings modal integration
- User email state
- Updated auth flow for JWT

#### 6.5 Updated Sidebar

- Settings button with gear icon
- User email display
- Consistent button styling

---

### Task 7: Environment & Configuration
**Status**: COMPLETED
**Priority**: Critical

#### 7.1 New environment variables

```env
JWT_SECRET=your-secure-random-secret
API_KEY_ENCRYPTION_KEY=generated-fernet-key
```

#### 7.2 Updated dependencies

```toml
pyjwt>=2.8.0
bcrypt>=4.0.0
cryptography>=41.0.0
pydantic[email]>=2.9.0
```

---

### Task 8: Migration Script
**Status**: COMPLETED
**Priority**: Critical

**File**: `backend/migrate.py`

- Creates `schema_migrations` tracking table
- Runs pending SQL migrations in order
- Idempotent (safe to run multiple times)

---

## Task Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Database Schema Updates | COMPLETED |
| 2 | Backend Models & Schemas | COMPLETED |
| 3 | Authentication System | COMPLETED |
| 4 | Auth API Endpoints | COMPLETED |
| 5 | User Isolation | COMPLETED |
| 6 | Frontend Auth Flow | COMPLETED |
| 7 | Environment & Config | COMPLETED |
| 8 | Migration Script | COMPLETED |

---

## Testing Checklist

### Backend
- [x] User can register with email/password
- [x] User can login and receive tokens
- [x] Access token expires after 60 minutes
- [x] Refresh token works to get new access token
- [x] Invalid tokens return 401
- [x] User can save API key
- [x] API key is encrypted in database
- [x] User can only see their own conversations
- [x] User cannot access another user's conversation
- [x] Council uses user's API key

### Frontend
- [x] Registration form works
- [x] Login form works
- [x] Token stored in localStorage
- [x] Auto-refresh on token expiration
- [x] Settings page shows saved API key hint
- [x] User can update API key
- [x] Logout clears tokens
- [x] Protected routes redirect to login

---

## Deployment Checklist

- [x] Set `JWT_SECRET` in production environment
- [x] Set `API_KEY_ENCRYPTION_KEY` in production environment
- [ ] Run database migrations on production
- [x] Remove old `AUTH_USERNAME`/`AUTH_PASSWORD` env vars (kept as deprecated)
- [x] Keep `OPENROUTER_API_KEY` as optional fallback
- [x] Update CORS origins if needed
- [ ] Test registration/login flow in production
- [ ] Test API key storage in production
- [ ] Test conversation creation with user's key in production
