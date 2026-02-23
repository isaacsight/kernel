# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-23, later)

### Accomplished This Session

#### Conversation Search — Polish & Enhance
- **DB migration** (`024_search_index.sql`): `pg_trgm` extension + GIN trigram indexes on `messages.content` and `conversations.title` for fast `.ilike()` substring matching
- **Server-side title search**: `executeSearch` now queries both `messages` and `conversations` tables in parallel, title matches ranked first
- **Highlight matching text**: `highlightMatch` helper wraps matched substrings in `<mark>` tags for titles and snippets
- **Result count**: Shows "N results" / "No results" below search input when a search is active
- **Clear button**: X icon inside search input to clear query
- **i18n**: Added `conversations.noResults` and `conversations.resultCount` to `common.json`
- **CSS**: `.conv-search-clear`, `.conv-search-count`, `mark` highlight styles (amethyst tint light, warm gold dark)
- Migration applied via Supabase MCP, deployed to kernel.chat
- Committed `2aa9ed36`, pushed to origin/main

---

## Previous Session (2026-02-23, earlier)

### Accomplished

#### Backend Hardening — Durable Rate Limits, Audit Trail, Input Validation
- **DB migration** (`023_hardening.sql`): `rate_limits` table (Postgres fixed-window counters), `audit_events` table (structured event log), 5 RPCs (`check_rate_limit`, `log_audit_event`, `cleanup_rate_limits`, `cleanup_audit_events`, `get_usage_summary`)
- **3 shared utilities** in `supabase/functions/_shared/`: `rate-limit.ts` (fail-open Postgres RPC), `audit.ts` (fire-and-forget logging), `validate.ts` (content-type, body size, SSRF blocklist, field validation)
- **9 functions fully overhauled** (rate limit + audit + validation): claude-proxy, web-search, url-fetch, mcp-proxy, evaluate-chat, extract-insights, import-conversation, transcribe, shared-conversation
- **10 functions audit + validation only**: stripe-webhook, create-checkout, create-portal, delete-account, send-announcement, send-inquiry-email, notify-webhook, send-notification, task-scheduler
- **SSRF fix**: mcp-proxy was vulnerable (only blocked `localhost` string) — now uses consolidated blocklist covering all private/reserved ranges
- **3-tier rate limits**: free/paid/pro with per-endpoint configs (e.g. claude-proxy: 10/60/120 req/min)
- **task-scheduler**: now calls `cleanup_rate_limits()` and `cleanup_audit_events(90)` on every cron run
- All 19 edge functions deployed, migration applied via Supabase MCP tool
- Committed `46f02797`, pushed to origin/main

#### Pro Usage Dashboard
- **Edge function**: `usage-dashboard/index.ts` — GET endpoint, JWT + Pro-only (403 for free), calls `get_usage_summary` RPC
- **Hook**: `useUsageDashboard.ts` — 5-minute cache, fetch/refresh pattern
- **Component**: `UsageDashboard.tsx` — bottom sheet with metrics grid, token breakdown, top agents, daily sparkline, recent activity feed
- **Wired into UI**: MoreMenu → "Usage" (Pro only), usePanelManager (showUsagePanel state), EnginePage (lazy-loaded panel)
- **CSS**: ~200 lines `.usage-*` classes, dark mode, mobile responsive
- **i18n**: Added `menu.usage` key to home.json

#### Entity System — 32-bit Upgrade
- Pixel creature upgraded from 16-bit to 32-bit aesthetic (richer gradients, anti-aliased outline ring, deeper shadows)
- Cursor-following eye tracking (clamped to 2px offset, mobile defaults to center-bottom)
- Weighted tap reactions: happy bounce (55%), excited hop (20%), shy wobble (15%), sleepy blink (10%)
- Anime-style blush pixels for happy/excited/content moods
- Committed `03a4b3b1`

#### Canvas Particle Performance
- Fixed `PixelEntityCanvas.tsx` — `particles` ref was undefined (should be `pool` + `activeCount`)
- Upgraded to zero-allocation particle update with in-place pool compaction
- Split draw passes (particles → glow) with `lighter` composite for additive halos
- Committed `6823af98` (fix) + `594a6003` (perf)

---

## Previous Session (2026-02-22, late)

### Accomplished

#### Dark Mode Header Fix
- Burger menu and header icon buttons invisible in dark mode — added `[data-theme="dark"]` override
- Committed `25775e83`, deployed to kernel.chat

---

## Previous Session (2026-02-22, earlier)

### Accomplished
- ChatGPT conversation import (link-only, edge function, DB migration, session fix, error surfacing)
- 16-bit garden creature upgrade (shape redesign, gradient fills, eye sparkles, smooth animations)
- Entity evolution system P15 (pixelGrids, useEntityEvolution, PixelEntity, 5 tiers, 6 topics)

---

## Previous Sessions (2026-02-17 to 2026-02-20)

### Accomplished
- P12–P14: Design overhaul, visual identity, CSS token system
- P11: Mobile UI/UX audit & fixes
- P8–P10: Writing audit, usage cost tracking, auto model selection
- P1–P7: Dark mode, test suite, panels, i18n, artifact system, agent audit, Discord bot, Stripe

---

## Ongoing Backlog

- **P1–P15**: All DONE
- **Backend hardening**: DONE (rate limits, audit trail, input validation, SSRF fix)
- **Pro usage dashboard**: DONE
- **ChatGPT import**: DONE
- **Conversation search polish**: DONE (trigram indexes, server-side title search, highlights, result count, clear button)
- **Next candidates**: Onboarding flow redesign, animation token system
- **Known limitations**: Claude/Gemini share links don't work (CSR — no server-side content)

## Key Decisions Made

- Rate limits: Postgres fixed-window counters with atomic upsert, fail-open semantics (never blocks on RPC error)
- Audit logging: fire-and-forget (catches all errors internally, never breaks user requests)
- SSRF blocklist: 10 regex patterns covering localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, link-local, IPv6 private
- All RPCs: SECURITY DEFINER with privileges revoked from public/authenticated/anon
- Pro rate limits: 2x free tier for subscribed users (claude-proxy 120/min, web-search 20/min, etc.)
- Usage dashboard: accessible from MoreMenu, Pro-only, 5-minute client cache
- Entity: 32-bit aesthetic with outline ring, gradient fills, cursor-tracking eyes
- Canvas particles: zero-alloc pool compaction, split update/draw/glow passes
- ChatGPT import uses `/backend-api/share/{id}` JSON endpoint (public, no auth needed)
- Entity evolution score: log2-based, 3 signals (conversations 40%, KG 35%, goals 25%)
- Bottom-sheet pattern for all panels
- Dark mode: warm brown undertones, never cool gray — "lamplight reading" principle
- Zero Tailwind — all vanilla CSS with `ka-` prefix and Rubin design tokens
- Edge function deploys: ALWAYS use `--no-verify-jwt` flag
- Conversation search: trigram GIN indexes for `.ilike()`, parallel title+message queries, `<mark>` highlight, no full-text search needed at current scale
