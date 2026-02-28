# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-27)

### Accomplished This Session

#### Image Credit Packs + Auto-Reload + Fixes
Converted image generation from Pro-included to credit-based system with auto-reload.

**New files:**
- `supabase/migrations/042_auto_reload.sql` — 3 columns on `user_memory` (stripe_customer_id, auto_reload_pack, auto_reload_threshold) + 3 RPCs (get_auto_reload, set_auto_reload, set_stripe_customer_id)
- `src/components/ImageCreditModal.tsx` — Credit purchase modal with 3 packs + auto-reload toggle
- `supabase/functions/create-image-checkout/index.ts` — Stripe Checkout for credit packs

**Modified files:**
- `supabase/functions/image-gen/index.ts` — Credit gating, admin bypass (ADMIN_USER_IDS env), auto-reload trigger after decrement, get/set auto-reload actions. Fixed Gemini model from deprecated `gemini-2.0-flash-exp` (502 errors) to `gemini-2.5-flash-image`.
- `supabase/functions/stripe-webhook/index.ts` — Stores stripe_customer_id after credit purchase for auto-reload
- `src/engine/imageGen.ts` — Added `getAutoReload()`, `setAutoReload()`, `getImageCredits()`, `ImageCreditError` class
- `src/hooks/useChatEngine.ts` — Auto-reload toast, credit modal trigger on 0 credits
- `src/index.css` — Credit modal styles + auto-reload section + fix upgrade wall overflow (max-height + overflow-y: auto)

**Stripe products created:**
- Starter: 25 credits / $4.99 (price_1R7...)
- Standard: 75 credits / $12.99 (price_1R7..., "Most Popular")
- Power: 200 credits / $29.99 (price_1R7...)

**Admin bypass:** `ADMIN_USER_IDS` env var on image-gen — skips credit check, rate limit, and credit decrement. Set to Isaac's user ID.

**Admin Pro subscription:** Added active Pro (1 year) for admin account `68194440-44c5-41df-86f5-1e5fa25b13a0`.

**E2E verified on kernel.chat via Playwright:**
- Image gen: "draw me a cozy cabin" → image + credits decremented
- Image gen: "sunset over ocean" → image + credits decremented
- 0 credits → auto-opens credit modal with 3 packs + auto-reload section
- Starter pack → Stripe Checkout with correct price, future charge consent
- Auto-reload APIs: get/set/disable all working (curl tested)

**Commits:** `54b022fc6` (credit packs + auto-reload), `6fbfd811b` (Gemini model fix + upgrade wall overflow)

#### Comped Pro for siijoseph333@gmail.com
Granted 1 month complimentary Pro access to `siijoseph333@gmail.com` (user ID: `65848452-c1d9-4b9b-ade7-bbfbf47a14fe`). Expires **2026-03-27**.
- Inserted `subscriptions` row with `status: 'active'`, `current_period_end: now() + 1 month`
- Sent welcome email via Resend (Pro feature overview)
- Sent in-app notification ("Upgraded to Kernel Pro")

#### Auto-Expire Comped Subscriptions
Discovered that `current_period_end` was never enforced — the system only checks `status = 'active'`, so comped Pro would last forever. Fixed it.

**Change:** `supabase/functions/task-scheduler/index.ts`
- Every 5 min, queries `subscriptions` where `status = 'active'` AND `current_period_end < now()`
- Deactivates expired subs (`status → 'inactive'`)
- Sends in-app notification to each expired user
- Non-blocking try/catch — doesn't affect other scheduler tasks
- Stripe-managed subs are unaffected (Stripe pushes `current_period_end` forward on each renewal before it expires)

- Commit: `575820477` pushed to origin/main
- Edge function deployed
- Shipped via 6-gate pipeline — all gates PASS

**Ship pipeline results:**
- Gate 1 Security: PASS — 0 P0/P1 findings, clean secrets scan
- Gate 2 QA: PASS — tsc 0 errors, build clean (1083 modules, 2.28s)
- Gate 3 Design: PASS — Rubin compliant, P2: download button 32px touch target
- Gate 4 Performance: PASS — JS 93KB gzip (31%), CSS 39KB gzip (26%), 0 prod vulns
- Gate 5 DevOps: PASS — Deployed to GH Pages, kernel.chat HTTP 200 (506ms)
- Gate 6 Product: PASS — Landing, auth, mobile 375px, authenticated home all verified

---

## Previous Session (2026-02-27 late night)

### Accomplished

#### AI Image Generation — Pro-Only Feature (Nano Banana 2)
Built and deployed AI image generation using Google's `gemini-3.1-flash-image-preview` (Nano Banana 2) model. Pro-only feature — free users see upgrade prompt.

**New files:**
- `supabase/functions/image-gen/index.ts` — Edge function: CORS → JWT → Pro check → rate limit → Gemini API → audit log. Returns base64 images. 422 when no image generated.
- `src/engine/imageGen.ts` — Frontend client: `generateImage()`, `ImageGenLimitError` class. Handles 403/429/errors.
- `src/components/GeneratedImageCard.tsx` — Artifact-style card with lightbox, download button, Framer Motion entrance.
- `src/engine/imageGen.test.ts` — 5 unit tests (success, 403, 429, error, limit error class).

**Modified files:**
- `supabase/functions/_shared/rate-limit.ts` — Added `image-gen: { free: 0, paid: 5, pro: 10, windowSeconds: 60 }`
- `src/engine/AgentRouter.ts` — Added `needsImageGen: boolean` to ClassificationResult + detection prompt
- `src/hooks/useChatEngine.ts` — Image gen branch before workflow/swarm routing, `generatedImages` on ChatMessage
- `src/pages/EnginePage.tsx` — Renders GeneratedImageCard, handles empty content with images
- `src/index.css` — ~160 lines `.ka-generated-image-*` styles (dark/eink/mobile)
- `src/components/LoginGate.tsx` — 5th Pro feature in pricing
- All 24 `auth.json` locale files — `proFeature5: "AI image generation"` translated

**API key setup:**
- Gemini API key created and set in Supabase secrets (`GEMINI_API_KEY`)
- Old key in Supabase was invalid (64-char hex hash, not a Google AI key)

**E2E verified via Playwright:**
- Pro account: "draw me a cozy cabin in the snow" → image card rendered with download button
- Free account: "generate an image of a dragon" → instant upgrade message, no API call
- Edge function: 401 anon, 403 free, 200 Pro

**Cost:** ~$0.039/image, bundled into $20/mo Pro subscription. Rate limited to 10/min.

- Commit: `c752fd275` pushed to origin/main
- Edge function deployed, frontend deployed to GitHub Pages

---

## Previous Session (2026-02-26 evening)

### Accomplished

#### Shipped Data Export + Insights Fixes
Deployed all uncommitted work from earlier session — data export endpoint, insights backend fixes, and frontend changes. Full E2E verification via Playwright.

**Deployed:**
- Migration `037_insights_fixes.sql` applied via Supabase MCP (CLI migration history was out of sync — used `apply_migration` directly)
- 3 edge functions deployed: `export-user-data`, `evaluate-chat`, `extract-insights`
- Frontend built (JS: 93KB gzip, CSS: 40KB gzip, 1080 modules) and deployed to GitHub Pages
- Commits pushed to origin/main: `cae96c889` (data export + insights fixes), `d5985cf39` (session logs)

**API Key Rotation:**
- Rotated Anthropic API key (old keys were leaked in `.claude/prompt-log.txt`)
- Updated Supabase secrets via `supabase secrets set`
- Redacted 3 leaked keys (2 Anthropic + 1 Google) from prompt-log before push
- GitHub push protection caught the leak — amended commit to remove secrets from history

**E2E Test Results (all PASS):**
- AI + new API key: sent "1+1", got "2", convergence produced 2 insights
- Export data: downloaded `kernel-data-export-2026-02-26.json` — 23 tables, 74 records, 428ms
- Rate limit: 3rd export attempt returned 429 with `retry_after: 6471s`
- Privacy page: portability text updated to reference "Export my data" in Account Settings
- kernel.chat: HTTP 200, 141ms

---

## Previous Session (2026-02-26, daytime)

### Accomplished

#### Data Export Endpoint — GDPR/CCPA Portability
Built automated data export, fulfilling Privacy Policy's portability promise (GDPR Art. 20 / CCPA).

**New edge function** (`supabase/functions/export-user-data/index.ts`):
- 22 parallel `safeQuery()` calls across all user tables + 1 conditional follow-up for `discord_user_memory`
- IP masking on all security tables (recursive, IPv4 + IPv6)
- `recovery_requests` uses explicit safe columns (excludes `old_value`, `new_value`, `risk_factors`)
- `recovery_tokens` and `rate_limits` excluded entirely
- Partial failure tolerance — returns collected data + `warnings` array
- Rate limited: 1 export per 24h (uniform across tiers)
- `Content-Disposition: attachment` triggers browser download

**Frontend changes:**
- `useAccountSettings.ts` — new `exportData` callback + `exportState` (blob URL download, 429 handling with hours display)
- `AccountSettingsPanel.tsx` — "Export data" section between Voice and Reset Data, with `IconDownload`, loading/error/success/rate-limit states
- `settings.json` — `exportData` i18n keys (heading, description, button, success, rateLimited)
- `PrivacyPage.tsx` — Portability bullet updated from "contact us" to reference automated export in Account Settings

**Security fixes during ship pipeline:**
- P1: `recovery_requests` switched from `select('*')` to explicit column list (excludes `old_value`, `new_value`, `risk_factors`)

#### Notification UX — Auto-Read, Dismiss, Clear All
Fixed notifications so they disappear once read and can be cleared. Commit `994ee7b38`, deployed live.

**Changes:**
- **Auto-mark read** — opening the dropdown immediately marks all unread notifications as read in DB and clears the badge
- **Dismiss individual** — each notification has an X button (hover-reveal) that deletes it from Supabase with CSS fade-out animation
- **Clear all** — header button deletes all notifications from DB, replaces old "Mark all read"
- Removed `--unread` visual distinction (unnecessary since auto-mark on open)
- Dark mode support for dismiss button and clear-all
- Updated tests to match new behavior (8 tests passing)

**Files:** `NotificationBell.tsx`, `NotificationBell.test.tsx`, `index.css`

#### Tooltips + First-Time Discovery Pulse for Toggle Buttons
Added CSS tooltips and one-time discovery pulse animations to the Explain Mode (graduation cap) and Extended Thinking (concentric rings) buttons in the input bar. New users now see a 3x pulse animation on first load (amethyst for thinking, sage green for explain) that auto-dismisses after 10s or on first click. Hover/tap shows Courier Prime tooltip above each button.

**Files changed:**
- `src/index.css` — `.ka-bar-tooltip` (::after tooltip), `.ka-bar-tooltip--discover` (pulse keyframes), dark/eink/reduced-motion overrides, mobile `.ka-explain-toggle` size fix
- `src/pages/EnginePage.tsx` — `explainDiscovered`/`thinkingDiscovered` localStorage-backed state, 10s auto-dismiss useEffect, updated button JSX with tooltip classes + data attributes
- `public/locales/en/home.json` — `thinking.tooltip`, `explain.toggle`, `explain.tooltip` i18n keys

Shipped via 6-gate pipeline — all gates PASS. JS: 92.87KB gzip | CSS: 39.55KB gzip.

#### Ship — Landing Page Redesign + All Prior Work
Final ship of the session. 6-gate pipeline — all gates PASS. Commit `3dbf2cfde`.

**What shipped:**
- Landing page ParticleGrid redesign (LandingHero, LandingFeatures, auth modal particle grid)
- Share link shortening + OG proxy (Cloudflare Worker)
- Color cycle guard, design token compliance, dark/eink theme overrides
- All prior work from today (vibe coding R&D, legal update, legal audit, backlog sweep, thinking toggle)

**Ship pipeline results:**
- Gate 1 Security: PASS — No secrets, 24 edge functions verified, 0 critical npm vulns
- Gate 2 QA: PASS — tsc 0 errors, Vite build clean (1080 modules, 2.19s)
- Gate 3 Design: PASS — Rubin compliant (fonts, palette, touch targets, dark/eink)
- Gate 4 Performance: PASS — JS 93KB gzip (31% of 300KB budget), CSS 39KB gzip (26% of 150KB budget)
- Gate 5 DevOps: PASS — Published to GH Pages, kernel.chat HTTP 200 (265ms)
- Gate 6 Product: PASS — Landing, auth modal, authenticated home, mobile 375px all verified via Playwright

**P2 design notes (non-blocking):**
- `--dark-bg-surface: #1a1a1a` and `--dark-bg-deep: #0f0f0f` are pure neutral grays — should be warmed to match `--dark-bg: #1C1A18` family
- ErrorBoundary.tsx has 3 pre-existing Tailwind-style utility class names (low-traffic error page)
- Agent palette hex colors in LandingFeatures.tsx are hardcoded (canvas can't read CSS vars — architectural constraint)

#### Landing Page Redesign — ParticleGrid-Centered
Replaced all static SVG art on the landing page with live ParticleGrid CMYK fluid simulations.

**New Components:**
- `LandingHero` — Full-viewport ParticleGrid background with `useColorCycle` ambient agent palette rotation (~14s loop), frosted-glass content panel, scroll-driven opacity fade, 5 agent palette dots
- `LandingFeatures` — 3 agent cards with 120px energetic mini-ParticleGrids (IntersectionObserver-gated), specialist colors (kernel/researcher/writer)

**Modified:**
- `ParticleGrid` — Added `width`/`height`/`className` props for rectangular canvas support
- `LoginGate` — Recomposed with LandingHero + LandingFeatures, auth modal uses 72px energetic ParticleGrid instead of static logo SVG, pricing section uses `whileInView` scroll trigger
- `useColorCycle` — Added palette array bounds guard to prevent TypeError on first animation frame
- `index.css` — Pro card `@keyframes landing-plan-glow` cycling 5 agent colors over 14s, dark/eink/mobile/reduced-motion overrides, design token compliance fixes

- Commits: `add1a5cb1` (main redesign), `3dbf2cfde` (polish fixes)

#### Vibe Coding R&D — 6 Features + White Paper + Hardening
Built and shipped the full "Vibe Coding Paradox" R&D plan. 6 parallel agents in git worktrees built the features, then manually merged and hardened across 2 audit rounds (12 fixes total).

**6 New Features (all open to free + pro users):**
1. **Guardian Review** — Background Haiku code security/quality analysis on artifacts >= 8 lines. Cached with djb2 content hash, inflight dedup, 200-entry LRU cap. Colored severity badge + expandable findings on ArtifactCard. (`src/engine/GuardianReview.ts`, `src/components/GuardianBadge.tsx`)
2. **Craft Mirror** — Convergence coder facet injects `CRAFT CALIBRATION` block into coder system prompt, adapting code complexity/style to user's demonstrated skill level. Zero additional API cost. (`src/engine/Convergence.ts` → `formatCraftCalibration()`)
3. **Iteration Canvas** — Line-level LCS diff engine for comparing artifact versions. "Diff" toggle on ArtifactCard when previous version exists. 2000-line guard prevents O(m*n) OOM. (`src/engine/DiffEngine.ts`, MessageContent DiffView)
4. **Architecture Advisor** — Swarm synthesis template for architecture queries. Detects "help me architect" intent, assembles multi-agent design review. Pro-only via existing swarm gate. (`src/engine/SwarmOrchestrator.ts`)
5. **Explain Mode** — Manual toggle in input bar appends pedagogical instructions to coder system prompt. Heavily annotated output with walkthrough sections. (`src/agents/specialists.ts` EXPLAIN_MODE_SUFFIX, EnginePage toggle)
6. **Project Context** — Zustand persist store tracking all generated files per conversation. Manifest injected into coder prompts. Bottom-sheet panel with download/clear. Content stripped from localStorage (metadata only, last 10 convos). (`src/stores/projectStore.ts`, `src/components/ProjectPanel.tsx`)

**White Paper:** `docs/vibe-coding-paradox.md` — 7 sections + appendices, 30+ data citations (OpenAI, Menlo, Veracode, Google DORA, Stack Overflow, YC W25, 7 arXiv papers)

**12 Hardening Fixes (from 2 audit rounds):**
1. Guardian cache with djb2 hash + inflight dedup + 200-entry cap
2. Unified artifact tracking (removed disconnected artifactRegistry, use projectStore)
3. messagesRef pattern for stable handleArtifactRendered callback
4. Diff view race condition — getPreviousContent via getState() after onRendered
5. Project Panel dark mode (16 rules) + e-ink (11 rules)
6. Stabilized projectStore selector in EnginePage (select registerFile only)
7. DiffEngine 2000-line guard with naive fallback
8. ProjectStore localStorage cap (strip content, last 10 convos)
9. reviewCache 200-entry cap with batch eviction
10. Empty content guards on ProjectPanel display/downloads/formatManifest
11. merge function preserves in-memory content over persisted empty versions
12. useChatEngine formatProjectManifest selector (was whole store)

**Decision: No free/pro tiering on new features.** Message limit (20/day) is the conversion lever. Gating $0-cost features or safety features (Guardian) would undermine the sovereign AI brand and the white paper's thesis.

- Commit: `673638c26`
- Shipped via 6-gate pipeline — all gates PASS
- JS: 93KB gzip | CSS: 39KB gzip | 1080 modules

#### Comprehensive Legal Update — 20 New Clauses
Researched industry standards (EU AI Act, GDPR, CCPA/CPRA, updated COPPA, AI SaaS best practices) and identified 20 gaps across ToS and Privacy Policy. Implemented all of them:

**Terms of Service (10 new clauses):**
1. AI interaction disclosure (EU AI Act compliance)
2. Operator IP protection clause
3. AI-generated content IP disclaimer (post-NYT v. OpenAI)
4. Account suspension/termination rights
5. Service availability + force majeure
6. Limitation of liability with cap (12-month fees or $100)
7. User indemnification
8. 30-day modification notice period
9. Governing law (California) + LA County jurisdiction
10. Binding arbitration (AAA) + class action waiver + severability + entire agreement

**Privacy Policy (10 new disclosures):**
1. Automated decision-making transparency (agent routing, rate limiting, memory extraction, convergence)
2. Cookie/localStorage disclosure (JWT, Zustand, PostHog, OAuth flags)
3. PostHog, Sentry, Resend disclosed as sub-processors (with privacy policy links)
4. Sub-processor DPA references
5. International data transfers (US hosting, SCCs, EU-US DPF)
6. Encryption at rest (AES-256 via Supabase/AWS)
7. Data breach notification commitment (72h)
8. Right to restrict processing + automated decision rights (GDPR Art. 18 & 22)
9. Per-activity GDPR legal basis mapping (contract, consent, legitimate interest)
10. Expanded COPPA procedures (suspension, deletion steps, parent notification)

- Also expanded CCPA→CPRA coverage, added 30-day change notice, data controller identification
- Commit: `5a4b21e18` (shipped via 6-gate pipeline)

#### Legal Accuracy Audit — Full Codebase Verification
Ran 5 parallel verification agents against every claim in both legal documents. Results:

**Verified as accurate (no changes needed):**
- All 9 security claims (TLS, JWT, RLS, rate limits, SSRF, audit logs, AES-256, input validation, server-side count protection)
- All 5 deletion paths (conversations, memory, knowledge graph, goals, account)
- 20 messages / 24h rolling window (`FREE_LIMIT = 20` + `027_24h_rolling_window.sql`)
- Stripe integration (no card data stored locally)
- Agent routing via Haiku, memory extraction, convergence synthesis
- Zustand store name `sovereign-kernel`, legal agreement at signup, shared conversations read-only

**Fixed — 3 sub-processor disclosure errors:**
1. **Removed Perplexity** — was never used; web search uses Claude's built-in `web_search_20250305` tool
2. **Added OpenAI** — transcription (Whisper API), TTS, and optional LLM provider (GPT-4o)
3. **Added Google + NVIDIA** — optional Gemini and Llama LLM providers available in claude-proxy
4. **Clarified multi-provider data flow** — alternative providers only receive data when user explicitly selects their models

- Commit: `0fe9f5300` (deployed, HTTP 200 confirmed)

#### Earlier This Session: Backlog Sweep + Thinking Toggle
- Backlog sweep: animation tokens, design polish, convergence UI (all resolved), dep updates (9 packages), MCP dotenv fix, share link preview research
- Thinking toggle redesign: concentric-ring icon, circular 40px button, pulse animation
- Commits: `4bfe5432b`, `a4cf62c99` (both shipped earlier today)

---

## Previous Session (2026-02-25)

### Accomplished

#### Pro Features — E2E Testing & Bug Fixes
Built and tested 6 Pro features. Found and fixed 3 critical bugs:
- **Bug 1**: Pro users blocked from document/image analysis — gating checks outside `isFreeUser` block
- **Bug 2**: File content lost when routed through swarm/workflow — `ContentBlock[]` guard added
- **Bug 3**: AgenticWorkflow url_fetch receiving descriptions instead of URLs — enrichment + regex fix
- Commit: `a35819b1d`

#### Tier Features & Web Search for Free Users
- Web search enabled for free users, updated all 24 locale auth.json files, home.json upgrade features
- Commit: `917ea2def`

#### i18n Cache Busting
- `__BUILD_TIME__` define + `queryStringParams` in i18next-http-backend
- Commit: `063895a16`

#### Email Announcement
- Sent e-ink styled product update email to all 32 users via Resend

---

## Previous Session (2026-02-24)

### Accomplished
- Full system debug audit — 27 bugs found & fixed (7 critical, 11 medium, 9 low)
- Privacy Policy, Terms of Service & user agreement flow
- Convergence — multi-agent perception synthesis (6 facet lenses)
- Free-tier daily message limit (20/24h rolling window)
- Unified 50MB upload limit + Claude proxy fix

---

## Previous Sessions (2026-02-17 to 2026-02-23)

### Accomplished
- Account settings, onboarding redesign, set new password flow
- Conversation search, backend hardening, Pro usage dashboard
- Entity system 32-bit upgrade, ChatGPT import
- P1-P14: Dark mode, test suite, panels, i18n, artifacts, agent audit, Discord bot, Stripe, design overhaul, mobile audit, writing audit, usage tracking

---

## Ongoing Backlog

- **All prior work items**: DONE (P1-P15, backend, accounts, legal, convergence, limits, Pro features, thinking toggle, animation tokens, design polish, dep updates, MCP dotenv fix, legal compliance overhaul, legal accuracy audit, vibe coding R&D, landing page redesign, data export, insights fixes)
- **Data export endpoint**: DONE — Deployed, E2E verified. `/export-user-data` edge function + "Export my data" button in Account Settings. Rate limit confirmed working (429 on repeat).
- **Supabase CLI migration history**: OUT OF SYNC — 29 remote migrations not found locally. `supabase db push` fails. Workaround: use Supabase MCP `apply_migration` tool directly. To fix permanently: run `supabase db pull` to sync local migration files with remote.
- **API key rotation**: Anthropic key rotated 2026-02-26 evening. Google key also rotated by user. Old keys redacted from `.claude/prompt-log.txt`.
- **Share link OG proxy**: Built and deployed as Cloudflare Worker (`kernel-og-proxy`). Share URLs now use `/s/{uuid}` format. Worker intercepts crawler UAs (Twitterbot, Discord, etc.) and returns OG meta tags; humans get 302 redirect to `/#/shared/{uuid}`. **PENDING: DNS propagation** — kernel.chat nameservers need to switch from GoDaddy (`domaincontrol.com`) to Cloudflare. Once propagated, Worker routes activate automatically.
- **Dep updates held**: framer-motion v12 + lucide-react v0.575 (breaking changes, need testing)
- **Comped Pro — siijoseph333@gmail.com**: Active until 2026-03-27. Auto-expiration in task-scheduler will handle it. No manual action needed.
- **Discord webhook MCP**: Was working, now returning 401 as of 2026-02-26 evening. Webhook URL in `.env` may need refresh.
- **Future Pro candidate**: Server-side project persistence (Supabase Storage for files that survive page reload + work across devices). Has real infrastructure cost — natural Pro feature when needed.

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
- Thinking toggle: Concentric-ring icon (`IconThinking`), circular 40px button matching voice button, pulse animation when active, `IconBrain` (stacked layers) kept for menu
- Animation tokens: `src/constants/motion.ts` (JS) synced with CSS custom properties in `:root`. All CSS transitions must use `var(--duration-*)` and `var(--ease-*)` — no hardcoded values.
- MCP dotenv: Always use `config({ path: resolve(__dirname, '..', '.env') })` — never bare `config()`.
- Share link previews: Cloudflare Workers as crawler-aware proxy (recommended approach for GH Pages + hash routing)
- Legal compliance: ToS governed by California law, LA County courts, AAA arbitration, class action waiver. Privacy Policy maps GDPR legal bases per activity, 72h breach notification, full sub-processor disclosure (Supabase, Anthropic, OpenAI, Google, NVIDIA, Stripe, PostHog, Sentry, Resend).
- Multi-provider LLM: claude-proxy supports Anthropic (default), OpenAI, Google Gemini, NVIDIA Llama. Alternative providers only receive data when user explicitly selects their model.
- Image generation: Pro-only, uses Gemini 3.1 Flash Image (`gemini-3.1-flash-image-preview` / Nano Banana 2). ~$0.039/image cost bundled into $20/mo Pro. Rate limit 10/min. AgentRouter detects intent via `needsImageGen` flag. No per-image billing — subscription covers it.
- Subscription expiration: task-scheduler checks every 5 min for `current_period_end < now()`, sets `status = 'inactive'`, sends in-app notification. Stripe-managed subs unaffected (renewed before expiry). Comped Pro uses this path.
- Landing page: ParticleGrid is the visual identity. Hero = full-bleed canvas + frosted glass overlay. Feature cards = 120px energetic mini-grids (IO-gated). Auth modal = 72px energetic grid. Pro card = CSS `@keyframes` cycling 5 agent colors over 14s. Canvas can't read CSS vars — agent palette hex values are hardcoded in JS (architectural constraint).

## Test Accounts

- **Free**: `kernel-test-bot@antigravitygroup.co` — password in .env
- **Pro**: `kernel-pro-test@antigravitygroup.co` — password in .env
