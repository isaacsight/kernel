---
tags: [kernel, decisions]
updated: "2026-03-06"
---

# Decision Log

Key architectural and product decisions, with rationale.

## Billing & Pricing

| Decision | Rationale |
|----------|-----------|
| Unified billing (web + CLI + API share one pool) | Simplifies UX, prevents gaming, single Stripe subscription |
| Option C pricing (Free 30, Pro 1000, Max 6000) | ~50-54% gross margin at 60% utilization, competitive with Claude Pro |
| Overage at $0.05/$0.04 per message | 40%/25% margins on overage (was at-cost $0.03 before) |
| `subscriptions` as source of truth (not `api_keys.tier`) | API keys become thin auth tokens, tier always derived from subscription |
| Delta overage reporting | `last_reported_overage_count` prevents double-billing to Stripe |

## Architecture

| Decision | Rationale |
|----------|-----------|
| Hash router (`createHashRouter`) | Required for GitHub Pages — no server-side rewrites |
| Zero Tailwind — vanilla CSS with `ka-` prefix | Full control over design system, no utility class bloat |
| Claude proxy (never direct API calls) | Central auth, rate limiting, tier gating, audit logging |
| Fail-open rate limiting | Availability > correctness for rate limits; Postgres RPC errors shouldn't block users |
| OAuth implicit flow | `flowType: 'implicit'`, manual token handling before React renders |
| SW cache: `fetchOptions: { cache: 'reload' }` | Bypasses browser HTTP cache for HTML route, 30-min periodic update check |

## Memory

| Decision | Rationale |
|----------|-----------|
| Warmth-based decay (exponential half-life) | Items fade naturally unless reinforced — prevents stale profile clutter |
| Relevance filtering (Jaccard similarity) | Never dump all memory — only inject contextually relevant items |
| Haiku for extraction, Sonnet for convergence | Cost optimization: extraction is high-volume, convergence is high-quality |
| Knowledge graph promotion at 0.7+ confidence, 3+ mentions | Prevents noise from single-mention entities |

## Design

| Decision | Rationale |
|----------|-----------|
| EB Garamond (prose) + Courier Prime (meta) | Literary-minimalist aesthetic, never corporate |
| Dark mode: warm brown undertones | "Lamplight reading" principle — cozy, not cold |
| Primary accent: `#6B5B95` (amethyst) | Was indigo `#6366F1`, amethyst feels warmer and more distinctive |
| Bottom-sheet pattern for all panels | iOS-native feel, touch-first, consistent across all info panels |

## Infrastructure

| Decision | Rationale |
|----------|-----------|
| Edge function deploys: always `--no-verify-jwt` | Supabase requires this for custom auth handling |
| Upload limits: flat 50MB everywhere | No free/pro split on file size — just gate access to file analysis |
| Supabase `md5(random())` instead of `gen_random_bytes` | `gen_random_bytes` not in default search path on Supabase |
| Capacitor for mobile (not React Native) | Reuses existing PWA codebase, just adds native shell |
| Bundle splitting: function-form manualChunks | Extracted vendor-i18n + vendor-zustand, main 106KB → 17KB gzip |
