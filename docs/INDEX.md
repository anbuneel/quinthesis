# Documentation Index

Chronological reference to all project documentation.

---

## 2025-12-26

| Document | Description |
|----------|-------------|
| [UI_REDESIGN_PROPOSAL_opus_claude.md](UI_REDESIGN_PROPOSAL_opus_claude.md) | Full UI redesign proposal - "Paper of Record" editorial theme |
| [MULTI_USER_ROADMAP.md](MULTI_USER_ROADMAP.md) | Roadmap for multi-user support and authentication |
| [PHASE1_IMPLEMENTATION_PLAN.md](PHASE1_IMPLEMENTATION_PLAN.md) | Phase 1 implementation plan for UI redesign |

### Archive (superseded)
| Document | Description |
|----------|-------------|
| [archive/UI_REDESIGN_PROPOSAL_claude.md](archive/UI_REDESIGN_PROPOSAL_claude.md) | Earlier UI redesign proposal |
| [archive/ui-redesign-plan.md](archive/ui-redesign-plan.md) | Initial UI redesign planning |
| [archive/NEW_INQUIRY_UX_REDESIGN.md](archive/NEW_INQUIRY_UX_REDESIGN.md) | New inquiry UX redesign notes |
| [archive/DESIGN_PROPOSAL.md](archive/DESIGN_PROPOSAL.md) | Original design proposal |

---

## 2025-12-27

| Document | Description |
|----------|-------------|
| [UI_UX_REVIEW.md](UI_UX_REVIEW.md) | UI/UX review and recommendations |

---

## 2025-12-28

| Document | Description |
|----------|-------------|
| [ai-council-review-codex-20251228-154048.md](ai-council-review-codex-20251228-154048.md) | Comprehensive security review by Codex |
| [IMPLEMENTATION_PLAN_security_fixes.md](IMPLEMENTATION_PLAN_security_fixes.md) | Security fixes implementation plan (Phase 1-3) |
| [OAUTH_IMPLEMENTATION_PLAN.md](OAUTH_IMPLEMENTATION_PLAN.md) | OAuth authentication implementation plan |
| [CLEANUP_PLAN.md](CLEANUP_PLAN.md) | Code cleanup plan |

---

## 2025-12-31

| Document | Description |
|----------|-------------|
| [production_readiness_review_codex.md](production_readiness_review_codex.md) | Production readiness review by Codex |

---

## 2026-01-01

| Document | Description |
|----------|-------------|
| [IMPLEMENTATION_PLAN_stripe_credits.md](IMPLEMENTATION_PLAN_stripe_credits.md) | Credit-based monetization with Stripe (superseded by usage-based billing) |
| [byok_friction_recommendations_codex.md](byok_friction_recommendations_codex.md) | BYOK friction reduction recommendations |
| [IMPLEMENTATION_PLAN_usage_based_billing.md](IMPLEMENTATION_PLAN_usage_based_billing.md) | Usage-based billing plan (implemented) |
| [DESIGN_account_page.md](DESIGN_account_page.md) | **[IMPLEMENTED]** Account page design - replaces Settings modal |

## 2026-01-02

| Document | Description |
|----------|-------------|
| Account Page implementation | Dedicated `/account` page with "Financial Gazette" editorial styling |

### Claude Sessions
| Document | Description |
|----------|-------------|
| [claude-sessions/2026-01-01-how-can-i-enhance-this-to-make-it-open-for-public.txt](claude-sessions/2026-01-01-how-can-i-enhance-this-to-make-it-open-for-public.txt) | Conversation transcript: public launch planning |

---

## Status Legend

- **Implemented**: Feature is live in production
- **Pending**: Plan approved, implementation not started
- **Superseded**: Replaced by newer documentation (moved to archive)

## Current Focus

**Account Page** - Implemented! A dedicated Account page at `/account` with editorial styling:
- Balance card with deposit/spent stats
- Deposit options ($5/$10/$20)
- API Settings section with BYOK support
- Transaction ledger with expandable cost breakdowns
- Member info section

**Usage-Based Billing** - Implemented! Two options:
1. **Credits Mode:** Pay actual OpenRouter cost + 10% margin per query
2. **BYOK Mode:** Use your own OpenRouter API key, pay OpenRouter directly

**Completed:**
1. [x] Database migrations: `006_usage_based_billing.sql`, `007_byok_support.sql`, `008_update_deposit_options.sql`
2. [x] Account page replaces Settings modal
3. [x] BYOK (Bring Your Own Key) support
4. [x] Deposit options updated to $5/$10/$20
