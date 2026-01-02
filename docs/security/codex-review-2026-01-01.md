# Codex Security Review - 2026-01-01

## Findings from Codex

| Severity | Finding | File Reference |
|----------|---------|----------------|
| High | JWTs stored in localStorage, XSS can steal tokens | `frontend/src/api.js:10` |
| Medium | No rate limiting on checkout/provisioning endpoints | `backend/main.py:514, 576, 626` |
| Medium | Webhook relies on metadata[user_id] without cross-checking client_reference_id | `backend/main.py:728, 740` |
| Low | Redirect allowlist derived from CORS_ORIGINS | `backend/main.py:558` |
| Low | In-memory rate limiting bypassable in multi-instance | `backend/rate_limit.py:3` |

---

## Claude Opus 4.5 Review

### High: JWTs in localStorage

**Status: ALREADY ACCEPTED (repeat finding)**

This was reviewed and accepted in two prior reviews:

1. `docs/security/production-readiness-2025-12-31.md:141`:
   > "JWTs in localStorage | ⏭️ **ACCEPTED** | Standard SPA pattern. CSP headers are higher priority mitigation."

2. `CLAUDE.md:699`:
   > "JWTs in localStorage - accepted (standard SPA, CSP is better mitigation)"

**Rationale:** HttpOnly cookies add CSRF complexity. Current approach is standard for SPAs. CSP headers provide better XSS mitigation. Would reconsider for enterprise/high-security deployments.

**Action:** None required.

---

### Medium: No rate limiting on checkout/provisioning endpoints

**Status: NEW FINDING - NEEDS FIX**

Prior security fixes (2025-12-31) added rate limiting to auth endpoints:
- OAuth callback (IP-based)
- Token refresh (IP-based)
- Settings endpoints (user_id-based)

However, payment-related endpoints were not included:
- `/api/credits/checkout` (line 576) - legacy credit packs
- `/api/deposits/checkout` (line 626) - current deposit flow
- `/api/credits/provision-key` (line 514) - OpenRouter key provisioning

**Risk:**
- Card testing abuse via repeated checkout session creation
- Automated session spam
- Provisioning endpoint abuse

**Action:** Add rate limiting to these endpoints. Recommend:
- Per-user rate limit (e.g., 10 checkout attempts per hour)
- Per-IP rate limit as backup

---

### Medium: Webhook metadata trust

**Status: ALREADY ADDRESSED**

The concern is that webhook uses `metadata["user_id"]` without cross-checking `client_reference_id` or `customer`.

**Analysis of current implementation (`main.py:720-769`):**

1. Webhook has Stripe signature verification (not shown, but in webhook handler)
2. Session is re-fetched from Stripe API:
   ```python
   verified_session = stripe_client.get_session_details(session_id)
   ```
3. Metadata comes from the verified session, not raw webhook payload
4. Amount and currency are validated against database:
   ```python
   if actual_amount != expected_price_cents:
       raise ValueError(...)
   ```

The metadata is trustworthy because:
- It's from a Stripe-signed webhook
- We verify by fetching the session from Stripe API
- We validate the payment amount matches our records

Prior fix documented in `CLAUDE.md:709`:
> "Session verification from Stripe API (don't trust webhook metadata alone)"

**Action:** None required. Adding `client_reference_id` check would be defense-in-depth but not critical.

---

### Low: Redirect allowlist derived from CORS_ORIGINS

**Status: ACCEPTABLE**

The `_validate_redirect_url()` function at `main.py:558-573`:
- Parses the URL
- Checks scheme AND netloc against CORS_ORIGINS
- Rejects non-matching URLs

```python
if parsed.scheme == allowed_parsed.scheme and parsed.netloc == allowed_parsed.netloc:
    return True
```

Prior fix documented in `CLAUDE.md:714`:
> "URL allowlisting for success/cancel redirects (prevents open redirect)"

**Why acceptable:**
- Production CORS_ORIGINS contains only the Vercel frontend URL (HTTPS)
- Scheme is explicitly validated (prevents http:// in prod)
- A dedicated allowlist would be marginally better but adds config complexity

**Action:** None required.

---

### Low: In-memory rate limiting bypassable in multi-instance

**Status: ALREADY DEFERRED (repeat finding)**

This was reviewed and explicitly deferred in prior reviews:

1. `docs/security/production-readiness-2025-12-31.md:128`:
   > "OAuth state/rate limiting in-memory | ⏭️ **DEFERRED** | Acceptable for single-instance. Documented limitation. Redis needed before autoscaling."

2. `CLAUDE.md:697`:
   > "Redis for OAuth state/rate limiting (needed before autoscaling)"

**Current state:** Single-instance deployment on Fly.io (max 1 machine).

**Action:** None required until autoscaling is enabled. Redis migration documented as prerequisite.

---

## Summary

| Finding | Verdict | Action |
|---------|---------|--------|
| JWTs in localStorage | Repeat - Already accepted | None |
| No rate limiting on checkout | **New - Needs fix** | Add rate limiting |
| Webhook metadata trust | Already addressed | None |
| CORS_ORIGINS for redirects | Acceptable | None |
| In-memory rate limiting | Repeat - Already deferred | None |

## Implementation Status

- [ ] Add rate limiting to `/api/deposits/checkout` endpoint
- [ ] Add rate limiting to `/api/credits/checkout` endpoint
- [ ] Add rate limiting to `/api/credits/provision-key` endpoint
