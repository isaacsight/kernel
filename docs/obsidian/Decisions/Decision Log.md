---
tags: [kernel, decisions]
updated: "2026-03-08"
---

# Decision Log

Key architectural and product decisions, with rationale.

## Billing & Pricing

| Decision | Rationale |
|----------|-----------|
| **Free-only, 10 msgs/day** (March 7) | Simplified from 3-tier system. Users are clients, not subscribers. |
| No file size limits | Removed 50MB cap — let users upload anything. Monitor storage via admin dashboard. |
| Stripe code preserved but disconnected | Backend billing code remains in case paid tiers return later |
| **Atomic rate limiting** (March 8) | `check_and_increment_message` with `FOR UPDATE` row lock. Old read-then-write allowed race conditions (13/10 messages). |
| **Client scoring includes Stripe costs** (March 8) | CA sales tax (8.75%) + Stripe fee (2.9% + $0.30) baked into pricing formula since invoices go through Stripe. |
| **Stripe invoicing from admin** (March 8) | Admin can create real Stripe invoices for clients scoring >= 70. Edge function handles customer create/find → invoice → line items → finalize → send. |

### Archived Decisions
| Decision | Rationale | Status |
|----------|-----------|--------|
| ~~Unified billing (web + CLI + API share one pool)~~ | ~~Simplifies UX~~ | Removed — no paid tiers |
| ~~Option C pricing (Free 30, Pro 1000, Max 6000)~~ | ~~~50-54% gross margin~~ | Removed |
| ~~Overage at $0.05/$0.04 per message~~ | ~~40%/25% margins~~ | Removed |

## Architecture

| Decision | Rationale |
|----------|-----------|
| Hash router (`createHashRouter`) | Required for GitHub Pages — no server-side rewrites |
| Zero Tailwind — vanilla CSS with `ka-` prefix | Full control over design system, no utility class bloat |
| Claude proxy (never direct API calls) | Central auth, rate limiting, tier gating, audit logging |
| Fail-open rate limiting | Availability > correctness; Postgres RPC errors shouldn't block users |
| OAuth implicit flow | `flowType: 'implicit'`, manual token handling before React renders |
| SW cache: `fetchOptions: { cache: 'reload' }` | Bypasses browser HTTP cache for HTML route, 30-min periodic update check |
| **Unified Files panel** (March 7) | Merged Gallery + Project Files into single "Files" tab. One panel, folders, any file type. |
| **AI file access via system prompt** (March 7) | User's file manifest injected into prompt — AI knows stored files without extra API calls |

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
| 4 bottom tabs: Home, Chats, Files, Settings | Simplified from 5 (removed separate Gallery tab) |

## Infrastructure

| Decision | Rationale |
|----------|-----------|
| Edge function deploys: always `--no-verify-jwt` | Supabase requires this for custom auth handling |
| **No file size limits** (March 7) | Removed 50MB cap on user-files bucket. Monitor via admin storage alerts. |
| Supabase `md5(random())` instead of `gen_random_bytes` | `gen_random_bytes` not in default search path on Supabase |
| Capacitor for mobile (not React Native) | Reuses existing PWA codebase, just adds native shell |
| Bundle splitting: function-form manualChunks | Extracted vendor-i18n + vendor-zustand, main 106KB → 17KB gzip |
| **Admin storage monitoring** (March 7) | Warning banner at 80GB+ per user, per-user storage/file count in user detail |
| **Admin agent — command-driven** (March 8) | Admin agent only acts on explicit commands, never autonomously. MCP server with 7 tools. |
| **Admin file sends to Inbox** (March 8) | Files sent by admin land in a system "Inbox" folder in the target user's account via service role bypass. |
