# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-24, latest)

### Accomplished This Session

#### Full System Debug Audit — 27 Bugs Found & Fixed
Deep diagnostic sweep across entire codebase (3 parallel agents: runtime errors, edge functions, React hooks). All issues fixed, committed, and deployed.

**Critical fixes (7):**
- `EnginePage.tsx`: Rules of Hooks violation — `useState` after conditional return. Extracted `EnginePageAuthed` component so hooks always run unconditionally.
- `useChatEngine.ts`: Stale `messages` closure in `sendMessage` — added `messagesRef`, all reads across awaits now use `messagesRef.current`.
- `useChatEngine.ts`: `classifyIntent` outside try/catch — if Haiku classifier throws, UI frozen permanently. Wrapped with fallback to kernel agent.
- `useChatEngine.ts`: Stale `isThinking` in `updateKernelMsg` — added `isThinkingRef`, callback reads ref instead of closure.
- `claude-proxy`: Free-tier model lock bypass — check used legacy aliases only, not full model IDs. Built complete `allowedFreeModels` Set from `TIER_MODELS[*].fast`.
- `task-scheduler`: Auth bypass if `CRON_SECRET` not set — changed to fail closed (500 if missing).
- `identity-recovery`: Username uniqueness bypass on RPC error — `available` was null not false, skipping check. Now returns 503 on RPC failure.

**Medium fixes (11):**
- `useKernelAgent.ts`: Engine subscription leak — not unsubscribed when drawer closes. Fixed cleanup to run on `isOpen=false`.
- `claude-proxy`: Unbound `err` in catch block — `catch {}` → `catch (err) {}`.
- `useScrollTracking.ts`: Stale `messageCount` in scroll handler + auto-scroll jerk on manual scroll. Removed messageCount dep from listener, auto-scroll only on count increase.
- `send-notification`: Silent no-op with empty env vars → explicit null check, returns 500. Also gated in-app notification behind `channels.includes('in_app')`.
- `send-inquiry-email`: Returns success when both emails fail → tracks `notifyOk`/`confirmOk`, returns 502 if both fail.
- `import-conversation`: `MAX_HTML_SIZE` never enforced → added `safeReadText()` helper, all 4 fetch functions enforce 2MB limit.
- `create-portal`: Stripe response bodies not consumed on failure → added `.text().catch()` on all failed paths.
- `delete-account`: Premature audit + unchecked Stripe response → moved audit after deletion, consume Stripe response body.
- `_shared/validate.ts`: SSRF bypass via DNS rebinding (`169.254.169.254.nip.io`) → extracts embedded IPv4 from hostname and checks against blocklist.
- `send-announcement`: `listUsers()` capped at 1000 → added pagination loop. Also stripped email list from response body.

**Low fixes (9):**
- `MessageContent.tsx`: Hoisted `mdComponents` outside component (stable ref for ReactMarkdown), replaced module-level `/g` regex with per-call instance.
- `useProviderHealth.ts`: Renamed inner `fetch` to `pollHealth` — no longer shadows `window.fetch`.
- `EnginePage.tsx`: File attachment chips use `name+size+lastModified` as key instead of array index.
- `useWebPush.ts`: Added `cancelled` guard + `.catch()` on `serviceWorker.ready` promise.
- `useReliabilityDashboard.ts`: Read `data` via ref instead of `useCallback` dep, fixed effect dependency.
- `useCompanionMood.ts`: Added `store` to both decay effect dependency arrays.
- `useAccountSettings.ts`: Added `cancelled` guards on debounced RPC callbacks.
- `useAuth.ts`: Added `mountedRef` to gate `setIsSubscribed` after unmount.
- `_shared/cors.ts`: Restrict localhost CORS to non-production environments.

Commits: `af49f1837`, `502d5b3aa`, `479d58c00` — all pushed to origin/main, deployed to kernel.chat. 9 edge functions redeployed twice (for medium + low passes).

#### Privacy Policy, Terms of Service & User Agreement Flow
- **`src/pages/PrivacyPage.tsx`** (new): Comprehensive privacy policy — 11 sections covering information collected, The Mirror/Convergence system (all 6 facet lenses documented), data usage, what we don't do, third-party services (Supabase, Anthropic, Stripe, Perplexity), data retention, security measures, user rights (CCPA + GDPR), children, changes, contact. Written in plain language.
- **`src/pages/TermsPage.tsx`** (new): Terms of service — 11 sections covering service description, accounts, content ownership, conversation analysis consent, acceptable use, Pro subscriptions, limitations/liability, free tier limits, data deletion, changes, contact.
- **`src/router.tsx`**: Added lazy-loaded routes for `/#/privacy` and `/#/terms`.
- **`src/components/LoginGate.tsx`**: Added legal agreement text to auth modal — "By continuing, you agree to the Terms of Service & Privacy Policy" with links to both pages.
- **`public/locales/en/auth.json`**: Added `modal.legalAgreement`, `modal.termsLink`, `modal.privacyLink` i18n keys.
- **`src/index.css`**: ~90 lines `.ka-legal-page` CSS (typography, spacing, links, lists, dark mode) + `.ka-gate-legal` for auth modal.
- Mirror seeded for 10 users (30 facets, 14 convergence insights) via direct SQL.
- Committed `e35906010`, pushed to origin/main, deployed to kernel.chat.

#### Ship Pipeline — Two Full 6-Gate Passes
**Pass 1** (`e35906010` — legal pages):
- All 6 gates PASS. GH Pages 200 (348ms). JS 92.4KB gzip (31% budget). No P0/P1 security findings. No critical design violations.

**Pass 2** (`af49f1837` — reliability hardening + debug audit):
- **Gate 1 — Security: PASS** — No P0/P1. Clean secrets scan. All 20 edge functions auth-verified. 0 production npm vulns.
- **Gate 2 — QA: PASS** — Zero type errors. Clean build. 1059 modules, 56 precache entries (518KB). Bundle sizes stable.
- **Gate 3 — Design: PASS** — No critical Rubin violations. 1 new minor (inline style in DeleteAccountModal). Pre-existing: touch target, contrast warnings.
- **Gate 4 — Performance: PASS** — Main JS 92.4KB gzip (31% of 300KB budget). CSS 30.8KB gzip (21% of 150KB budget). 0 npm vulnerabilities. 6 safe patch/minor updates available, 2 majors held (framer-motion v12, lucide-react v0.575).
- **Gate 5 — DevOps: PASS** — Deploy live. GH Pages 200 (487ms), Supabase 401, Claude 415 — all nominal.
- **Gate 6 — Product: PASS** — Landing, auth modal (with legal links), privacy, terms, authenticated home all verified. Mobile 375x812 clean. No regressions.

#### Convergence — Multi-Agent Perception Synthesis
- **`src/engine/Convergence.ts`** (new): Core convergence engine. 6 facet lenses — Kernel (relationship), Researcher (curiosity), Coder (craft), Writer (voice), Analyst (judgment), Curator (arc). `extractFacet()` runs 1 Haiku call per conversation for the active agent's dimension. `converge()` runs 1 Sonnet call every ~5 conversations, sharing all facet observations and producing 2-4 emergent insights. `formatMirrorForPrompt()` injects mirror context into agent system prompts. `shouldConverge()` triggers on 3+ updated facets or every 5 messages. `resolveFacetAgent()` maps non-facet agents to kernel lens.
- **Migration 033** (`convergence.sql`): Added `agent_facets JSONB DEFAULT '{}'`, `convergence_insights JSONB DEFAULT '[]'`, `last_convergence TIMESTAMPTZ` columns to `user_memory`. Applied via Supabase MCP.
- **`SupabaseClient.ts`**: Extended `DBUserMemory` interface with `agent_facets`, `convergence_insights`, `last_convergence`. Added `upsertUserMirror()` function.
- **`useChatEngine.ts`**: Added `UserMirror` state + ref. Mirror loaded from Supabase on mount (from `agent_facets`/`convergence_insights` columns). Facet extraction integrated into background extraction cycle (every 3 messages, alongside memory/KG/goals). Convergence runs conditionally via `shouldConverge()`. Mirror context injected into system prompt between User Memory and Knowledge Graph blocks.
- **`useAccountSettings.ts`**: Fixed pre-existing React 19 type error — `useRef()` requires initial value, changed to `useRef(undefined)`.
- Committed `36fa92481`, pushed to origin/main, deployed to kernel.chat.

#### Free-Tier Daily Message Limit — Full Implementation
- **Migration 025** (`protect_message_count.sql`): BEFORE UPDATE trigger on `user_memory` blocks direct modification of `message_count`. Uses `app.allow_message_count_update` session variable as bypass token for the RPC. Committed `21832166`.
- **Migration 026** (`daily_message_limit.sql`): Added `daily_message_count` and `daily_message_date` columns to `user_memory`. Updated `increment_message_count` RPC to auto-reset daily count on new day. Trigger extended to protect new columns. Committed `9b3cf8f4`.
- **Migration 027** (`24h_rolling_window.sql`): Replaced `daily_message_date DATE` with `daily_window_start TIMESTAMPTZ`. 24h rolling window starts on user's first message after reset. RPC return type changed from INT to JSONB `{daily_count, resets_at}`. Required `DROP FUNCTION` before recreate (return type change). Committed `78c23e82`.
- **Edge function** (`claude-proxy`): `FREE_LIMIT` changed from 10 to 20. Parses JSONB from RPC. Returns `resets_at` in 403 response. Sends in-app + push notification on first overage (`daily_count === FREE_LIMIT + 1`). Deployed 3 times across iterations.
- **`FreeLimitError`** (both `proxy.ts` and `ClaudeClient.ts`): Added `resetsAt: string | null` field. Error handler parses `resets_at` from 403 body.
- **`useBilling.ts`**: Added `freeLimitResetsAt` / `setFreeLimitResetsAt` state.
- **`useChatEngine.ts`**: Added `setFreeLimitResetsAt` param. Passes `err.resetsAt` to billing on `FreeLimitError`.
- **`EnginePage.tsx`**: `FREE_MSG_LIMIT` changed from 10 to 20. Upgrade wall now shows "Your messages reset at HH:MM" (localized via `toLocaleTimeString`). Passes `setFreeLimitResetsAt` to chat engine.
- **i18n**: Added `upgrade.resetsAt` key to all 24 locale files with translated text.
- **`useAccountSettings.ts`**: Fixed pre-existing type error (`supabaseKey` possibly undefined → added `|| ''`).
- **Notification on limit hit**: In-app notification ("Daily messages used — They reset at X") + push notification via internal `send-notification` edge function call. Only fires once per 24h window.
- **Tested end-to-end**: Playwright browser test — sent message (RPC created row), simulated limit hit (upgrade wall appeared with reset time "11:24 PM"), verified notifications created in DB, cleaned up test data.
- **Reset all users**: Set `daily_message_count = 0` and `daily_window_start = NULL` for all 18 users.
- Commits: `21832166`, `9b3cf8f4`, `78c23e82`, `d307b5d7` — all pushed to origin/main, deployed to kernel.chat.

#### Unified 50MB Upload Limit + Claude Proxy Fix
- **`ChatHelpers.tsx`**: Replaced per-type/per-tier file size limits (free: 2-10MB, pro: 20-25MB) with single 50MB cap for all file types.
- **`useAccountSettings.ts`**: Avatar upload limit raised from 2MB to 50MB.
- **`transcribe/index.ts`**: Removed tier-based size check (2MB free / 25MB pro), replaced with flat 50MB limit. Removed subscription lookup for size gating.
- **Supabase avatars bucket**: Updated `file_size_limit` to 50MB server-side.
- **`claude-proxy/index.ts`**: **Root cause of upload failures** — `MAX_MESSAGE_SIZE_BYTES` was 32KB and `MAX_PAYLOAD_SIZE_BYTES` was 256KB. Base64-encoded images/PDFs would exceed these limits silently. Raised both to 50MB. Committed `71a1fbfa`.
- **`AccountSettingsPanel.tsx`**: Fixed `ResetScope` type errors — `RESET_SCOPES` is a string array, code was treating elements as objects with `.id`/`.icon`. Changed to use string directly + `RESET_SCOPE_ICONS[scope]` lookup. Committed `6c60cd94`.
- Transcribe + claude-proxy edge functions redeployed. Committed `b97a7186`, `6c60cd94`, `71a1fbfa` — all pushed to origin/main, deployed to kernel.chat.

---

## Previous Session (2026-02-23, latest)

### Accomplished

#### Account Settings Panel — Full Implementation
- **`useAuth.ts`**: Added 5 methods (`updateEmail`, `updateProfile`, `getUserIdentities`, `linkIdentity`, `unlinkIdentity`). Fixed `USER_UPDATED` event to always update user state (was dropping metadata changes).
- **`useAccountSettings.ts`** (new): Hook for profile, email, password, linked accounts form state. Per-section loading/error/success. Re-authentication flow (verify current password before sensitive changes).
- **`AccountSettingsPanel.tsx`** (new): Bottom-sheet with 5 sections — user summary (avatar + name + tier badge), profile editing, security (email/password), linked accounts (Google/GitHub/X connect/disconnect), danger zone (sign out + delete).
- **`usePanelManager.ts`**: Added `showAccountSettings` state, wired into all panel management methods.
- **`MoreMenu.tsx`**: Replaced scattered account items (upgrade, manage, delete) with single "Account settings" + "Sign out".
- **`EnginePage.tsx`**: Lazy import, BottomSheet render, header menu consolidated, OAuth redirect reopen logic (`kernel-reopen-settings` localStorage flag).
- **`settings.json`** (new): i18n namespace for all settings sections.
- **`home.json`**: Added `menu.accountSettings` key.
- **`index.css`**: ~300 lines `.ka-settings-*` CSS with dark mode.
- **Supabase**: Created `avatars` storage bucket (public, 2MB, image-only, RLS for user-scoped write).
- **Bug fixes**: Email input squished (added `min-width: 0` + button `max-width`), panel not scrollable (added `overflow-y: auto`, `max-height`, mobile safe-area padding).
- New icons: Terminal, Maximize, Smartphone, Tablet, Monitor.
- Commits: `e7a8ebdb`, `34e7ebd1`, `57d7b5ca` — all pushed to origin/main, deployed to kernel.chat

#### Type Fixes
- **`useAccountSettings.ts`**: Moved `hasPassword` and `identities` declarations above callbacks that reference them (block-scoped variable used before declaration). Committed `b0e03570`.
- **`useKernelAgent.ts`**: Fixed `Engine` type extraction — `Awaited<ReturnType<typeof import(...)>>` wraps the module namespace, changed to `Awaited<typeof import(...)>['getEngine']` to correctly extract the function type. Committed `031f5a94`.

#### Account Settings — Verification & Error Handling
- **`AccountSettingsPanel.tsx`**: Removed `hasPassword` gate on verification block so OAuth-only users can verify identity too. Added `verifyHint` text and `verificationRequired` error handling.
- **`useAuth.ts`**: `linkIdentity` now throws on error instead of silently swallowing.
- Committed `5e7e7a38`, pushed to origin/main, deployed to kernel.chat.

---

## Previous Session (2026-02-23, even later 2)

### Accomplished

#### Onboarding Flow Redesign — Single Screen
- **`OnboardingFlow.tsx`**: Rewrote from 450 lines (9-stage conversational wizard) to ~95 lines. Single screen: ParticleGrid hero (300px, interactive), serif greeting, mono tagline, text input with submit arrow. User's first message stored in `sessionStorage('kernel-onboarding-message')` → `onComplete()`. Skip button bypasses directly.
- **`useChatEngine.ts`**: Added onboarding message consumer (~14 lines) after briefing effect. Same `useRef` + `setTimeout(600ms)` transient-mount guard pattern. Reads sessionStorage, starts new chat, sends message.
- **`EnginePage.tsx`**: Simplified `onComplete` — removed `interests` param and `upsertKGEntity` loop. Removed unused import.
- **`onboarding.json`**: Replaced 43 lines with 6 keys: `greeting`, `greetingUser`, `tagline`, `placeholder`, `skipIntro`
- **`index.css`**: Replaced ~295 lines of onboarding CSS with ~80 lines — centered flexbox page, hero, serif title, mono tagline, input+submit form. Dark mode, mobile (200px grid), reduced-motion variants.
- Committed `ac49d997`, pushed to origin/main, deployed to kernel.chat

---

## Previous Session (2026-02-23, even later)

### Accomplished

#### Set New Password Flow (Password Recovery)
- **`useAuth.ts`**: Added `isPasswordRecovery` state, detect `PASSWORD_RECOVERY` event in `onAuthStateChange`, `updatePassword()` calls `supabase.auth.updateUser({ password })` and clears flag on success, `clearPasswordRecovery()` to dismiss
- **`SetNewPasswordModal.tsx`** (new): Modal with password + confirm fields, min 8 char validation, match check, reuses existing CSS (`ka-upgrade-overlay`, `ka-upgrade-modal`, `ka-gate-input`, `ka-gate-submit`, `ka-gate-error`, `ka-upgrade-dismiss`), "Skip for now" dismiss
- **`EnginePage.tsx`**: Lazy import + render inside `<AnimatePresence>` when `isPasswordRecovery` is true
- **`auth.json`**: Added `setPassword` i18n section (title, subtitle, placeholders, submit, tooShort, mismatch, success, skipForNow)
- Zero new CSS needed — all existing classes reused
- Committed `33573887`, pushed to origin/main, deployed to kernel.chat

---

## Previous Session (2026-02-23, later)

### Accomplished

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
- **Password recovery flow**: DONE (detect PASSWORD_RECOVERY event, SetNewPasswordModal, updateUser)
- **Onboarding redesign**: DONE (single-screen ParticleGrid + input, sessionStorage bridge to chat engine)
- **Account settings panel**: DONE (profile, email, password, linked accounts, avatar upload, re-auth, Supabase avatars bucket)
- **Upload limits**: DONE (unified 50MB per file, no tier split)
- **Free-tier daily limit**: DONE (20 msgs/24h rolling window, reset time shown, in-app + push notifications)
- **Convergence**: DONE (multi-agent perception synthesis — 6 facet lenses, emergent insights, mirror context in prompts)
- **Legal pages**: DONE (privacy policy, terms of service, user agreement flow in auth modal, CCPA/GDPR, Mirror documented)
- **Mirror seeding**: DONE (30 facets, 14 convergence insights across 10 users)
- **Next candidates**: Animation token system, convergence UI (show users what the mirror sees?)
- **Design polish backlog** (from ship Gate 3): Add `--font-prose`/`--font-meta` token aliases to `:root`, tokenize `#A78BFA` dark link color, add 44px min touch target to `.ka-legal-back`, raise `.ka-gate-legal` opacity from 0.5 to 0.6
- **Dep updates available**: @sentry/react, @supabase/supabase-js, @types/react, i18next, posthog-js, react-router-dom (all patch/minor). Hold framer-motion v12 + lucide-react v0.575 (breaking).
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
- Onboarding: single screen over multi-stage wizard; sessionStorage bridge pattern (write in onboarding, consume in useChatEngine with transient-mount guard)
- Account settings: bottom-sheet panel, MoreMenu consolidated to single entry + sign out, OAuth link uses localStorage flag (`kernel-reopen-settings`) to reopen panel after redirect, avatars bucket with user-scoped RLS, re-auth via `signInWithPassword` before email/password changes
- Upload limits: flat 50MB per file everywhere (chat attachments, avatars, transcription) — no free/pro tier split for file sizes
- Claude proxy payload limits: 50MB for both per-message and total payload (was 32KB/256KB — broke all file uploads with base64 content)
- Free-tier messaging: 20 messages per 24h rolling window (not midnight reset). Window starts on first message after previous window expires. RPC returns JSONB `{daily_count, resets_at}`. Trigger protects `message_count`, `daily_message_count`, and `daily_window_start` from direct client manipulation. Lifetime `message_count` preserved for entity evolution. In-app + push notification fires once per window on first overage. Streak bonus (+1 at 3+ days) still applies on top of 20.
- Convergence: 6 facet agents (kernel/researcher/coder/writer/analyst/curator) each maintain observations+patterns about the user. Non-facet agents fall back to kernel lens. Facet extraction runs every 3 messages (1 Haiku call). Convergence runs every ~5 messages or when 3+ facets updated (1 Sonnet call). Mirror data stored in `user_memory` table (`agent_facets`, `convergence_insights`, `last_convergence` columns). Mirror context injected into all agent system prompts under `## Mirror` section. Cost: ~$0.001/conversation for facets, ~$0.01 per convergence.
- Legal pages: Plain-language privacy policy and terms of service as React page components at `/#/privacy` and `/#/terms`. Auth modal shows "By continuing, you agree to Terms & Privacy" with links. Privacy policy explicitly documents the Mirror/Convergence system. Both pages use `.ka-legal-page` CSS with dark mode.
