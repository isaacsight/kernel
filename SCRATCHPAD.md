# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-25, latest)

### Accomplished This Session

#### Pro Features — E2E Testing & Bug Fixes
Built and tested 6 Pro features (Thinking Mode, Vision, Voice Loop, Document Analysis, Agentic Workflows, Proactive Briefings v2), then ran full E2E verification. Found and fixed 3 critical bugs:

**Bug 1 — Pro users blocked from document/image analysis** (`claude-proxy/index.ts`):
- Document and image limit checks were OUTSIDE the `isFreeUser` block (ended at line 1210, checks at 1212-1243), so they ran for ALL users including Pro, returning `document_analysis_pro_only` 403.
- Fix: Wrapped the entire document/image check block inside `if (isFreeUser) { ... }`.

**Bug 2 — File content lost when routed through swarm/workflow** (`useChatEngine.ts`):
- When files attached (PDFs/images as `ContentBlock[]`), the classifier could route to swarm/workflow/research paths that only accept `string` content, stripping the base64 data.
- Fix: Added `const hasFileContent = Array.isArray(userContent)` guard. All non-direct paths gated with `!hasFileContent &&`.

**Bug 3 — AgenticWorkflow url_fetch receives descriptions instead of URLs** (`AgenticWorkflow.ts`):
- Planner generated `{ tool: 'url_fetch', input: 'Fetch detailed information...' }` — descriptions, not URLs. Working memory (containing search results with URLs) was only enriched for `analyze`/`draft` tools.
- Fix: (1) Changed enrichment to apply to all non-`web_search` tools. (2) Added URL regex extraction in the `url_fetch` handler.

Commits: `a35819b1d` — all three fixes.

#### Tier Features & Web Search for Free Users
- **Web search enabled for free users**: Removed `payload.web_search = false` from the free-user block in `claude-proxy`.
- **Updated all 24 locale `auth.json` files** with correct tier features:
  - Free: "20 messages per day" (was "10 messages to start"), web search, all specialists, file creation
  - Pro: "Extended thinking" (was "Deep research"), "Document & image analysis" (was "Multi-agent collaboration"), "Voice loop & agentic workflows" (was "Persistent memory")
- **Updated `home.json`** upgrade wall features to match.
- Commit: `917ea2def`

#### i18n Cache Busting
- **`vite.config.ts`**: Added `__BUILD_TIME__` define constant (`Date.now().toString(36)`)
- **`src/i18n.ts`**: Added `queryStringParams: { v: __BUILD_TIME__ }` to i18next-http-backend config
- Each build generates a unique cache-busting query param, preventing stale locale files from PWA service worker or browser cache.
- Commit: `063895a16`

#### Full E2E Verification (Playwright)
**Free account** (`kernel-test-bot@antigravitygroup.co`):
- No PRO badge, no thinking toggle, message counter visible (12 remaining) — PASS
- Web search works (sent "What happened in the news today?" — got real news with sources) — PASS

**Pro account** (`kernel-pro-test@antigravitygroup.co`):
- PRO badge visible, thinking toggle present, no message counter — PASS
- Extended thinking: "Thought for 9s" + "Thought for 8s" blocks appeared — PASS
- Document analysis: PDF uploaded, all 3 key points extracted, no 403 — PASS
- Agentic workflows: 6/6 steps complete, full research report with sources (Toyota/QuantumScape/Samsung SDI comparison) — PASS
- Voice button enabled — PASS
- Convergence engine running ("Produced 3 insights") — PASS

**Landing page**: Correct tier features confirmed on live site.

#### Ship Pipeline — Full 6-Gate Pass
`063895a16` shipped to kernel.chat:
- **Gate 1 — Security: PASS** — No secrets, 0 prod vulns, edge auth verified
- **Gate 2 — QA: PASS** — 0 type errors, clean build (1072 modules, 2.21s)
- **Gate 3 — Design: PASS** — No new Rubin violations, data-only changes
- **Gate 4 — Performance: PASS** — JS 93KB gzip (31% budget), CSS 37KB gzip (25% budget)
- **Gate 5 — DevOps: PASS** — Deployed, HTTP 200 (303ms), uptime green
- **Gate 6 — Product: PASS** — Landing, auth, home, mobile 375x812 all verified

#### Email Announcement
- Sent product update email to all 32 registered users via Resend
- E-ink styled design: Courier Prime headers, EB Garamond body, ivory/amethyst palette, table layout for Pro features
- Subject: "What's New: Smarter Pro Features & Free Web Search"

#### Discord Webhook
- Added `DISCORD_WEBHOOK_URL` to `.env` for ship pipeline notifications

---

## Previous Session (2026-02-24)

### Accomplished

#### Full System Debug Audit — 27 Bugs Found & Fixed
Deep diagnostic sweep across entire codebase (3 parallel agents: runtime errors, edge functions, React hooks). All issues fixed, committed, and deployed.

**Critical fixes (7):** EnginePage Rules of Hooks, useChatEngine stale closures (messages, isThinking, classifyIntent), claude-proxy free-tier model bypass, task-scheduler auth bypass, identity-recovery uniqueness bypass.

**Medium fixes (11):** Engine subscription leak, unbound err, scroll tracking, send-notification no-op, send-inquiry-email false success, import-conversation size limit, create-portal response body, delete-account premature audit, SSRF DNS rebinding, send-announcement pagination.

**Low fixes (9):** MessageContent stable refs, useProviderHealth shadow, file attachment keys, useWebPush guard, useReliabilityDashboard deps, useCompanionMood deps, useAccountSettings cancelled guards, useAuth mountedRef, CORS localhost restriction.

Commits: `af49f1837`, `502d5b3aa`, `479d58c00`

#### Privacy Policy, Terms of Service & User Agreement Flow
PrivacyPage.tsx, TermsPage.tsx, router routes, LoginGate legal text, auth.json i18n, .ka-legal-page CSS. Mirror seeded for 10 users. Commit: `e35906010`

#### Convergence — Multi-Agent Perception Synthesis
Convergence.ts (6 facet lenses), migration 033, SupabaseClient mirror methods, useChatEngine mirror integration. Commit: `36fa92481`

#### Free-Tier Daily Message Limit
Migrations 025-027 (protect trigger, daily count, 24h rolling window), claude-proxy JSONB response, FreeLimitError.resetsAt, upgrade wall reset time display, in-app + push notifications. Commits: `21832166`, `9b3cf8f4`, `78c23e82`, `d307b5d7`

#### Unified 50MB Upload Limit + Claude Proxy Fix
Flat 50MB everywhere (chat, avatars, transcription). Claude proxy payload limits raised from 32KB/256KB to 50MB. Commits: `b97a7186`, `6c60cd94`, `71a1fbfa`

---

## Previous Sessions (2026-02-17 to 2026-02-23)

### Accomplished
- Account settings panel (profile, email, password, linked accounts, avatar upload, re-auth)
- Onboarding redesign (single-screen ParticleGrid + input)
- Set new password flow (PASSWORD_RECOVERY detection, modal)
- Conversation search polish (trigram indexes, highlights, result count)
- Backend hardening (rate limits, audit trail, input validation, SSRF fix)
- Pro usage dashboard
- Entity system 32-bit upgrade + canvas particle performance
- ChatGPT conversation import
- P12-P14: Design overhaul, visual identity, CSS token system
- P11: Mobile UI/UX audit & fixes
- P8-P10: Writing audit, usage cost tracking, auto model selection
- P1-P7: Dark mode, test suite, panels, i18n, artifact system, agent audit, Discord bot, Stripe

---

## Ongoing Backlog

- **All prior work items**: DONE (P1-P15, backend hardening, account settings, legal, convergence, free-tier limits, upload limits, Pro features)
- **Pro features**: DONE (thinking mode, vision, voice loop, document analysis, agentic workflows, proactive briefings)
- **Tier copy alignment**: DONE (24 locales updated, landing page matches reality)
- **Web search for free users**: DONE
- **i18n cache busting**: DONE
- **Next candidates**: Animation token system, convergence UI (show users what the mirror sees?)
- **Design polish backlog** (from ship Gate 3): Add `--font-prose`/`--font-meta` token aliases to `:root`, tokenize `#A78BFA` dark link color, add 44px min touch target to `.ka-legal-back`, raise `.ka-gate-legal` opacity from 0.5 to 0.6
- **Dep updates available**: @sentry/react, @supabase/supabase-js, @types/react, i18next, posthog-js, react-router-dom (all patch/minor). Hold framer-motion v12 + lucide-react v0.575 (breaking).
- **Known limitations**: Claude/Gemini share links don't work (CSR — no server-side content)

## Key Decisions Made

- Rate limits: Postgres fixed-window counters with atomic upsert, fail-open semantics
- SSRF blocklist: 10 regex patterns covering all private/reserved ranges
- All RPCs: SECURITY DEFINER with privileges revoked from public/authenticated/anon
- Entity: 32-bit aesthetic with outline ring, gradient fills, cursor-tracking eyes
- Bottom-sheet pattern for all panels
- Dark mode: warm brown undertones, never cool gray — "lamplight reading" principle
- Zero Tailwind — all vanilla CSS with `ka-` prefix and Rubin design tokens
- Edge function deploys: ALWAYS use `--no-verify-jwt` flag
- Onboarding: single screen; sessionStorage bridge pattern
- Account settings: bottom-sheet panel, OAuth localStorage flag for redirect reopen
- Upload limits: flat 50MB per file everywhere — no free/pro tier split
- Claude proxy payload limits: 50MB (was 32KB/256KB — broke file uploads)
- Free-tier messaging: 20 messages per 24h rolling window, RPC returns JSONB `{daily_count, resets_at}`
- Convergence: 6 facet agents, Haiku extraction every 3 msgs, Sonnet convergence every ~5 msgs
- Legal pages: Plain-language React components at `/#/privacy` and `/#/terms`
- File routing: When `ContentBlock[]` (images/PDFs) attached, always use direct Claude call — never route through swarm/workflow/research (they only accept strings)
- Web search: available to ALL users (free and Pro), not gated
- i18n cache busting: `__BUILD_TIME__` define + `queryStringParams` in i18next-http-backend

## Test Accounts

- **Free**: `kernel-test-bot@antigravitygroup.co` / `KernelTest2026!`
- **Pro**: `kernel-pro-test@antigravitygroup.co` / `KernelProTest2026`
