# Quinthesis Deployment Guide

**Author:** Claude (Opus 4.5)
**Date:** January 3, 2026
**Purpose:** Infrastructure setup for rebrand from AI Council to Quinthesis

---

## Overview

This guide covers the infrastructure changes needed to complete the rebrand:
1. Fly.io backend (new app)
2. Vercel frontend (rename/reconfigure)
3. OAuth apps (update redirect URIs)
4. Stripe webhook (new endpoint)
5. GitHub repository (optional rename)

---

## 1. Fly.io Backend

### Create New App

```bash
fly apps create quinthesis-api
```

### Set Secrets

Copy secrets from the old app. Run each command with your actual values:

```bash
fly secrets set DATABASE_URL="your-supabase-connection-string" -a quinthesis-api
fly secrets set JWT_SECRET="your-jwt-secret" -a quinthesis-api
fly secrets set API_KEY_ENCRYPTION_KEY="your-fernet-key" -a quinthesis-api
fly secrets set GOOGLE_CLIENT_ID="your-google-client-id" -a quinthesis-api
fly secrets set GOOGLE_CLIENT_SECRET="your-google-client-secret" -a quinthesis-api
fly secrets set GITHUB_CLIENT_ID="your-github-client-id" -a quinthesis-api
fly secrets set GITHUB_CLIENT_SECRET="your-github-client-secret" -a quinthesis-api
fly secrets set OAUTH_REDIRECT_BASE="https://quinthesis.vercel.app" -a quinthesis-api
fly secrets set CORS_ORIGINS="https://quinthesis.vercel.app" -a quinthesis-api
fly secrets set STRIPE_SECRET_KEY="your-stripe-secret" -a quinthesis-api
fly secrets set STRIPE_WEBHOOK_SECRET="your-new-webhook-secret" -a quinthesis-api
fly secrets set OPENROUTER_PROVISIONING_KEY="your-openrouter-key" -a quinthesis-api
fly secrets set SENTRY_DSN="your-sentry-dsn" -a quinthesis-api
```

Or all at once:

```bash
fly secrets set \
  DATABASE_URL="" \
  JWT_SECRET="" \
  API_KEY_ENCRYPTION_KEY="" \
  GOOGLE_CLIENT_ID="" \
  GOOGLE_CLIENT_SECRET="" \
  GITHUB_CLIENT_ID="" \
  GITHUB_CLIENT_SECRET="" \
  OAUTH_REDIRECT_BASE="https://quinthesis.vercel.app" \
  CORS_ORIGINS="https://quinthesis.vercel.app" \
  STRIPE_SECRET_KEY="" \
  STRIPE_WEBHOOK_SECRET="" \
  OPENROUTER_PROVISIONING_KEY="" \
  SENTRY_DSN="" \
  -a quinthesis-api
```

### Deploy

```bash
fly deploy -a quinthesis-api
```

### Verify

```bash
fly status -a quinthesis-api
curl https://quinthesis-api.fly.dev/
```

---

## 2. Vercel Frontend

### Option A: Rename Existing Project (Recommended)

1. Go to Vercel Dashboard
2. Select your project
3. Settings → General → Project Name
4. Change to "quinthesis"

### Option B: Create New Project

```bash
cd frontend
vercel link
```

### Environment Variables

Set in Vercel Dashboard (Settings → Environment Variables):

| Variable | Value |
|----------|-------|
| `VITE_API_BASE` | `https://quinthesis-api.fly.dev` |
| `VITE_SENTRY_DSN` | Your frontend Sentry DSN |

### Deploy

```bash
cd frontend
vercel --prod
```

---

## 3. OAuth Apps

### Google Cloud Console

URL: https://console.cloud.google.com/apis/credentials

1. Select your OAuth 2.0 Client ID
2. Under "Authorized redirect URIs", add:
   ```
   https://quinthesis.vercel.app/auth/callback/google
   ```
3. (Optional) Remove old URI after verification

### GitHub Developer Settings

URL: https://github.com/settings/developers

1. Select your OAuth App
2. Update "Authorization callback URL":
   ```
   https://quinthesis.vercel.app/auth/callback/github
   ```
3. Save changes

---

## 4. Stripe Webhook

URL: https://dashboard.stripe.com/webhooks

### Add New Endpoint

1. Click "Add endpoint"
2. Endpoint URL: `https://quinthesis-api.fly.dev/api/webhooks/stripe`
3. Select events: `checkout.session.completed`
4. Click "Add endpoint"

### Update Secret

1. Click on the new endpoint
2. Reveal the signing secret
3. Update Fly.io:
   ```bash
   fly secrets set STRIPE_WEBHOOK_SECRET="whsec_new_secret_here" -a quinthesis-api
   ```

### Test with Stripe CLI

```bash
stripe listen --forward-to https://quinthesis-api.fly.dev/api/webhooks/stripe
```

---

## 5. GitHub Repository (Optional)

### Rename Repository

1. Go to repository Settings
2. Under "General", change "Repository name" to `quinthesis`
3. GitHub will set up redirects from old URL

### Update Git Remote (if renamed)

```bash
git remote set-url origin https://github.com/anbuneel/quinthesis.git
```

---

## 6. Verification Checklist

### Backend

```bash
# Health check
curl https://quinthesis-api.fly.dev/

# Should return: {"status":"ok"}
```

### Frontend

1. Visit https://quinthesis.vercel.app
2. Verify page loads with "Quinthesis" branding

### OAuth

1. Click "Continue with Google" → Should redirect and return
2. Click "Continue with GitHub" → Should redirect and return

### Stripe

1. Go to Account page
2. Click a deposit option
3. Complete test payment with card `4242 4242 4242 4242`
4. Verify balance updates

### Full Flow

1. Sign in
2. Submit a test query
3. Verify all 3 stages complete
4. Check usage history shows the query

---

## 7. Cleanup (After Verification)

Once everything is working:

```bash
# Delete old Fly.io app
fly apps destroy ai-council-api

# Remove old OAuth redirect URIs from Google/GitHub

# Delete old Stripe webhook endpoint
```

---

## Troubleshooting

### CORS Errors

Ensure `CORS_ORIGINS` includes the exact frontend URL:
```bash
fly secrets set CORS_ORIGINS="https://quinthesis.vercel.app" -a quinthesis-api
```

### OAuth Redirect Mismatch

Ensure `OAUTH_REDIRECT_BASE` matches the frontend URL exactly:
```bash
fly secrets set OAUTH_REDIRECT_BASE="https://quinthesis.vercel.app" -a quinthesis-api
```

### Stripe Webhook Failures

Check webhook logs in Stripe Dashboard. Common issues:
- Wrong signing secret
- Endpoint URL typo
- App not deployed yet

---

*Guide prepared for Quinthesis deployment, January 2026*
