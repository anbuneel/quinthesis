# Multi-User Support Roadmap

## Overview

This document outlines the enhancements needed to transform AI Council from a single-user personal tool to a multi-user application.

**Current State**: Single shared Basic Auth credentials, single OpenRouter API key in `.env`

**Target State**: Individual user accounts with isolated data and personal API keys

---

## Feature Matrix by Phase

| # | Feature | Phase 1 | Phase 2 | Phase 3 |
|---|---------|:-------:|:-------:|:-------:|
| 1 | User Authentication | ✓ | | |
| 2 | Database Schema Changes | ✓ | | |
| 3 | API Key Strategy (BYOK) | ✓ | | |
| 4 | Data Isolation | ✓ | | |
| 5 | Usage Tracking | | ✓ | |
| 6 | Security Hardening | Partial | ✓ | |
| 7 | User Settings Page | Minimal | ✓ | |
| 8 | Admin Dashboard | | | ✓ |
| 9 | Onboarding Flow | | ✓ | |
| 10 | Export/Share/Teams | | | ✓ |

---

## Phase 1: Minimum Viable Multi-User

**Goal**: Users can register, login, and use their own API keys with isolated conversations.

**Estimated Effort**: 2-3 days

### 1.1 User Authentication

**Current**: Single Basic Auth credentials in `.env`

**Changes Needed**:
- User registration endpoint (`POST /api/auth/register`)
- User login endpoint (`POST /api/auth/login`)
- JWT token-based session management
- Password hashing (bcrypt)
- Protected route middleware

**Files to Create/Modify**:
- `backend/auth.py` - Expand with JWT, registration, login
- `backend/models.py` - User model (new)
- `frontend/src/components/Register.jsx` - Registration form (new)
- `frontend/src/components/Login.jsx` - Update for new auth flow

### 1.2 Database Schema Changes

**New Tables**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) DEFAULT 'openrouter',
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Modified Tables**:
```sql
ALTER TABLE conversations ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
```

### 1.3 API Key Strategy (BYOK)

**Approach**: Bring Your Own Key - users provide their own OpenRouter API key

**Pros**:
- No cost to operator
- Scales infinitely
- Users control their own spending

**Cons**:
- Friction for users (need OpenRouter account)
- Users must trust the platform with their keys

**Implementation**:
- Encrypt API keys at rest (Fernet symmetric encryption)
- Store encryption key in environment variable
- Decrypt only when making API calls

### 1.4 Data Isolation

**Changes**:
- All conversation queries filtered by `user_id`
- Middleware to extract user from JWT and inject into request context
- API endpoints validate ownership before returning data

**Example**:
```python
# Before
async def get_conversations():
    return await storage.list_conversations()

# After
async def get_conversations(current_user: User):
    return await storage.list_conversations(user_id=current_user.id)
```

### 1.5 Minimal Settings Page

**Features**:
- View/update OpenRouter API key
- Change password
- Delete account

---

## Phase 2: Production Hardening

**Goal**: Usage visibility, better security, smoother onboarding.

**Estimated Effort**: 3-5 days

### 2.1 Usage Tracking

- Track tokens used per request (from OpenRouter response)
- Store usage per user per day
- Dashboard showing:
  - Total tokens used (this month)
  - Cost estimate
  - Requests per day chart

**New Table**:
```sql
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    conversation_id UUID REFERENCES conversations(id),
    tokens_prompt INT,
    tokens_completion INT,
    cost_usd DECIMAL(10, 6),
    model VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.2 Security Hardening

- Rate limiting per user (e.g., 100 requests/hour)
- CSRF protection for state-changing requests
- Input validation and sanitization
- Security headers (CSP, HSTS)
- Audit logging for sensitive actions
- API key rotation support

### 2.3 Full Settings Page

- Profile management (email, display name)
- API key management (add, rotate, delete)
- Default model preferences
- Notification preferences
- Usage dashboard integration

### 2.4 Onboarding Flow

- Welcome modal for new users
- Step-by-step API key setup wizard
- Link to OpenRouter signup
- Test API key before saving
- Sample inquiry to demonstrate functionality

---

## Phase 3: Growth Features

**Goal**: Admin tools, collaboration, and monetization options.

**Estimated Effort**: 5-10 days

### 3.1 Admin Dashboard

- User management (list, search, disable)
- System-wide usage analytics
- Error monitoring
- Feature flags

### 3.2 Export & Sharing

- Export conversation as JSON
- Export conversation as PDF
- Export conversation as Markdown
- Public shareable links (read-only)
- Expiring share links

### 3.3 Team/Organization Support

- Create organizations
- Invite team members
- Shared API key pool for org
- Role-based access (admin, member)
- Org-level usage tracking

### 3.4 Subscription Model (Optional)

If monetization is desired:

- Stripe integration
- Tiered plans:
  - Free: BYOK only, limited history
  - Pro: Higher limits, priority support
  - Team: Shared billing, admin features
- Usage-based billing option
- Billing portal

---

## API Key Strategy Comparison

| Approach | User Experience | Operator Cost | Complexity | Best For |
|----------|-----------------|---------------|------------|----------|
| **BYOK** | Medium (need own key) | None | Low | Personal/Dev tools |
| **Shared Pool + Quotas** | High (seamless) | High | Medium | Consumer apps |
| **Subscription Tiers** | High | Variable | High | SaaS business |

**Recommendation**: Start with BYOK (Phase 1), evaluate user feedback, then consider shared pool or subscriptions based on demand.

---

## Technical Considerations

### Authentication Options

| Method | Pros | Cons |
|--------|------|------|
| **JWT + Refresh Tokens** | Stateless, scalable | Token revocation complex |
| **Session Cookies** | Simple, easy revocation | Requires session store |
| **OAuth Only** | No password management | Depends on providers |

**Recommendation**: JWT with short expiry (15min) + refresh tokens (7 days)

### API Key Encryption

```python
from cryptography.fernet import Fernet

# Generate key once, store in environment
ENCRYPTION_KEY = os.environ["API_KEY_ENCRYPTION_KEY"]
fernet = Fernet(ENCRYPTION_KEY)

def encrypt_api_key(key: str) -> str:
    return fernet.encrypt(key.encode()).decode()

def decrypt_api_key(encrypted: str) -> str:
    return fernet.decrypt(encrypted.encode()).decode()
```

### Migration Path

1. Deploy schema changes with `user_id` nullable
2. Create default "legacy" user
3. Assign existing conversations to legacy user
4. Deploy new auth system
5. Make `user_id` required for new conversations

---

## Files to Create/Modify

### Phase 1

**Backend (New)**:
- `backend/models.py` - SQLAlchemy/Pydantic models for User, ApiKey
- `backend/auth_jwt.py` - JWT utilities
- `backend/encryption.py` - API key encryption
- `backend/migrations/` - Database migrations

**Backend (Modify)**:
- `backend/auth.py` - Registration, login endpoints
- `backend/storage.py` - Add user_id filtering
- `backend/main.py` - New auth routes, middleware
- `backend/council.py` - Use user's API key

**Frontend (New)**:
- `frontend/src/components/Register.jsx`
- `frontend/src/components/Settings.jsx`

**Frontend (Modify)**:
- `frontend/src/components/Login.jsx`
- `frontend/src/api.js` - JWT token handling
- `frontend/src/App.jsx` - Settings route

---

## Open Questions

1. **Email verification**: Required for registration or optional?
2. **Password requirements**: Minimum complexity rules?
3. **Account recovery**: Email-based password reset?
4. **OAuth providers**: Google? GitHub? Both?
5. **Free tier limits**: If offering shared pool, what limits?

---

## Next Steps

1. Decide on Phase 1 scope and timeline
2. Set up database migrations infrastructure
3. Implement user registration/login
4. Add API key storage with encryption
5. Migrate existing conversations to user model
6. Update frontend for new auth flow
7. Test and deploy
