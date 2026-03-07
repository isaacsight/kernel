---
tags: [kernel, guide, deployment]
updated: "2026-03-06"
---

# Deployment Guide

## Frontend (GitHub Pages)

```bash
npm run deploy
# Runs: tsc && vite build && gh-pages -d dist
```

- Deploys `dist/` to GitHub Pages
- Custom domain: kernel.chat
- Base path: `/`
- CNAME configured in repo settings

## Edge Functions

Deploy individually:

```bash
# Core
npx supabase functions deploy claude-proxy --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
npx supabase functions deploy kernel-api --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
npx supabase functions deploy stripe-webhook --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
npx supabase functions deploy task-scheduler --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

# Billing
npx supabase functions deploy create-checkout --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
npx supabase functions deploy create-portal --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
npx supabase functions deploy api-keys --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
```

## Database Migrations

```bash
# Apply a migration
npx supabase migration repair --status applied "074" --linked

# Or apply via SQL editor in Supabase Dashboard
```

## Secrets

```bash
npx supabase secrets set KEY=VALUE --project-ref eoxxpyixdieprsxlpwcs
```

Current secrets needed:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`
- `STRIPE_MAX_MONTHLY_PRICE_ID`, `STRIPE_MAX_ANNUAL_PRICE_ID`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY` (email)
- `SUPABASE_SERVICE_ROLE_KEY`

## Ship Pipeline

The `/ship` slash command runs a 6-gate deploy:

1. Security audit
2. QA pass (type check + build + screenshots)
3. Design check (Rubin compliance)
4. Performance audit (bundle budgets)
5. Deploy
6. Verify (health check)

Bundle budgets: Main JS < 300KB gzip, CSS < 150KB gzip.
Current: JS ~93KB gzip, CSS ~37KB gzip.
