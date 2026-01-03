# Privacy Compliance Implementation

Implementation details for privacy compliance features.

**Branch:** `feature/privacy-compliance`
**Date:** 2026-01-02
**Updated:** 2026-01-03

---

## Features Implemented

### 1. Privacy Policy Page (`/privacy`)

Comprehensive privacy policy covering:
- Data collection (account info, conversations, financial data, BYOK keys)
- Third-party data sharing (OpenRouter, Stripe, OAuth providers)
- Data retention policies
- Security measures
- User rights

### 2. Terms of Service Page (`/terms`)

Usage terms covering:
- Service description
- Account registration
- Payment and billing (usage-based pricing, deposits, BYOK)
- Acceptable use policy
- AI-generated content disclaimers
- Intellectual property
- Third-party services
- Limitation of liability
- Indemnification

### 3. Account Deletion

**Backend Endpoint:** `DELETE /api/auth/account`

Deletes all user data in a single transaction:
1. Query costs (query_costs)
2. Stage responses (stage1_responses, stage2_rankings, stage3_synthesis)
3. Messages
4. Conversations
5. Transactions (credit_transactions)
6. API keys (user_api_keys)
7. User account

Post-delete cleanup:
- Attempts to revoke any provisioned OpenRouter key (best-effort; failures are logged).
- External provider accounts (Stripe, Google/GitHub OAuth) are not deleted.

**Frontend:** Delete Account button in Account page with confirmation dialog.

### 4. Data Disclosure

Notice in InquiryComposer informing users:
> "Your query will be processed by third-party AI models via OpenRouter. See our Privacy Policy."

---

## Files Changed

### Backend
| File | Changes |
|------|---------|
| `backend/main.py` | Added `DELETE /api/auth/account` and `GET /api/auth/export` endpoints |
| `backend/storage.py` | Added `delete_user_account()` and `export_user_data()` functions |

### Frontend
| File | Changes |
|------|---------|
| `frontend/src/App.jsx` | Added routes for `/privacy` and `/terms` |
| `frontend/src/api.js` | Added `auth.deleteAccount()` and `auth.exportData()` functions |
| `frontend/src/components/PrivacyPolicy.jsx` | NEW - Privacy Policy page |
| `frontend/src/components/TermsOfService.jsx` | NEW - Terms of Service page |
| `frontend/src/components/LegalPage.css` | NEW - Shared legal page styles |
| `frontend/src/components/Account.jsx` | Added export + delete account UI with confirmation dialog |
| `frontend/src/components/Account.css` | Added danger zone and legal link styles |
| `frontend/src/components/InquiryComposer.jsx` | Added data disclosure notice |
| `frontend/src/components/InquiryComposer.css` | Added disclosure styles |
| `frontend/src/components/Login.jsx` | Added legal links to footer, updated pricing options |
| `frontend/src/components/Login.css` | Added legal link and pricing option styles |

### Documentation
| File | Changes |
|------|---------|
| `docs/DATA_STORAGE.md` | Updated user rights status |
| `CLAUDE.md` | Documented `DELETE /api/auth/account` endpoint |

---

## Navigation

Legal links are accessible from:
- Login page footer
- Account page (Account Management section)
- InquiryComposer (Privacy Policy link in disclosure)
- Cross-links between Privacy Policy and Terms of Service pages

---

### 5. Data Export

**Backend Endpoint:** `GET /api/auth/export`

Returns a ZIP archive containing:
- `data.json` - Complete data export (account, conversations, transactions, usage history, summary, schema_version)
- `conversations/*.md` - Each conversation as a Markdown file (human-readable)
- `conversations/index.md` - Table of contents for all conversations
- `account_summary.md` - Account overview in Markdown
- `manifest.json` - File checksums and byte sizes for integrity verification

**Frontend:** "Download" button in Account page (Data & Privacy section).

---

## User Rights Status

| Right | Status |
|-------|--------|
| View data | Available (Account page, conversation history) |
| Export data | Available (Account page > Data & Privacy) |
| Delete account | Available (Account page > Data & Privacy) |
| Delete conversations | Available (Archive sidebar) |

---

*Implemented: 2026-01-02*
