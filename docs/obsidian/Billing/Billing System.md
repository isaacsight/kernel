---
tags: [kernel, billing, architecture]
updated: "2026-03-08"
---

# Billing System

## Current State (March 8, 2026)

**All paid tiers have been removed.** The platform is free-only with 10 messages per day for all users.

### What Changed
- `PlanId` type narrowed from `'free' | 'pro' | 'max'` to just `'free'`
- `resolvePlanId()` always returns `'free'`
- `useAuth.ts` — subscription checks always return `false`
- `useBilling.ts` — `handleUpgrade` is a no-op
- Pricing page route removed from router
- Account settings shows "Free — 10 messages per day" (no upgrade buttons)
- Landing page pricing cards removed
- UpgradePrompt shows "Come back tomorrow" instead of payment buttons

### Key Files

| File | Role |
|------|------|
| `src/config/planLimits.ts` | Single `free` tier: 10 msgs/day, 4096 max_tokens |
| `src/hooks/useAuth.ts` | `planId` always `'free'`, `isSubscribed` always `false` |
| `src/components/UpgradePrompt.tsx` | "Used your 10 messages today" message |
| `src/components/AccountSettingsPanel.tsx` | Shows Free plan, no billing UI |

### Rate Limiting (March 8 Fix)
A race condition allowed users to exceed the 10 msg/day limit. Fixed with atomic `check_and_increment_message` RPC:
- Migration `078_atomic_message_limit.sql`: `SELECT ... FOR UPDATE` row lock prevents concurrent reads
- RPC returns `{allowed: bool, daily_count: int, resets_at: text}`
- Client-side guard in `useChatEngine.ts` as defense-in-depth
- `claude-proxy` uses atomic check for non-overage users

### Backend (Still Exists, Not Exposed)
The Stripe integration code remains in the codebase but is disconnected from the UI:
- `supabase/functions/create-checkout/` — Stripe checkout sessions
- `supabase/functions/stripe-webhook/` — Payment lifecycle events
- `subscriptions` table — Still exists in DB
- Stripe products/prices/meters — Still configured in Stripe dashboard

This code is preserved in case paid tiers are re-introduced later.

## Client Scoring & Invoicing (March 8)

Kernel scores client engagement via `kernel.hat` command. High-scoring clients can be invoiced via Stripe.

### Pricing Formula
```
base ($2,500) + score × $75
  × market multiplier (1.0–1.8)
  × relevance multiplier (1.0–1.5)
  × R&D multiplier (1.0–1.3)
  × web research multiplier (0.9–1.3)
  + tier surcharge (0–40%)
  = subtotal
  + CA sales tax (8.75%)
  + Stripe processing fee (2.9% + $0.30)
  = invoice total
```

Billing threshold: score must be >= 70/100 to invoice.

### Stripe Invoice Flow
1. Find or create Stripe customer by email
2. Create **draft** invoice with 30-day payment terms (`auto_advance: false`)
3. Add project work line item (subtotal amount)
4. Add tax line item (CA 8.75%)
5. Return draft — admin reviews in Stripe dashboard and manually sends

### Key Files
| File | Role |
|------|------|
| `src/engine/clientScoring.ts` | Score calculation + pricing formula |
| `supabase/functions/admin-invoice/index.ts` | Stripe invoice creation edge function |
| `src/pages/AdminPage.tsx` | Admin UI with pricing display + "Invoice via Stripe" button |

## Previous Pricing (Archived)

| Tier | Price | Messages/mo | Overage |
|------|-------|-------------|---------|
| Free | $0 | 30 | Hard cap |
| Pro | $39/mo | 1,000 | $0.05/msg |
| Max | $249/mo | 6,000 | $0.04/msg |
