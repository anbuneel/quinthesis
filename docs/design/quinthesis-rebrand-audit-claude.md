# Quinthesis Rebrand Audit: Codebase References

**Author:** Claude (Opus 4.5)
**Date:** January 3, 2026
**Status:** Complete Audit

---

## Summary Statistics

| Category | Count | Priority |
|----------|-------|----------|
| Critical (deployment/URLs) | 11 | Immediate |
| High (user-facing/legal) | 28 | Week 1 |
| Medium (documentation) | 35 | Week 2 |
| Low (archived/comments) | 19 | Optional |
| **Total** | **93** | |

---

## Critical Changes (Deployment & URLs)

These must be coordinated—changing one requires updating others.

### Fly.io Configuration
| File | Line | Current | Change To |
|------|------|---------|-----------|
| `fly.toml` | 6 | `app = 'ai-council-api'` | `app = 'quinthesis-api'` |
| `fly.toml` | 1 | Comment: `ai-council-api` | Update comment |

### URLs (6 locations)
| File | Current URL | New URL |
|------|-------------|---------|
| `CLAUDE.md` | `https://ai-council-anbs.vercel.app` | `https://quinthesis.vercel.app` |
| `CLAUDE.md` | `https://ai-council-api.fly.dev` | `https://quinthesis-api.fly.dev` |
| `CLAUDE.md` | `https://github.com/anbuneel/ai-council` | `https://github.com/anbuneel/quinthesis` |
| `AGENTS.md` | Same URLs as CLAUDE.md | Same changes |
| `README.md` | Same URLs | Same changes |
| `frontend/src/legalConfig.js` | `repositoryUrl` | Update |

### Stripe Webhook (must update in Stripe Dashboard too)
| Location | Current | New |
|----------|---------|-----|
| Stripe Dashboard | `https://ai-council-api.fly.dev/api/webhooks/stripe` | `https://quinthesis-api.fly.dev/api/webhooks/stripe` |

---

## High Priority: User-Facing Text

### Frontend Components

| File | Location | Current Text | New Text |
|------|----------|--------------|----------|
| `frontend/index.html` | Line 9 | `<title>AI Council</title>` | `<title>Quinthesis</title>` |
| `frontend/src/components/Login.jsx` | Line 31 | `The AI Council` | `Quinthesis` |
| `frontend/src/components/Masthead.jsx` | Lines 37, 53, 87 | `The AI Council` | `Quinthesis` |
| `frontend/src/components/DemoView.jsx` | Line 30 | `AI Council` in title | `Quinthesis` |
| `frontend/src/components/DemoView.jsx` | Line 43 | `AI Council` in og:title | `Quinthesis` |
| `frontend/src/components/DemoView.jsx` | Line 135 | Description text | Rewrite |
| `frontend/src/components/PaymentSuccess.jsx` | Line 69 | `Continue to AI Council` | `Continue to Quinthesis` |
| `frontend/src/components/PaymentCancel.jsx` | Line 28 | `Return to AI Council` | `Return to Quinthesis` |
| `frontend/src/api.js` | Line 250 | `ai-council-export.zip` | `quinthesis-export.zip` |

### Legal Documents

| File | Changes Needed |
|------|----------------|
| `frontend/src/components/TermsOfService.jsx` | ~15 references to "AI Council" |
| `frontend/src/components/PrivacyPolicy.jsx` | ~10 references to "AI Council" |

### Backend User-Facing

| File | Line | Current | New |
|------|------|---------|-----|
| `backend/main.py` | 615 | `ai-council-export-{date}.zip` | `quinthesis-export-{date}.zip` |
| `backend/stripe_client.py` | 72 | `AI Council usage` | `Quinthesis usage` |
| `backend/stripe_client.py` | 74 | `AI Council queries` | `Quinthesis queries` |

---

## Medium Priority: Documentation

### Core Documentation

| File | Changes |
|------|---------|
| `README.md` | Title, description, URLs (~5 refs) |
| `CLAUDE.md` | Project header, URLs, Quick Links (~10 refs) |
| `AGENTS.md` | Same as CLAUDE.md (~10 refs) |
| `docs/DATA_STORAGE.md` | Title reference |

### Design Documentation

| File | Changes |
|------|---------|
| `docs/design/ui-redesign-proposal.md` | Title, design philosophy refs |
| `docs/design/ui-ux-review.md` | Title, branding discussion section |
| `docs/design/ui-audit-2026-01-02.md` | Frontend references |

### Infrastructure Documentation

| File | Changes |
|------|---------|
| `docs/infrastructure/infra-prod-readiness-claude.md` | App name, health check URL |
| `docs/infrastructure/sentry-integration.md` | Title |

### Security Documentation

| File | Changes |
|------|---------|
| `docs/security/codex-review-2025-12-28.md` | Title |
| `docs/security/production-readiness-2025-12-31.md` | Title |
| `docs/security/security-fixes-plan.md` | PR links (if repo renamed) |

### Implementation Documentation

| File | Changes |
|------|---------|
| `docs/implementation/cleanup.md` | Title |
| `docs/implementation/multi-user-roadmap.md` | Context |
| `docs/implementation/usage-based-billing.md` | Context |
| `docs/implementation/oauth.md` | Example URLs |

---

## Low Priority: Archive & Internal

### Archived Documents (Mark as historical)

| File | Action |
|------|--------|
| `docs/archive/DESIGN_PROPOSAL.md` | Add archive note |
| `docs/archive/UI_REDESIGN_PROPOSAL_claude.md` | Add archive note |
| `docs/archive/ui-redesign-plan.md` | Add archive note |
| `docs/archive/stripe-credits-plan.md` | Add archive note |

### Internal Code Comments

| File | Location | Note |
|------|----------|------|
| `backend/config.py` | Line 1 | Docstring: "LLM Council" |
| `backend/council.py` | Lines 146, 169, 179 | System prompts: "Chairman", "LLM Council" |
| `backend/migrations/000_create_base_schema.sql` | Line 1 | Comment |
| `pyproject.toml` | Line 2 | Package name (optional) |

---

## Backend System Prompts (Special Consideration)

The file `backend/council.py` contains LLM prompts that use "Council" and "Chairman" terminology:

```python
# Line 169
chairman_prompt = f"""You are the Chairman of an LLM Council...

# Line 179
Your task as Chairman is to synthesize...
```

**Options:**
1. **Keep as-is:** The prompts work well; "Chairman" is internal implementation
2. **Update terminology:** Change to "Lead Synthesizer" or similar
3. **Lean into new brand:** "Quintessence Engine" or "Synthesis Lead"

**Recommendation:** Update to neutral language like "Lead Model" and "synthesize the responses" — avoids the gendered "Chairman" term regardless of rebrand.

---

## Rebrand Execution Checklist

### Phase 1: Preparation
- [ ] Register new domain (quinthesis.com / quinthesis.ai)
- [ ] Create new Fly.io app (`quinthesis-api`)
- [ ] Create new Vercel project or update existing
- [ ] Rename GitHub repository (or create new)

### Phase 2: Code Updates
- [ ] Update `fly.toml` app name
- [ ] Update all frontend component text
- [ ] Update legal documents (Terms, Privacy)
- [ ] Update backend export filenames
- [ ] Update Stripe descriptions
- [ ] Regenerate frontend build

### Phase 3: Documentation
- [ ] Update README.md
- [ ] Update CLAUDE.md and AGENTS.md
- [ ] Update all docs/ files
- [ ] Add archive notes to old design docs

### Phase 4: Deployment
- [ ] Deploy new backend to Fly.io
- [ ] Update Stripe webhook URL
- [ ] Deploy frontend to Vercel
- [ ] Configure DNS for new domain
- [ ] Set up redirects from old URLs

### Phase 5: Verification
- [ ] Test OAuth flows with new URLs
- [ ] Test Stripe checkout and webhooks
- [ ] Test all user-facing pages
- [ ] Verify SEO/meta tags
- [ ] Update any external links (docs, marketing)

---

## Files Not Requiring Changes

These were checked and contain no "AI Council" references:
- `frontend/vite.config.js`
- `frontend/vercel.json` (no app name, just config)
- `frontend/package.json` (generic "frontend" name)
- `frontend/src/demoData/demos.json` (no brand references in demo content)
- Most backend files (use generic terms)

---

*Audit completed for Quinthesis rebrand initiative, January 2026*
