# Code Cleanup Record: Quinthesis

**Date:** 2025-12-28

---

## Overview

This document records the code cleanup performed after the OAuth migration. The app went through many iterations during development, leaving behind deprecated HTTP Basic Auth code, unused components from earlier designs, and legacy compatibility aliases. All items below were removed in PR #15.

**Impact:** 18 files changed, ~400 lines of dead code removed

---

## Deleted Files (6)

| File | Reason |
|------|--------|
| `main.py` (root) | Unused placeholder - just printed "Hello from llm-council!" |
| `backend/auth.py` | Old HTTP Basic Auth - replaced by OAuth/JWT |
| `frontend/src/components/ProgressOrbit.jsx` | Never imported anywhere - unused stage stepper |
| `frontend/src/components/ProgressOrbit.css` | Unused styles |
| `frontend/src/components/RightPanel.jsx` | Never imported anywhere - unused council panel |
| `frontend/src/components/RightPanel.css` | Unused styles |

---

## Code Removed

### backend/config.py

Removed deprecated configuration variables:
- `AUTH_USERNAME` - legacy HTTP Basic Auth
- `AUTH_PASSWORD` - legacy HTTP Basic Auth
- `COUNCIL_MODELS` - unused backwards compatibility alias
- `CHAIRMAN_MODEL` - unused backwards compatibility alias
- `DATA_DIR` - unused legacy data directory config

### backend/encryption.py

Removed unused password hashing functions (OAuth doesn't need them):
- `hash_password()`
- `verify_password()`

Also removed `bcrypt` import (no longer needed).

### frontend/src/api.js

Removed deprecated legacy aliases:
```javascript
export const setCredentials = ...
export const clearCredentials = ...
export const hasCredentials = ...
```

### pyproject.toml

Removed unused dependencies:
- `bcrypt>=4.0.0` - no longer needed without password hashing
- `pydantic[email]` - simplified to just `pydantic`

---

## Minor Fixes Applied

| File | Fix |
|------|-----|
| `App.jsx:358, 583` | Removed `console.log('Unknown event type:')` |
| `frontend/src/components/Settings.jsx:2` | Removed unused `auth` import |
| `backend/council.py` | Moved `import re` and `from collections import defaultdict` to top of file |
| `backend/openrouter.py` | Moved `import asyncio` to top of file |
| `backend/models.py:3` | Removed unused `EmailStr` import |

---

## Documentation Updated

### AGENTS.md
- Updated environment setup section for OAuth authentication
- Updated file locations to reflect current OAuth-based auth system
- Updated deployment checklist with OAuth secrets
- Removed references to deleted files

### README.md
- Updated config variable names (`AVAILABLE_MODELS`, `DEFAULT_LEAD_MODEL` instead of `COUNCIL_MODELS`, `CHAIRMAN_MODEL`)

---

## Summary

| Category | Count |
|----------|-------|
| Files deleted | 6 |
| Code blocks removed | 4 |
| Minor fixes applied | 5 |
| Docs updated | 2 |
| Dependencies removed | 2 |

All changes are safe and don't break functionality. The app uses OAuth/JWT authentication, not HTTP Basic Auth. The unused frontend components were from earlier design iterations.
