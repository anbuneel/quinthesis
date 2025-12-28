# OAuth Implementation Plan - Google & GitHub (Remove Email/Password)

## Overview
Replace email/password authentication with Google and GitHub OAuth. Existing users will be linked by email to preserve their archives.

---

## Phase 1: Backend Foundation

### 1.1 Database Migration (`backend/migrations/004_oauth_users.sql`)
```sql
-- Add OAuth columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20),
  ADD COLUMN IF NOT EXISTS oauth_provider_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Make password_hash nullable (existing users have passwords, OAuth users won't)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Unique constraint for OAuth identification
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth
  ON users(oauth_provider, oauth_provider_id)
  WHERE oauth_provider IS NOT NULL;
```

### 1.2 Environment Variables
```bash
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
OAUTH_REDIRECT_BASE=http://localhost:5173  # or https://ai-council-anbs.vercel.app
```

### 1.3 New Files
- `backend/oauth.py` - OAuth handlers for Google and GitHub (code exchange, user info)

### 1.4 Storage Updates (`backend/storage.py` + `storage_local.py`)
Add functions:
- `create_oauth_user(email, provider, provider_id, name, avatar_url)`
- `get_user_by_oauth(provider, provider_id)`
- `link_oauth_to_existing_user(user_id, provider, provider_id, ...)`

---

## Phase 2: Backend Endpoints (`backend/main.py`)

### Remove
- `POST /api/auth/register`
- `POST /api/auth/login`

### Add
- `GET /api/auth/oauth/{provider}` - Returns authorization URL
- `POST /api/auth/oauth/{provider}/callback` - Exchange code for JWT tokens

### Keep
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/me` - Get current user

### User Linking Logic
1. Check if OAuth account already linked → return existing user
2. Check if email exists → link OAuth to existing account (preserves archives)
3. Otherwise → create new user

---

## Phase 3: Frontend Changes

### 3.1 Add Dependency
```bash
cd frontend && npm install react-router-dom
```

### 3.2 New Component: `OAuthCallback.jsx`
Handles `/auth/callback/:provider` route - completes OAuth flow

### 3.3 Redesign `Login.jsx`
Replace email/password form with:
- "Continue with Google" button
- "Continue with GitHub" button
- Keep editorial styling (ornate borders, etc.)

### 3.4 Update `api.js`
Replace `auth.login/register` with:
- `auth.startOAuth(provider)` - Redirects to provider
- `auth.completeOAuth(provider, code, state)` - Exchanges code for tokens

### 3.5 Add Routing (`App.jsx`)
```jsx
<BrowserRouter>
  <Routes>
    <Route path="/auth/callback/:provider" element={<OAuthCallback />} />
    <Route path="/*" element={/* existing app */} />
  </Routes>
</BrowserRouter>
```

---

## Phase 4: OAuth App Setup

### Google Cloud Console
1. https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Redirect URIs:
   - `http://localhost:5173/auth/callback/google`
   - `https://ai-council-anbs.vercel.app/auth/callback/google`

### GitHub Developer Settings
1. https://github.com/settings/developers
2. Create OAuth App
3. Callback URL:
   - `http://localhost:5173/auth/callback/github`
   - `https://ai-council-anbs.vercel.app/auth/callback/github`

---

## Dependencies

**Backend:** Add `httpx` for async HTTP requests to OAuth providers

**Frontend:** Add `react-router-dom` for callback routing

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `backend/config.py` | Add OAuth env vars |
| `backend/oauth.py` | NEW - OAuth handlers |
| `backend/storage.py` | Add OAuth user functions |
| `backend/storage_local.py` | Add OAuth user functions (local dev) |
| `backend/main.py` | Replace auth endpoints |
| `backend/models.py` | Add OAuth request/response models |
| `backend/migrations/004_oauth_users.sql` | NEW - Schema changes |
| `frontend/src/api.js` | Replace auth methods |
| `frontend/src/App.jsx` | Add BrowserRouter and routes |
| `frontend/src/components/Login.jsx` | OAuth buttons UI |
| `frontend/src/components/Login.css` | OAuth button styles |
| `frontend/src/components/OAuthCallback.jsx` | NEW - Callback handler |

---

## Implementation Order

1. Create OAuth apps (Google + GitHub) and get credentials
2. Backend: Add migration, oauth.py, storage functions
3. Backend: Update main.py with OAuth endpoints
4. Frontend: Install react-router-dom
5. Frontend: Create OAuthCallback.jsx
6. Frontend: Redesign Login.jsx with OAuth buttons
7. Frontend: Update api.js and App.jsx
8. Test locally with both providers
9. Deploy and configure production OAuth redirect URIs
