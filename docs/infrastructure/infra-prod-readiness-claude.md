# Free Tier Infrastructure Analysis

**Date:** 2026-01-02
**Status:** Ready for Launch

Analysis of whether free tiers of Fly.io, Supabase, and Vercel are adequate for production launch.

---

## Verdict: Free Tiers Are Adequate for Launch

For a project expecting 0-few users, the free tiers are well-suited.

---

## Fly.io Free Tier

| Limit | Our Usage | Status |
|-------|-----------|--------|
| 3 shared-cpu VMs | 1 VM (1GB, shared) | OK |
| 3GB persistent storage | ~0 (stateless) | OK |
| 160GB outbound/month | Low (API responses) | OK |

**Current Configuration:**
- App: `ai-council-api`
- Region: `sjc` (San Jose)
- Memory: 1GB shared CPU
- Port: 8080
- Auto-scaling: min 0, max unlimited (but limited to 1 for OAuth state)

**Key Constraint:** Config uses `min_machines_running = 0`, so the VM stops when idle:
- **Cold starts:** First request after idle takes 5-10s (VM spin-up)
- **Cost:** $0 when no traffic

**Recommendation:** Fine for launch. Set `min_machines_running = 1` if cold starts are unacceptable (consumes free allowance faster).

---

## Supabase Free Tier

| Limit | Our Usage | Status |
|-------|-----------|--------|
| 500MB database | Schema ~50KB | OK |
| 2GB bandwidth | Low API traffic | OK |
| 50MB file storage | Not used | N/A |
| Pauses after 1 week inactive | **Risk** | Warning |

**Key Constraint:** Supabase pauses free projects after 7 days of inactivity. When paused:
- First request fails
- User must wait for reactivation (~30s)

**Recommendation:** Set up a simple cron/uptime monitor to ping the backend daily:
- [Cron-job.org](https://cron-job.org) (free)
- [UptimeRobot](https://uptimerobot.com) (free tier)

This prevents pause and costs nothing.

---

## Vercel Free Tier

| Limit | Our Usage | Status |
|-------|-----------|--------|
| 100GB bandwidth/month | Static SPA (~500KB) | OK |
| Serverless functions | Not used (API on Fly) | N/A |
| Build minutes | React build ~30s | OK |

**No concerns.** Vercel free tier is generous for static sites.

---

## OpenRouter Considerations

Not a hosting tier, but relevant for cost management:

- **Provisioning API:** Per-user provisioned keys
- **Credit Pool:** Users draw from our OpenRouter credits
- **Query Cost:** A single expensive query (GPT-5.1 + Claude Sonnet) could cost $0.05-0.20

**Safeguards in Place:**
- $0.50 minimum balance check before queries
- Usage-based billing with 10% margin
- Per-query cost tracking

**Recommendation:** Set daily spend cap alerts on OpenRouter dashboard.

---

## Stripe

Free for test mode. In live mode:
- 2.9% + $0.30 per transaction
- No monthly fees

**Deposit Tiers and Net Revenue:**

| Deposit | Stripe Fee | Net |
|---------|------------|-----|
| $1 | $0.33 | $0.67 |
| $2 | $0.36 | $1.64 |
| $5 | $0.45 | $4.55 |
| $10 | $0.59 | $9.41 |
| $20 | $0.88 | $19.12 |

---

## Architecture Constraints (Regardless of Tier)

| Issue | Impact | Mitigation |
|-------|--------|------------|
| In-memory rate limiting | Can't scale beyond 1 instance | Document for future Redis migration |
| In-memory OAuth state | Same limitation | Fine for single instance |
| Cold starts (Fly + Supabase) | First request slow after idle | Uptime monitor prevents this |
| Single point of failure | No redundancy | Acceptable for hobby project |

---

## Resource Configuration Summary

### Backend (`fly.toml`)
```toml
[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "1gb"
  cpu_kind = "shared"
  cpus = 1
```

### Database Pool (`database.py`)
- Min connections: 2
- Max connections: 10
- Command timeout: 60s

### Rate Limiting (`rate_limit.py`)
- General API: 30 req/min per user/IP
- Council queries: 10 req/min per user
- Checkout: 10 req/min per user+IP

### HTTP Client (`openrouter.py`)
- Timeout: 120s (10s connect)
- Connection pool: 100 max, 20 keepalive
- Retry: 3 attempts with exponential backoff

---

## Launch Checklist

### Required Actions

- [ ] **Set up uptime monitor** to prevent Supabase pause
  - Ping `GET https://ai-council-api.fly.dev/` daily
  - Use Cron-job.org or UptimeRobot (free)

### Optional Actions

- [ ] Set `min_machines_running = 1` in `fly.toml` if cold starts are unacceptable
- [ ] Set OpenRouter daily spend alerts
- [ ] Monitor Stripe dashboard for disputes

### Already Complete

- [x] All environment variables configured
- [x] Database migrations run
- [x] OAuth apps configured (Google, GitHub)
- [x] Stripe webhook configured
- [x] CORS origins set
- [x] Health check endpoint working

---

## Upgrade Triggers

When to upgrade from free tiers:

| Trigger | Action |
|---------|--------|
| >5 concurrent users | Fly.io paid ($5/mo) for 2nd instance |
| >500MB database | Supabase Pro ($25/mo) |
| Multi-instance scaling | Add Redis (Upstash free tier or ~$5-10/mo) |
| High availability needed | Multiple regions, read replicas |

---

## Cost Projection (Monthly)

### Zero Users (Current)
- Fly.io: $0 (auto-stops)
- Supabase: $0 (with uptime monitor)
- Vercel: $0
- OpenRouter: $0 (no queries)
- **Total: $0/month**

### 10 Active Users (Estimate)
- Fly.io: $0-5 (may hit free tier limits)
- Supabase: $0 (well under limits)
- Vercel: $0
- OpenRouter: ~$5-20 (depending on usage, covered by deposits)
- **Total: ~$5-25/month** (mostly OpenRouter costs covered by user deposits)

---

## Conclusion

The free tier stack is production-ready for launch. The only required action is setting up an uptime monitor to prevent Supabase database pausing. All other constraints are acceptable for low-traffic usage and well-documented for future scaling.
