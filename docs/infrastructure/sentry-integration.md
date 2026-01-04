# Sentry Integration

Production error monitoring and performance tracking for Quinthesis.

**Date:** 2026-01-03

---

## Overview

Sentry provides:
- **Error tracking** — Know when OpenRouter calls fail, OAuth breaks, or payments error
- **Stack traces** — Debug production issues without reproducing locally
- **Performance monitoring** — Identify slow council queries or database bottlenecks
- **Release tracking** — Correlate errors with deployments
- **User context** — See which user hit an error (helpful for support)

**Cost:** Free tier covers 5K errors/month + 10K performance events.

---

## Implementation

### Backend (`backend/`)

Added `sentry-sdk[fastapi]` to `pyproject.toml`.

Initialized in `main.py`:
```python
import sentry_sdk
from .config import SENTRY_DSN, IS_PRODUCTION

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.1,  # 10% of transactions
        profiles_sample_rate=0.1,  # 10% of sampled transactions
        environment="production" if IS_PRODUCTION else "development",
        send_default_pii=False,
    )
```

User context set on critical endpoints (`send_message`, `send_message_stream`, `get_current_user_info`):
```python
def set_sentry_user(user_id: UUID, email: str = None):
    if SENTRY_DSN:
        sentry_sdk.set_user({"id": str(user_id), "email": email})
```

### Frontend (`frontend/`)

Added `@sentry/react` to `package.json`.

Initialized in `main.jsx`:
```javascript
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,  // No session replays by default
    replaysOnErrorSampleRate: 0.1,  // 10% of error sessions
    environment: import.meta.env.MODE,
  });
}
```

User context managed in `api.js`:
- Set on successful `getMe()` call
- Cleared on `logout()`

---

## Configuration

| Environment | Variable | Set In | Required |
|-------------|----------|--------|----------|
| Backend | `SENTRY_DSN` | Fly.io secrets | No (optional) |
| Frontend | `VITE_SENTRY_DSN` | Vercel env vars | No (optional) |

When DSN is not set, Sentry is completely disabled (zero overhead).

---

## Setup Steps

1. **Create Sentry account** at https://sentry.io (free tier)

2. **Create Python project** (for backend):
   - Select Python platform
   - Copy the DSN
   - Set in Fly.io: `fly secrets set SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx`

3. **Create React project** (for frontend):
   - Select React platform
   - Copy the DSN
   - Add to Vercel environment variables: `VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx`

4. **Redeploy** both frontend and backend

5. **(Optional) Configure alerts:**
   - Error spike alerts
   - Performance regression alerts
   - Slack/email notifications

---

## Sample Rates

| Metric | Backend | Frontend |
|--------|---------|----------|
| Error capture | 100% | 100% |
| Performance traces | 10% | 10% |
| Profiling | 10% | N/A |
| Session replays | N/A | 0% normal, 10% on error |

Adjust sample rates in production based on traffic volume and Sentry quota usage.

---

## Privacy Considerations

- `send_default_pii=False` on backend (no automatic IP/cookie collection)
- `maskAllText: true` on frontend session replays
- `blockAllMedia: true` on frontend session replays
- Only user ID and email stored for error attribution
- Session replays only captured on errors (10% sample)

---

## Files Modified

- `pyproject.toml` — Added sentry-sdk dependency
- `backend/config.py` — Added SENTRY_DSN config
- `backend/main.py` — Sentry init + user context
- `frontend/package.json` — Added @sentry/react dependency
- `frontend/src/main.jsx` — Sentry init
- `frontend/src/api.js` — User context on auth
- `CLAUDE.md` — Deployment checklist updated
- `README.md` — Tech stack and env config updated
