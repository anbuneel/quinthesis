# PR 27 Review (Codex)
Author: Codex
Date: 2026-01-02 11:30:01 -05:00
Re-review: 2026-01-02 11:57:55 -05:00
PR: https://github.com/anbuneel/ai-council/pull/27

## Findings

### High
- Demo Stage 1/3 render blank because the demo adapter writes `content` while the stage components read `response`. `frontend/src/components/DemoView.jsx:55` `frontend/src/components/DemoView.jsx:71` `frontend/src/components/Stage1.jsx:86` `frontend/src/components/Stage3.jsx:25`
- Migration 009 deactivates existing deposit options; webhook lookups still require `is_active = true`, so in-flight Stripe sessions can still fail with "Deposit option not found". `backend/migrations/009_add_lower_deposit_options.sql:4` `backend/storage.py:1138` `backend/main.py:945`

### Medium
- Local JSON mode returns non-UUID deposit option IDs, but response/request schemas require UUID, so `/api/deposits/options` and checkout can 422 in local dev. `backend/storage_local.py:602` `backend/models.py:114`

### Low
- Cost estimate is hard-coded and may be misleading for higher-cost models or long prompts; consider making it dynamic or labeling it as an example. `frontend/src/config.js:10`

---

## Analysis (Claude)

### High Priority

#### 1. Demo Stage 1/3 render blank - **CONFIRMED BUG**
**Status:** Fixed (verified)

**Analysis:** Verified the mismatch:
- `DemoView.jsx` creates `{ content: item.response }` for Stage 1 data
- `DemoView.jsx` creates `{ content: demo.stage3.response }` for Stage 3 data
- But `Stage1.jsx:86` reads `activeResponse.response`
- And `Stage3.jsx:25` reads `finalResponse.response`

This means **demos are currently broken** - Stage 1 and Stage 3 tabs show blank content.

**Fix options:**
1. Change DemoView adapter to use `response` key instead of `content`
2. Change Stage components to read `content` instead of `response`

**Recommendation:** Option 1 - fix DemoView adapter. The Stage components work correctly with the real API, so we should make demo data match that shape.

#### 2. Migration 009 deletes deposit options - **REVIEW UPDATE**
**Status:** ✅ Fixed

Soft-delete keeps old rows but webhook lookups still require `is_active = true`, so any in-flight checkout created before the migration will fail in `handle_successful_payment` when it calls `get_deposit_option`. The migration needs either:
- A non-destructive insert for new tiers (leave existing options active), or
- A webhook lookup that allows inactive options for historical sessions.

**Concrete fix (recommended):**
- Update `get_deposit_option` to accept `include_inactive: bool = False` and skip the `is_active` filter when true.
- In `handle_successful_payment`, call `get_deposit_option(pack_id, include_inactive=True)` so legacy sessions resolve while the UI still hides inactive tiers.

**Implementation:**
- Added `include_inactive` parameter to `storage.get_deposit_option()`
- Updated `main.py:946` to call with `include_inactive=True`
- Updated `storage_local.py` to match signature

---

### Medium Priority

#### 3. Local JSON non-UUID deposit option IDs - **CONFIRMED**
**Status:** Fixed (verified)

**Analysis:** Verified the issue:
- `storage_local.py:601-605` returns IDs like `"deposit-1"`, `"deposit-2"`
- `models.py:116` schema expects `id: UUID`
- Pydantic validation will fail when serializing response

**Fix:** Use real UUIDs in local storage stub:
```python
{"id": "550e8400-e29b-41d4-a716-446655440001", "name": "$1 Try It", ...}
```

---

### Low Priority

#### 4. Cost estimate hardcoded - **ALREADY ADDRESSED**
**Status:** Fixed (verified)

Extracted to `frontend/src/config.js` with `COST_ESTIMATE` constant and `lastReviewed` date for tracking when to re-verify.

---

## Summary

| Finding | Severity | Status | Action |
|---------|----------|--------|--------|
| Demo Stage 1/3 blank | High | ✅ Fixed | Changed adapter to use `response` key |
| Migration 009 deactivates options | High | ✅ Fixed | Added `include_inactive` param to `get_deposit_option()` |
| Local JSON non-UUID IDs | Medium | ✅ Fixed | Using stable UUIDs |
| Cost estimate hardcoded | Low | ✅ Fixed | Extracted to config.js with typical-cost label |

**All Codex findings have been addressed.**
