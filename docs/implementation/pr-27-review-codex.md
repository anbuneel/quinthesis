# PR 27 Review (Codex)
Author: Codex
Date: 2026-01-02 11:30:01 -05:00
PR: https://github.com/anbuneel/ai-council/pull/27

## Findings

### High
- Demo Stage 1/3 render blank because the demo adapter writes `content` while the stage components read `response`. `frontend/src/components/DemoView.jsx:22` `frontend/src/components/DemoView.jsx:38` `frontend/src/components/Stage1.jsx:86` `frontend/src/components/Stage3.jsx:25`
- Migration 009 deletes all deposit options, which invalidates in-flight Stripe sessions and can trigger "Deposit option not found" in webhook handling. `backend/migrations/009_add_lower_deposit_options.sql:4` `backend/main.py:945`

### Medium
- Local JSON mode returns non-UUID deposit option IDs, but response/request schemas require UUID, so `/api/deposits/options` and checkout can 422 in local dev. `backend/storage_local.py:598` `backend/models.py:114`

### Low
- Cost estimate is hard-coded and may be misleading for higher-cost models or long prompts; consider making it dynamic or labeling it as an example. `frontend/src/components/InquiryComposer.jsx:183`

---

## Analysis (Claude)

### High Priority

#### 1. Demo Stage 1/3 render blank - **CONFIRMED BUG**
**Status:** ✅ Fixed

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

#### 2. Migration 009 deletes deposit options - **ALREADY FIXED**
**Status:** Fixed in commit b4a9ad5

Changed `DELETE FROM deposit_options` to `UPDATE deposit_options SET is_active = false` (soft-delete).

---

### Medium Priority

#### 3. Local JSON non-UUID deposit option IDs - **CONFIRMED**
**Status:** ✅ Fixed

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
**Status:** Fixed in commit 4a42502

Extracted to `frontend/src/config.js` with `COST_ESTIMATE` constant and `lastReviewed` date for tracking when to re-verify.

---

## Summary

| Finding | Severity | Status | Action |
|---------|----------|--------|--------|
| Demo Stage 1/3 blank | High | ✅ Fixed | Changed adapter to use `response` key |
| Migration 009 DELETE | High | ✅ Fixed | Soft-delete implemented |
| Local JSON non-UUID IDs | Medium | ✅ Fixed | Using stable UUIDs |
| Cost estimate hardcoded | Low | ✅ Fixed | Extracted to config.js |

**All Codex findings have been addressed.**
