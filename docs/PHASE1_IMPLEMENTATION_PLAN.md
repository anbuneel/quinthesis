# Phase 1 Implementation Plan: Multi-User Support

## Overview

**Goal**: Users can register, login, store their own OpenRouter API key, and have isolated conversations.

**Estimated Effort**: 2-3 days

---

## Task Breakdown

### Task 1: Database Schema Updates
**Priority**: Critical (blocks everything else)
**Effort**: 2-3 hours

#### 1.1 Create migration infrastructure
- [ ] Add `alembic` or manual migration scripts to backend
- [ ] Create `backend/migrations/` directory

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
    key_hint VARCHAR(20),  -- Last 4 chars for display: "...abc123"
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

#### Files to create/modify:
- `backend/migrations/001_create_users_table.sql` (new)
- `backend/migrations/002_create_api_keys_table.sql` (new)
- `backend/migrations/003_add_user_id_to_conversations.sql` (new)
- `backend/database.py` (modify - add migration runner)

---

### Task 2: Backend Models & Schemas
**Priority**: Critical
**Effort**: 1-2 hours

#### 2.1 Create Pydantic models

**File**: `backend/models.py` (new)

```python
from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Optional

# Request schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str  # Min 8 chars, validated in endpoint

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ApiKeyCreate(BaseModel):
    api_key: str
    provider: str = "openrouter"

# Response schemas
class UserResponse(BaseModel):
    id: UUID
    email: str
    created_at: datetime

class ApiKeyResponse(BaseModel):
    id: UUID
    provider: str
    key_hint: str  # "...abc123"
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
```

#### Files to create:
- `backend/models.py` (new)

---

### Task 3: Authentication System
**Priority**: Critical
**Effort**: 3-4 hours

#### 3.1 JWT utilities

**File**: `backend/auth_jwt.py` (new)

```python
import os
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
import jwt
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

security = HTTPBearer()

def create_access_token(user_id: UUID) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: UUID) -> str:
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str, token_type: str = "access") -> UUID:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != token_type:
            raise HTTPException(status_code=401, detail="Invalid token type")
        return UUID(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UUID:
    """Dependency to get current user ID from JWT token."""
    return verify_token(credentials.credentials, "access")
```

#### 3.2 Password hashing

**File**: `backend/encryption.py` (new)

```python
import os
import bcrypt
from cryptography.fernet import Fernet

# Password hashing
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())

# API key encryption
API_KEY_ENCRYPTION_KEY = os.environ.get("API_KEY_ENCRYPTION_KEY")
if API_KEY_ENCRYPTION_KEY:
    _fernet = Fernet(API_KEY_ENCRYPTION_KEY.encode())
else:
    _fernet = None

def encrypt_api_key(key: str) -> str:
    if not _fernet:
        raise ValueError("API_KEY_ENCRYPTION_KEY not configured")
    return _fernet.encrypt(key.encode()).decode()

def decrypt_api_key(encrypted: str) -> str:
    if not _fernet:
        raise ValueError("API_KEY_ENCRYPTION_KEY not configured")
    return _fernet.decrypt(encrypted.encode()).decode()

def get_key_hint(key: str) -> str:
    """Return last 6 characters for display."""
    return f"...{key[-6:]}" if len(key) > 6 else key
```

#### 3.3 User storage functions

**File**: `backend/storage.py` (modify - add user functions)

```python
# Add these functions to storage.py

async def create_user(email: str, password_hash: str) -> dict:
    """Create a new user."""
    query = """
        INSERT INTO users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email, created_at
    """
    row = await db_pool.fetchrow(query, email, password_hash)
    return dict(row)

async def get_user_by_email(email: str) -> Optional[dict]:
    """Get user by email."""
    query = "SELECT * FROM users WHERE email = $1"
    row = await db_pool.fetchrow(query, email)
    return dict(row) if row else None

async def get_user_by_id(user_id: UUID) -> Optional[dict]:
    """Get user by ID."""
    query = "SELECT * FROM users WHERE id = $1"
    row = await db_pool.fetchrow(query, user_id)
    return dict(row) if row else None

async def save_user_api_key(user_id: UUID, provider: str, encrypted_key: str, key_hint: str) -> dict:
    """Save or update user's API key."""
    query = """
        INSERT INTO user_api_keys (user_id, provider, encrypted_key, key_hint)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, provider)
        DO UPDATE SET encrypted_key = $3, key_hint = $4, updated_at = NOW()
        RETURNING id, provider, key_hint, created_at
    """
    row = await db_pool.fetchrow(query, user_id, provider, encrypted_key, key_hint)
    return dict(row)

async def get_user_api_key(user_id: UUID, provider: str = "openrouter") -> Optional[str]:
    """Get user's decrypted API key."""
    query = "SELECT encrypted_key FROM user_api_keys WHERE user_id = $1 AND provider = $2"
    row = await db_pool.fetchrow(query, user_id, provider)
    if row:
        from .encryption import decrypt_api_key
        return decrypt_api_key(row["encrypted_key"])
    return None

async def get_user_api_keys(user_id: UUID) -> list:
    """Get all user's API keys (without decrypted values)."""
    query = "SELECT id, provider, key_hint, created_at FROM user_api_keys WHERE user_id = $1"
    rows = await db_pool.fetch(query, user_id)
    return [dict(row) for row in rows]

async def delete_user_api_key(user_id: UUID, provider: str) -> bool:
    """Delete user's API key."""
    query = "DELETE FROM user_api_keys WHERE user_id = $1 AND provider = $2"
    result = await db_pool.execute(query, user_id, provider)
    return result == "DELETE 1"
```

#### Files to create/modify:
- `backend/auth_jwt.py` (new)
- `backend/encryption.py` (new)
- `backend/storage.py` (modify)

---

### Task 4: Auth API Endpoints
**Priority**: Critical
**Effort**: 2-3 hours

#### 4.1 Auth routes

**File**: `backend/main.py` (modify - add auth routes)

```python
from .models import UserRegister, UserLogin, TokenResponse, ApiKeyCreate, ApiKeyResponse
from .auth_jwt import create_access_token, create_refresh_token, verify_token, get_current_user
from .encryption import hash_password, verify_password, encrypt_api_key, get_key_hint

@app.post("/api/auth/register", response_model=TokenResponse)
async def register(data: UserRegister):
    # Validate password
    if len(data.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    # Check if email exists
    existing = await storage.get_user_by_email(data.email)
    if existing:
        raise HTTPException(400, "Email already registered")

    # Create user
    password_hash = hash_password(data.password)
    user = await storage.create_user(data.email, password_hash)

    # Generate tokens
    access_token = create_access_token(user["id"])
    refresh_token = create_refresh_token(user["id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await storage.get_user_by_email(data.email)
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    access_token = create_access_token(user["id"])
    refresh_token = create_refresh_token(user["id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@app.post("/api/auth/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str):
    user_id = verify_token(refresh_token, "refresh")

    access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@app.get("/api/auth/me")
async def get_me(user_id: UUID = Depends(get_current_user)):
    user = await storage.get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return {"id": user["id"], "email": user["email"], "created_at": user["created_at"]}
```

#### 4.2 API key management endpoints

```python
@app.post("/api/settings/api-key", response_model=ApiKeyResponse)
async def save_api_key(data: ApiKeyCreate, user_id: UUID = Depends(get_current_user)):
    # Validate the API key by making a test request
    # (optional but recommended)

    encrypted = encrypt_api_key(data.api_key)
    hint = get_key_hint(data.api_key)

    result = await storage.save_user_api_key(user_id, data.provider, encrypted, hint)
    return ApiKeyResponse(**result)

@app.get("/api/settings/api-keys")
async def list_api_keys(user_id: UUID = Depends(get_current_user)):
    keys = await storage.get_user_api_keys(user_id)
    return keys

@app.delete("/api/settings/api-key/{provider}")
async def delete_api_key(provider: str, user_id: UUID = Depends(get_current_user)):
    deleted = await storage.delete_user_api_key(user_id, provider)
    if not deleted:
        raise HTTPException(404, "API key not found")
    return {"status": "deleted"}
```

#### Files to modify:
- `backend/main.py`

---

### Task 5: Update Existing Endpoints for User Isolation
**Priority**: Critical
**Effort**: 2-3 hours

#### 5.1 Modify conversation endpoints

```python
# Update all conversation endpoints to use user_id

@app.get("/api/conversations")
async def list_conversations(user_id: UUID = Depends(get_current_user)):
    return await storage.list_conversations(user_id=user_id)

@app.post("/api/conversations")
async def create_conversation(
    data: ConversationCreate,
    user_id: UUID = Depends(get_current_user)
):
    return await storage.create_conversation(user_id=user_id, **data.dict())

@app.get("/api/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: UUID,
    user_id: UUID = Depends(get_current_user)
):
    conv = await storage.get_conversation(conversation_id, user_id=user_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv

@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    user_id: UUID = Depends(get_current_user)
):
    deleted = await storage.delete_conversation(conversation_id, user_id=user_id)
    if not deleted:
        raise HTTPException(404, "Conversation not found")
    return {"status": "deleted"}
```

#### 5.2 Modify storage functions

```python
# Update storage.py functions to filter by user_id

async def list_conversations(user_id: UUID) -> list:
    query = """
        SELECT id, created_at, title,
               (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
        FROM conversations c
        WHERE user_id = $1
        ORDER BY created_at DESC
    """
    rows = await db_pool.fetch(query, user_id)
    return [dict(row) for row in rows]

async def get_conversation(conversation_id: UUID, user_id: UUID) -> Optional[dict]:
    query = "SELECT * FROM conversations WHERE id = $1 AND user_id = $2"
    row = await db_pool.fetchrow(query, conversation_id, user_id)
    # ... rest of function

async def create_conversation(user_id: UUID, models: list, lead_model: str) -> dict:
    query = """
        INSERT INTO conversations (user_id, models, lead_model)
        VALUES ($1, $2, $3)
        RETURNING *
    """
    row = await db_pool.fetchrow(query, user_id, models, lead_model)
    return dict(row)

async def delete_conversation(conversation_id: UUID, user_id: UUID) -> bool:
    query = "DELETE FROM conversations WHERE id = $1 AND user_id = $2"
    result = await db_pool.execute(query, conversation_id, user_id)
    return result == "DELETE 1"
```

#### 5.3 Use user's API key in council

```python
# Update council.py to use user's API key

async def run_council(question: str, models: list, lead_model: str, user_id: UUID):
    # Get user's API key
    api_key = await storage.get_user_api_key(user_id, "openrouter")
    if not api_key:
        raise HTTPException(400, "No API key configured. Please add your OpenRouter API key in Settings.")

    # Use this key for OpenRouter calls
    # ... rest of function
```

#### Files to modify:
- `backend/main.py`
- `backend/storage.py`
- `backend/council.py`
- `backend/openrouter.py`

---

### Task 6: Frontend - Auth Flow
**Priority**: Critical
**Effort**: 3-4 hours

#### 6.1 Update API client

**File**: `frontend/src/api.js` (modify)

```javascript
// Token management
let accessToken = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function hasTokens() {
  return !!accessToken;
}

// Update fetchWithAuth to use JWT
async function fetchWithAuth(url, options = {}) {
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  // Handle token expiration
  if (response.status === 401) {
    // Try to refresh
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry original request
      return fetchWithAuth(url, options);
    }
    clearTokens();
    throw new Error('Authentication failed');
  }

  return response;
}

async function tryRefreshToken() {
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    }
  } catch (e) {
    console.error('Token refresh failed:', e);
  }
  return false;
}

// Auth API methods
export const auth = {
  async register(email, password) {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }
    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return data;
  },

  async login(email, password) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }
    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return data;
  },

  logout() {
    clearTokens();
  },

  async getMe() {
    const response = await fetchWithAuth(`${API_BASE}/api/auth/me`);
    return response.json();
  },
};

// Settings API methods
export const settings = {
  async saveApiKey(apiKey, provider = 'openrouter') {
    const response = await fetchWithAuth(`${API_BASE}/api/settings/api-key`, {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey, provider }),
    });
    if (!response.ok) throw new Error('Failed to save API key');
    return response.json();
  },

  async listApiKeys() {
    const response = await fetchWithAuth(`${API_BASE}/api/settings/api-keys`);
    return response.json();
  },

  async deleteApiKey(provider) {
    const response = await fetchWithAuth(`${API_BASE}/api/settings/api-key/${provider}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete API key');
    return response.json();
  },
};
```

#### 6.2 Create Register component

**File**: `frontend/src/components/Register.jsx` (new)

```jsx
import { useState } from 'react';
import { auth } from '../api';
import './Login.css'; // Reuse login styles

export default function Register({ onRegister, onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await auth.register(email, password);
      onRegister();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Create Account</h1>
        <p className="login-subtitle">Join The AI Council</p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p className="login-switch">
          Already have an account?{' '}
          <button type="button" onClick={onSwitchToLogin}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
```

#### 6.3 Update Login component

**File**: `frontend/src/components/Login.jsx` (modify)

- Add "Create account" link
- Use new `auth.login()` API
- Remove Basic Auth logic

#### 6.4 Create Settings component

**File**: `frontend/src/components/Settings.jsx` (new)

```jsx
import { useState, useEffect } from 'react';
import { settings } from '../api';
import './Settings.css';

export default function Settings({ onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [savedKeys, setSavedKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    setIsLoading(true);
    try {
      const keys = await settings.listApiKeys();
      setSavedKeys(keys);
    } catch (err) {
      setError('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveKey = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      await settings.saveApiKey(apiKey.trim());
      setApiKey('');
      setSuccess('API key saved successfully');
      loadApiKeys();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteKey = async (provider) => {
    if (!confirm('Delete this API key?')) return;

    try {
      await settings.deleteApiKey(provider);
      loadApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>Close</button>
        </div>

        <div className="settings-body">
          {error && <div className="settings-error">{error}</div>}
          {success && <div className="settings-success">{success}</div>}

          <section className="settings-section">
            <h3>OpenRouter API Key</h3>
            <p className="settings-desc">
              Your API key is encrypted and stored securely.
              Get your key at{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                openrouter.ai/keys
              </a>
            </p>

            {isLoading ? (
              <p>Loading...</p>
            ) : (
              <>
                {savedKeys.length > 0 && (
                  <div className="saved-keys">
                    {savedKeys.map((key) => (
                      <div key={key.id} className="saved-key">
                        <span className="key-provider">{key.provider}</span>
                        <span className="key-hint">{key.key_hint}</span>
                        <button
                          className="key-delete"
                          onClick={() => handleDeleteKey(key.provider)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSaveKey} className="api-key-form">
                  <input
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={isSaving}
                  />
                  <button type="submit" disabled={isSaving || !apiKey.trim()}>
                    {savedKeys.length > 0 ? 'Update Key' : 'Save Key'}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
```

#### Files to create/modify:
- `frontend/src/api.js` (modify)
- `frontend/src/components/Register.jsx` (new)
- `frontend/src/components/Login.jsx` (modify)
- `frontend/src/components/Settings.jsx` (new)
- `frontend/src/components/Settings.css` (new)
- `frontend/src/App.jsx` (modify - add settings route, update auth flow)

---

### Task 7: Environment & Configuration
**Priority**: Critical
**Effort**: 30 minutes

#### 7.1 Generate encryption key

```bash
# Generate Fernet key for API key encryption
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

#### 7.2 Update environment variables

**File**: `.env` (modify)

```env
# Existing
DATABASE_URL=postgresql://...
CORS_ORIGINS=http://localhost:5173,...

# New for Phase 1
JWT_SECRET=generate-a-secure-random-string-here
API_KEY_ENCRYPTION_KEY=generated-fernet-key-here

# Remove (no longer needed at app level)
# OPENROUTER_API_KEY=...  # Now per-user
# AUTH_USERNAME=...        # Now per-user
# AUTH_PASSWORD=...        # Now per-user
```

#### 7.3 Update requirements

**File**: `backend/requirements.txt` or `pyproject.toml`

```
# Add
pyjwt>=2.8.0
bcrypt>=4.0.0
cryptography>=41.0.0
pydantic[email]>=2.0.0
```

---

### Task 8: Migration Script
**Priority**: Critical
**Effort**: 1 hour

#### 8.1 Create migration runner

**File**: `backend/migrate.py` (new)

```python
import asyncio
import asyncpg
import os
from pathlib import Path

async def run_migrations():
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])

    # Create migrations tracking table
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INT PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT NOW()
        )
    """)

    # Get applied migrations
    applied = set(row["version"] for row in await conn.fetch(
        "SELECT version FROM schema_migrations"
    ))

    # Run pending migrations
    migrations_dir = Path(__file__).parent / "migrations"
    for migration_file in sorted(migrations_dir.glob("*.sql")):
        version = int(migration_file.stem.split("_")[0])
        if version not in applied:
            print(f"Running migration {migration_file.name}...")
            sql = migration_file.read_text()
            await conn.execute(sql)
            await conn.execute(
                "INSERT INTO schema_migrations (version) VALUES ($1)",
                version
            )
            print(f"  Done.")

    await conn.close()
    print("All migrations complete.")

if __name__ == "__main__":
    asyncio.run(run_migrations())
```

---

## Task Summary

| Task | Description | Effort | Dependencies |
|------|-------------|--------|--------------|
| 1 | Database Schema Updates | 2-3h | None |
| 2 | Backend Models & Schemas | 1-2h | Task 1 |
| 3 | Authentication System | 3-4h | Task 1, 2 |
| 4 | Auth API Endpoints | 2-3h | Task 3 |
| 5 | User Isolation | 2-3h | Task 3, 4 |
| 6 | Frontend Auth Flow | 3-4h | Task 4 |
| 7 | Environment & Config | 30m | None |
| 8 | Migration Script | 1h | Task 1 |

**Total Estimated Effort**: 16-21 hours (2-3 days)

---

## Testing Checklist

### Backend
- [ ] User can register with email/password
- [ ] User can login and receive tokens
- [ ] Access token expires after 15 minutes
- [ ] Refresh token works to get new access token
- [ ] Invalid tokens return 401
- [ ] User can save API key
- [ ] API key is encrypted in database
- [ ] User can only see their own conversations
- [ ] User cannot access another user's conversation
- [ ] Council uses user's API key

### Frontend
- [ ] Registration form works
- [ ] Login form works
- [ ] Token stored in localStorage
- [ ] Auto-refresh on token expiration
- [ ] Settings page shows saved API key hint
- [ ] User can update API key
- [ ] Logout clears tokens
- [ ] Protected routes redirect to login

---

## Deployment Checklist

- [ ] Set `JWT_SECRET` in production environment
- [ ] Set `API_KEY_ENCRYPTION_KEY` in production environment
- [ ] Run database migrations
- [ ] Remove old `AUTH_USERNAME`/`AUTH_PASSWORD` env vars
- [ ] Remove old `OPENROUTER_API_KEY` env var (optional - keep as fallback?)
- [ ] Update CORS origins if needed
- [ ] Test registration/login flow
- [ ] Test API key storage
- [ ] Test conversation creation with user's key
