---
tags: [kernel, billing, architecture]
updated: "2026-03-06"
---

# Unified Billing System

One subscription covers all three surfaces: kernel.chat (web), K:BOT (CLI), and the REST API. All share a single message pool tracked in `user_memory.monthly_message_count`.

## Option C Pricing (Current)

| Tier | Price | Messages/mo | Overage | Rate Limit | Agents |
|------|-------|-------------|---------|------------|--------|
| Free | $0 | 30 | Hard cap | 10/min | 5 core |
| Pro | $39/mo | 1,000 | $0.05/msg | 60/min | All 17 |
| Max | $249/mo | 6,000 | $0.04/msg | 180/min | All 17 + swarm |

**Annual pricing:** Pro $390/yr (~$32.50/mo), Max $2,490/yr (~$207.50/mo)

## How It Works

### Message Counting
Both `claude-proxy` (web) and `kernel-api` (CLI/API) call the same RPCs:
- `increment_message_count` — daily counter
- `increment_monthly_message_count` — monthly counter
- `increment_web_overage` — checks quota, increments `subscriptions.overage_count` if exceeded

### Tier Resolution
- **Web:** `subscriptions` table queried directly
- **API/CLI:** `validate_api_key()` RPC joins `api_keys` + `subscriptions` + `user_memory` to resolve tier from the user's subscription (not from the key itself)

### Overage Billing
1. User exceeds monthly quota
2. `increment_web_overage()` increments `subscriptions.overage_count`
3. `task-scheduler` (runs every 5 min) reports overage deltas to Stripe billing meters
4. Stripe adds overage charges to next invoice

### Stripe Resources

| Resource | ID |
|----------|-----|
| Pro Monthly Price | `price_1T8BgbIWIar0uqwKYgxrKJON` |
| Pro Annual Price | `price_1T8BgbIWIar0uqwKY2GSoOIG` |
| Max Monthly Price | `price_1T8BgcIWIar0uqwKmb7yMJDM` |
| Max Annual Price | `price_1T8BgcIWIar0uqwKPrCMDNjb` |
| Pro Overage Price | `price_1T8BgcIWIar0uqwKdkFeP0sQ` |
| Max Overage Price | `price_1T8BgdIWIar0uqwKwjr04DCO` |
| Pro Meter | `mtr_61UHZdvn29278h10c41IWIar0uqwKISu` |
| Max Meter | `mtr_61UHZdvIB3CU0YdfN41IWIar0uqwKRhg` |
| Meter Event (Pro) | `kernel_pro_overage` |
| Meter Event (Max) | `kernel_max_overage` |

### Margin Analysis

| | Cost/msg | Price/msg | Margin |
|---|---------|-----------|--------|
| Base (included) | ~$0.03 | $0.039 (Pro) / $0.042 (Max) | ~23-29% |
| Pro overage | ~$0.03 | $0.05 | ~40% |
| Max overage | ~$0.03 | $0.04 | ~25% |

Blended cost ~$0.03/msg assumes: Haiku routing ($0.001) + Sonnet response ($0.025) + memory/convergence amortized ($0.004).

### Key Files

| File | Role |
|------|------|
| `supabase/migrations/074_unified_billing.sql` | validate_api_key + increment_web_overage RPCs |
| `supabase/functions/_shared/plan-limits.ts` | Backend limit constants |
| `src/config/planLimits.ts` | Frontend limit constants |
| `supabase/functions/stripe-webhook/index.ts` | Subscription lifecycle events |
| `supabase/functions/task-scheduler/index.ts` | Overage reporting to Stripe meters |
| `supabase/functions/create-checkout/index.ts` | Stripe checkout session creation |

### Cancel Protection
When `customer.subscription.deleted` fires, webhook sets:
- `status: 'canceled'`
- `overage_enabled: false`
- `overage_count: 0`
