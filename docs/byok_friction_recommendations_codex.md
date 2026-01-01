# Remove BYOK Friction - Recommendations
Author: Codex
Date: 2025-12-30 23:03:09-05:00

## Goal
Eliminate the requirement for users to bring their own OpenRouter API key while keeping costs, abuse, and reliability under control.

## Primary Recommendation
Use your own OpenRouter key server-side and introduce a usage model that balances friction and cost:
- Free tier with strict quotas (per-user and per-IP).
- Paid upgrades via credits or subscription for higher limits.
- Keep BYOK as an advanced option for power users, not the default.

## Recommended Product Model
- Default: Hosted key (no BYOK prompt during signup).
- Free tier: Limited daily runs (e.g., 5-10 council runs/day) or smaller model set.
- Paid tiers: More runs, premium models, and full 3-stage pipeline.

## UX Tactics to Reduce Drop-Off
- Demo mode: Allow a short, limited run before any payment wall.
- Progressive disclosure: Ask for payment only after free quota is used.
- Simplify settings: Hide BYOK behind an "Advanced" toggle.

## Cost-Control Guardrails
- Per-user quotas and rate limits (daily and rolling window).
- Per-IP throttles to prevent anonymous abuse.
- Model gating: cheaper models for free tier; premium models for paid tiers.
- Pipeline gating: Free tier runs Stage 1 + Stage 3 only; Stage 2 is paid.
- Spend caps: Hard monthly budget limits with alerts.

## Operational Requirements
- Metering: Track per-user usage (runs or token cost) and enforce quotas.
- Billing: Stripe credits or subscriptions with webhook handling.
- Abuse prevention: CAPTCHA on signup, email verification, and velocity limits.
- Observability: Latency/error metrics, OpenRouter spend dashboards, and alerts.

## Implementation Outline (High-Level)
1. Add usage tracking per user (runs/day, rolling window).
2. Enforce quotas in the backend before council runs.
3. Introduce a hosted-key execution path; keep BYOK optional.
4. Add billing (credits or subscriptions) and upgrade flows.
5. Add model/pipeline gating by plan tier.
6. Add spend alerts and per-user hard caps.

## Optional Enhancements
- Organization plans with pooled credits.
- Referral credits to reduce CAC.
- Enterprise SLA tier with priority models and higher limits.
