# PR Review: Privacy Compliance
Author: Codex
Date: 2026-01-02 01:15:33 -05:00
Branch: feature/privacy-compliance
Base: master

## Findings

### High

| Issue | Status | Resolution |
|-------|--------|------------|
| delete_user_account deletes stage tables by conversation_id but those tables only have message_id, so the transaction rolls back. `backend/storage.py:1547` `backend/migrations/000_create_base_schema.sql:32` | ✅ FIXED | Changed to first fetch message IDs for the conversations, then delete stage data by message_id. |
| Export/delete query a transactions table that is not created by migrations (only credit_transactions and query_costs exist), so Postgres installs will error. `backend/storage.py:1483` `backend/storage.py:1573` | ✅ FIXED | Changed table name from `transactions` to `credit_transactions` in both export and delete queries. |
| export_user_data references timezone without an import, causing a NameError on export. `backend/storage.py:1506` | ✅ FIXED | Added `timezone` to the datetime import: `from datetime import datetime, timezone`. |

### Medium

| Issue | Status | Resolution |
|-------|--------|------------|
| Local JSON storage lacks export_user_data/delete_user_account, so these endpoints fail when DATABASE_URL is unset. `backend/storage_local.py` | ✅ FIXED | Added both functions to storage_local.py with appropriate local file handling. Also added timezone import. |
| Privacy policy says IPs are not logged or stored, but IPs are used for rate limiting and likely appear in infra logs. `frontend/src/components/PrivacyPolicy.jsx:162` `backend/main.py:88` | ✅ FIXED | Updated privacy policy to clarify: IPs are used transiently for rate limiting but not stored in database; may appear in infrastructure logs. |

---

## Summary

**All 5 issues have been fixed** in commit `2a0c2d1`.

### Root Causes

| Bug | Root Cause |
|-----|------------|
| Stage table delete fails | Assumed `conversation_id` column existed without checking schema |
| Wrong table name | Used `transactions` instead of `credit_transactions` without verifying migrations |
| timezone NameError | Added `timezone.utc` usage without checking imports |
| Local storage missing functions | Only updated `storage.py`, forgot `storage_local.py` fallback |
| Privacy policy inaccuracy | Documentation not verified against actual code behavior |

### Lessons Learned

1. **Read migration files before writing SQL** - Don't assume column names exist
2. **Verify table names** - Check migrations before referencing tables
3. **Check imports when using new symbols** - Verify all dependencies are imported
4. **Update both storage implementations** - `storage.py` (PostgreSQL) and `storage_local.py` (JSON fallback)
5. **Verify documentation claims** - Ensure docs match actual code behavior

These lessons have been added to `CLAUDE.md` for future reference.
