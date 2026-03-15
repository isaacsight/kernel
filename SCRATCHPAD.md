# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-03-14)

### Accomplished This Session

#### Billing Hardening — Overage Removed Entirely
- **Overage bypass vulnerability fixed** — removed `skipAtomicDaily`, `webOverageEnabled`, `webSpendingCeilingHit` from claude-proxy
- **All users hard-capped** — Free at 10/month, Pro at 200/month, no exceptions
- **Atomic enforcement** — ALL users go through `check_and_increment_message` RPC (race-condition safe)
- **Migration 084** — disabled `overage_enabled` on all existing DB subscriptions
- **Frontend cleanup** — removed OveragePrompt component, localStorage bypass (`kernel_overage_accepted`), dead overage rendering in EnginePage
- **Stripe webhook fixes** — `cancel_at_period_end` no longer immediately downgrades, `invoice.payment_failed` handler added, `invoice.paid` renewal handler
- **Settings panel** — dynamic plan display with upgrade/manage buttons
- **Full billing audit** — backend, config, webhook, frontend all PASS
- **Claude-proxy deployed** — clean enforcement live in production
- **Obsidian vault updated** — Status and Billing docs brought current

#### Commits This Session
- `c056054f` — fix: remove overage billing, hard-cap Pro at 200 messages/month
- `5309984d` — fix: handle payment failures and cancel-at-period-end correctly
- `9dc8136b` — feat: dynamic subscription panel and overage indicator in chat UI
- `e2daca62` — feat: real-time overage reporting to Stripe from claude-proxy
- `ddadd459` — feat: add metered overage line item to checkout and billing meter setup

### Previous Session (2026-03-13)

#### K:BOT v2.13.1 Published
- **6 new feature modules**: test runner, watch mode, voice mode, export, plugin marketplace, rate limiter
- **Streaming hardening**: retry with exponential backoff (1s/2s/4s) for 429/5xx errors
- **Smarter context management**: priority scoring preserves high-value turns during compaction
- **80 tests across 6 files** (vitest)
- **Rebrand**: "Antigravity Group" → "kernel.chat group" across entire codebase
- **Rename**: `kbot ollama` → `kbot local` (with backwards-compatible alias)
- **Published**: v2.13.1 to npm, pushed to GitHub
- **5 core modules**: repo map, provider fallback, self-eval, memory tools, task ledger
- **37 specialist agents**, i18n for 24 languages

### Pending
- **Launch posts** — drafts ready in `tools/launch-drafts.md`, update to reflect `kbot local` naming
- **iOS Capacitor sync** — need CocoaPods then `npx cap sync ios`
- **Frontend cleanup** — remove dead overage CSS from index.css, update Terms & Privacy pages
- **awesome-openclaw-skills PR** — blocked until skill gains traction on ClawHub

## Key Decisions
- **Repo identity**: K:BOT is the primary product. kernel.chat web app is the "companion."
- **Billing**: 2-tier only. Free (10/month), Pro ($15/month, 200/month). NO overage. Hard cap.
- **Profit margin**: ~$11/Pro user/month (~73%). Most users won't hit 200, so real-world ~80%+.
- **8th-grade copy**: All user-facing text written simply, no jargon.
- **Zero Tailwind**: All vanilla CSS with `ka-` prefix.
- **Edge function deploys**: ALWAYS use `--no-verify-jwt` flag.

## K:BOT Current State
- **npm version**: 2.13.1 (`@kernel.chat/kbot`)
- **Specialists**: 39 agents
- **Tools**: 167
- **Providers**: 19
- **Downloads**: ~1,100+ lifetime (9 days since first publish)

## Test Accounts
- **Free**: `kernel-test-bot@antigravitygroup.co` / `KernelTest2026!`
- **Pro**: `kernel-pro-test@antigravitygroup.co` / `KernelProTest2026`
