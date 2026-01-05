# Documentation Index

Project documentation organized by category.

---

## Security

Security reviews and implementation plans.

| Document | Description | Date |
|----------|-------------|------|
| [codex-review-2025-12-28.md](security/codex-review-2025-12-28.md) | Comprehensive security review by Codex | 2025-12-28 |
| [security-fixes-plan.md](security/security-fixes-plan.md) | Security fixes implementation (Phase 1-3) | 2025-12-28 |
| [production-readiness-2025-12-31.md](security/production-readiness-2025-12-31.md) | Production readiness review by Codex | 2025-12-31 |
| [codex-review-2026-01-01.md](security/codex-review-2026-01-01.md) | Billing security review (all items resolved) | 2026-01-01 |

---

## Design

UI/UX design proposals and reviews.

| Document | Description | Date |
|----------|-------------|------|
| [ui-redesign-proposal.md](design/ui-redesign-proposal.md) | "Paper of Record" editorial theme design | 2025-12-26 |
| [ui-ux-review.md](design/ui-ux-review.md) | UI/UX review and recommendations | 2025-12-27 |
| [account-page.md](design/account-page.md) | Account page design (implemented) | 2026-01-01 |
| [ui-audit-2026-01-02.md](design/ui-audit-2026-01-02.md) | Comprehensive UI audit: design drift and inconsistencies | 2026-01-02 |
| [quinthesis-rebrand-summary-claude.md](design/quinthesis-rebrand-summary-claude.md) | Quinthesis rebrand decision summary | 2026-01-03 |
| [quinthesis-brand-exploration-claude.md](design/quinthesis-brand-exploration-claude.md) | Visual branding: logo, typography, colors, masthead | 2026-01-03 |
| [quinthesis-taglines-claude.md](design/quinthesis-taglines-claude.md) | Tagline options (5 categories, top 5 recommendations) | 2026-01-03 |
| [quinthesis-rebrand-audit-claude.md](design/quinthesis-rebrand-audit-claude.md) | Codebase audit: 93 references to update | 2026-01-03 |
| [account-page-tabs-proposal-claude.md](design/account-page-tabs-proposal-claude.md) | Account page tab separation (editorial underline tabs) | 2026-01-05 |

---

## Implementation

Feature implementation plans and roadmaps.

| Document | Description | Date |
|----------|-------------|------|
| [multi-user-roadmap.md](implementation/multi-user-roadmap.md) | Multi-user support and authentication roadmap | 2025-12-26 |
| [phase1-ui-redesign.md](implementation/phase1-ui-redesign.md) | Phase 1 UI redesign implementation | 2025-12-26 |
| [oauth.md](implementation/oauth.md) | OAuth authentication implementation | 2025-12-28 |
| [cleanup.md](implementation/cleanup.md) | Code cleanup plan | 2025-12-28 |
| [usage-based-billing.md](implementation/usage-based-billing.md) | Usage-based billing (implemented) | 2026-01-01 |
| [byok-recommendations.md](implementation/byok-recommendations.md) | BYOK friction reduction recommendations | 2026-01-01 |
| [pr-27-review-codex.md](implementation/pr-27-review-codex.md) | PR #27 launch readiness review (all items fixed) | 2026-01-02 |
| [privacy-compliance.md](implementation/privacy-compliance.md) | Privacy compliance (Privacy Policy, ToS, account deletion) | 2026-01-03 |
| [key-rotation.md](implementation/key-rotation.md) | API key encryption rotation procedure | 2026-01-03 |

---

## Infrastructure

Hosting, deployment, and infrastructure analysis.

| Document | Description | Date |
|----------|-------------|------|
| [infra-prod-readiness-claude.md](infrastructure/infra-prod-readiness-claude.md) | Free tier analysis (Fly.io, Supabase, Vercel) | 2026-01-02 |
| [sentry-integration.md](infrastructure/sentry-integration.md) | Sentry error monitoring setup and configuration | 2026-01-03 |
| [quinthesis-deployment-guide.md](infrastructure/quinthesis-deployment-guide.md) | Infrastructure setup for Quinthesis rebrand | 2026-01-03 |
| [openrouter-provisioning.md](infrastructure/openrouter-provisioning.md) | OpenRouter provisioning keys and usage tracking | 2026-01-04 |

---

## Testing

Testing strategy and automation plans.

| Document | Description | Date |
|----------|-------------|------|
| [automated-testing-plan-claude.md](testing/automated-testing-plan-claude.md) | Automated testing plan and tool recommendations (Claude) | 2026-01-05 |
| [testing-plan-codex.md](testing/testing-plan-codex.md) | Testing strategy, tooling, and phased rollout (Codex) | 2026-01-05 |

---

## Analysis

Codebase analysis and snapshots.

| Document | Description | Date |
|----------|-------------|------|
| [codebase-snapshot-claude.md](analysis/codebase-snapshot-claude.md) | Codebase snapshot timeline (architecture, tech stack, metrics) | 2026-01-05 |

---

## Reference

Technical reference documentation.

| Document | Description | Date |
|----------|-------------|------|
| [DATA_STORAGE.md](DATA_STORAGE.md) | What user data is stored and how it's handled | 2026-01-03 |
| [CLAUDE.md](../CLAUDE.md) | Canonical agent reference (mirrored in AGENTS.md) | 2026-01-03 |
| [AGENTS.md](../AGENTS.md) | Codex agent reference (mirrors CLAUDE.md) | 2026-01-03 |

---

## Sessions

Claude conversation transcripts (local only - not committed to git).

*Session files are stored locally in `docs/sessions/` but excluded from git to prevent accidental secret exposure.*

---

## Archive

Superseded documentation (kept for reference).

| Document | Description |
|----------|-------------|
| [UI_REDESIGN_PROPOSAL_claude.md](archive/UI_REDESIGN_PROPOSAL_claude.md) | Earlier UI redesign proposal |
| [ui-redesign-plan.md](archive/ui-redesign-plan.md) | Initial UI redesign planning |
| [NEW_INQUIRY_UX_REDESIGN.md](archive/NEW_INQUIRY_UX_REDESIGN.md) | New inquiry UX redesign notes |
| [DESIGN_PROPOSAL.md](archive/DESIGN_PROPOSAL.md) | Original design proposal |
| [stripe-credits-plan.md](archive/stripe-credits-plan.md) | Credit-based billing (superseded by usage-based) |

---

## Launch

Launch planning and checklists.

| Document | Description | Date |
|----------|-------------|------|
| [launch-checklist.md](launch-checklist.md) | Launch checklist, messaging, SEO, channels | 2026-01-04 |

---

## Quick Reference

**Current Status:**
- Production app deployed (Vercel + Fly.io + Supabase)
- Usage-based billing implemented ($1/$2/$5/$10 deposits + BYOK)
- All security fixes complete (Phase 1-3 + checkout rate limiting)
- Privacy compliance ready (Privacy Policy, ToS, account deletion)
- Free tier infrastructure verified ready for launch
- SEO basics implemented (meta tags, sitemap, robots.txt)

**Key Docs:**
- **Launch:** [launch-checklist.md](launch-checklist.md)
- Security: [production-readiness-2025-12-31.md](security/production-readiness-2025-12-31.md)
- Design: [ui-redesign-proposal.md](design/ui-redesign-proposal.md)
- Billing: [usage-based-billing.md](implementation/usage-based-billing.md)
- Data: [DATA_STORAGE.md](DATA_STORAGE.md)
- Infrastructure: [infra-prod-readiness-claude.md](infrastructure/infra-prod-readiness-claude.md)
