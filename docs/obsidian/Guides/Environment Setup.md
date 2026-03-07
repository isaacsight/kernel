---
tags: [kernel, guide, environment]
updated: "2026-03-06"
---

# Environment Setup

## Required Environment Variables

### Frontend (`.env`)

```
VITE_SUPABASE_URL=https://eoxxpyixdieprsxlpwcs.supabase.co
VITE_SUPABASE_KEY=<anon key>
VITE_STRIPE_PUBLISHABLE_KEY=<stripe pk_live_...>
```

### Edge Functions (Supabase Secrets)

```
SUPABASE_SERVICE_ROLE_KEY=<service role key>
ANTHROPIC_API_KEY=<claude api key>
STRIPE_SECRET_KEY=<stripe sk_live_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>
STRIPE_MONTHLY_PRICE_ID=price_1T8BgbIWIar0uqwKYgxrKJON
STRIPE_ANNUAL_PRICE_ID=price_1T8BgbIWIar0uqwKY2GSoOIG
STRIPE_MAX_MONTHLY_PRICE_ID=price_1T8BgcIWIar0uqwKmb7yMJDM
STRIPE_MAX_ANNUAL_PRICE_ID=price_1T8BgcIWIar0uqwKPrCMDNjb
RESEND_API_KEY=<resend key>
```

### MCP Servers (local `.env`)

```
SUPABASE_SERVICE_KEY=<same as service role key>
OBSIDIAN_VAULT_PATH=/Users/isaachernandez/Desktop/kernel.chat/kernelchat
```

## Supabase Project

- **Project ref:** `eoxxpyixdieprsxlpwcs`
- **Region:** (check dashboard)
- **Auth:** Email + Google + GitHub OAuth

## Stripe

- **Mode:** Live
- **Billing meters:** `kernel_pro_overage`, `kernel_max_overage`
- **Webhook endpoint:** `https://eoxxpyixdieprsxlpwcs.supabase.co/functions/v1/stripe-webhook`
- **Events:** checkout.session.completed, invoice.paid, customer.subscription.updated, customer.subscription.deleted
