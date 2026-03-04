# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-03-03)

### Accomplished This Session

#### Backlog Sweep: Dark Mode, Security, Dep Upgrade, Server Persistence

**1. Dark mode tokens fixed (warm brown)**
Changed 3 cool neutral gray tokens to warm browns per "lamplight reading" principle:
- `--dark-bg-surface`: `#1a1a1a` → `#252321`
- `--dark-bg-deep`: `#0f0f0f` → `#141210`
- `--dark-border-subtle`: `#333` → `#3A3630`

**Modified:** `src/index.css`

**2. Removed VITE_GEMINI env vars from client types**
Removed `VITE_GEMINI_API_KEY`, `VITE_GEMINI_MODEL_PRO`, `VITE_GEMINI_MODEL_FLASH` from `src/vite-env.d.ts` — server-side only keys, prevents accidental client-side usage.

**Modified:** `src/vite-env.d.ts`

**3. Upgraded framer-motion → motion**
- `npm uninstall framer-motion && npm install motion` (v12.34.5)
- Updated 51 source file imports: `'framer-motion'` → `'motion/react'`
- Updated 2 test file mocks
- Updated `vite.config.ts` manualChunks
- Updated `PROJECT.md` references
- `vendor-ui` chunk: 116KB → 93KB (20% reduction)
- Zero type errors, clean build, pre-existing test failures only

**Modified:** 51 source files, 2 test files, `vite.config.ts`, `PROJECT.md`, `package.json`

**4. Server-side project persistence (Pro feature)**
Files generated in conversations now persist to Supabase Storage for Pro users. Content survives page reload and works across devices.

- **Migration** (`056_project_files.sql`): `project_files` table + `project-files` Storage bucket + RLS
- **Edge function** (`project-files/index.ts`): save/list/load routes with JWT auth, subscription check, rate limiting, audit logging
- **Frontend** (`projectStore.ts`): `syncToCloud()` fire-and-forget on file registration, `loadFromCloud()` hydrates on conversation load
- **EnginePage.tsx**: wired cloud sync after `registerFile` (Pro gate), auto-load on conversation switch

**Not yet deployed** — needs `npx supabase db push` + `npx supabase functions deploy project-files --no-verify-jwt`

**Modified:** `src/stores/projectStore.ts`, `src/pages/EnginePage.tsx`, `supabase/functions/project-files/index.ts`, `supabase/functions/_shared/rate-limit.ts`, `supabase/migrations/056_project_files.sql`

#### Previous Work This Session

#### Image Gen Conversation Continuity
Added follow-up suggestion chips after image generation ("Try a different style", "Make it darker", "More vibrant", "Generate another version"). Guarded the `finally` block from overwriting image-specific chips.

**Modified:** `src/hooks/useChatEngine.ts`

#### Image Lightbox — Mobile Dismiss + Actions
- Removed `stopPropagation` from lightbox image so tapping anywhere closes it (mobile had no way to dismiss)
- Added safe-area insets to close button for iOS notch/Dynamic Island
- Added download + copy-to-clipboard buttons in lightbox (44px touch targets, PNG conversion for clipboard)

**Modified:** `src/components/GeneratedImageCard.tsx`, `src/index.css`

#### Mobile Auth Redirect — Root Cause Fixed
Users couldn't log in on mobile — always redirected back to landing page. **Three root causes found and fixed:**

1. **Stale API key (PRIMARY):** Supabase anon key was rotated but the hardcoded fallback in `SupabaseClient.ts` still had the old key (iat: Feb 2025). Builds without `.env` loaded silently used the stale key → "Invalid API key" on all auth requests. Removed the hardcoded fallback entirely.

2. **OAuth flow type:** Switched from PKCE to implicit (`flowType: 'implicit'`). PKCE stores `code_verifier` in localStorage which gets lost on mobile (ITP, PWA context switches). Implicit puts tokens directly in hash fragment — no exchange step needed.

3. **Session race condition:** `setSession()` and `exchangeCodeForSession()` weren't awaited in `main.tsx` — React rendered before session was established. Wrapped boot in async IIFE with proper awaits.

**Modified:** `src/engine/SupabaseClient.ts`, `src/main.tsx`, `src/hooks/useAuth.ts`

#### PWA Cache Staleness Fixes
- SW HTML route: added `fetchOptions: { cache: 'reload' }` to bypass browser HTTP cache (GitHub Pages caches aggressively)
- Added 30-min periodic SW update check (SPAs never navigate, so browser never checks for updates)
- Added `SKIP_WAITING` message handler in SW for `useServiceWorkerUpdate` hook

**Modified:** `src/sw.ts`, `src/main.tsx`

#### All Changes Committed, Pushed, Deployed
Commits: `c4876c6e`, `ffe108df`, `4cc272b3`, `6371503f`, `3112a652`
Deployed to kernel.chat, verified live with correct API key.

---

## Previous Session (2026-02-28)

### Accomplished
- Image gen reference images (uploads + conversation history as Gemini guidance)
- Backlog cleanup: Cloudflare DNS, Discord webhook, Supabase migration sync, frontend deploy
- Ship pipeline: all 6 gates PASS

---

## Previous Sessions (2026-02-26 to 2026-02-27)

### Accomplished
- Image credit packs + auto-reload, comped Pro for siijoseph333@gmail.com
- Auto-expire comped subscriptions, AI image generation (Gemini 2.5 Flash)
- Data export, API key rotation, notification UX, landing page redesign
- Legal update, backlog sweep, thinking toggle

---

## Previous Sessions (2026-02-17 to 2026-02-25)

### Accomplished
- Pro features E2E testing & 3 critical bug fixes
- Web search for free users, i18n cache busting
- Full system debug audit — 27 bugs fixed
- Privacy Policy, Terms of Service, convergence, free-tier limits
- Account settings, onboarding, conversation search, backend hardening
- Entity system, ChatGPT import, Stripe, Discord bot
- P1-P14: Dark mode, test suite, panels, i18n, artifacts, agent audit, design overhaul, mobile audit

---

## Ongoing Backlog

- **Comped Pro — siijoseph333@gmail.com**: Active until 2026-03-27. Auto-expiration handles it.
- **P1 test fixes** (non-blocking): MoreMenu.test.tsx and BottomTabBar.test.tsx have pre-existing failures (component changed, tests not updated)
- **Deploy project-files**: Migration + edge function need deployment (`db push` + `functions deploy`)

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
- Web search: uses Claude's built-in `web_search_20250305` tool (NOT Perplexity), available to ALL users
- i18n cache busting: `__BUILD_TIME__` define + `queryStringParams` in i18next-http-backend
- Thinking toggle: Concentric-ring icon (`IconThinking`), circular 40px button, pulse animation when active
- Animation tokens: `src/constants/motion.ts` (JS) synced with CSS custom properties in `:root`
- Share link previews: Cloudflare Workers as crawler-aware proxy (GH Pages + hash routing)
- Legal compliance: California law, LA County, AAA arbitration. GDPR legal bases mapped per activity.
- Multi-provider LLM: claude-proxy supports Anthropic (default), OpenAI, Google Gemini, NVIDIA Llama
- Image generation: Credit-gated (not subscription-included), Gemini 2.5 Flash Image. Rate limit 10/min. Reference images from uploads + conversation history passed to Gemini as style/content guidance (max 4, 4MB each).
- Subscription expiration: task-scheduler checks every 5 min, deactivates expired subs
- Landing page: ParticleGrid visual identity. Canvas can't read CSS vars — hex values hardcoded in JS.
- **OAuth: implicit flow** (`flowType: 'implicit'`), `detectSessionInUrl: false`. Manual token handling in `main.tsx` before React renders. No hardcoded API key fallbacks — fail loudly if `.env` missing.
- **SW caching**: `fetchOptions: { cache: 'reload' }` on HTML route bypasses browser HTTP cache. 30-min periodic update check for SPAs. Global `controllerchange` listener for auto-reload on deploy.
- **framer-motion → motion**: Rebranded in v12. Import path `'motion/react'`. Drop-in replacement, no API changes.
- **Project file persistence**: Pro feature. Edge function `project-files` saves to Supabase Storage. `projectStore.ts` syncs fire-and-forget on register, loads on conversation switch.

## Test Accounts

- **Free**: `kernel-test-bot@antigravitygroup.co` — password in .env
- **Pro**: `kernel-pro-test@antigravitygroup.co` — password in .env
