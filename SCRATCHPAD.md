# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-26, latest)

### Accomplished This Session

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

- **All prior work items**: DONE (P1-P15, backend, accounts, legal, convergence, limits, Pro features, thinking toggle, animation tokens, design polish, dep updates, MCP dotenv fix, legal compliance overhaul, legal accuracy audit, vibe coding R&D, landing page redesign)
- **Data export endpoint**: Policy promises "request a copy in a structured format" but currently requires manual email. Build `/export-user-data` edge function for automated GDPR/CCPA portability.
- **Share link OG proxy**: Built and deployed as Cloudflare Worker (`kernel-og-proxy`). Share URLs now use `/s/{uuid}` format. Worker intercepts crawler UAs (Twitterbot, Discord, etc.) and returns OG meta tags; humans get 302 redirect to `/#/shared/{uuid}`. **PENDING: DNS propagation** — kernel.chat nameservers need to switch from GoDaddy (`domaincontrol.com`) to Cloudflare. Once propagated, Worker routes activate automatically.
- **Dep updates held**: framer-motion v12 + lucide-react v0.575 (breaking changes, need testing)
- **Discord webhook MCP**: FIXED — `kernel_notify` confirmed working (ship notification sent successfully 2026-02-26). Direct webhook posting via `4bfe5432b`.
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
- Landing page: ParticleGrid is the visual identity. Hero = full-bleed canvas + frosted glass overlay. Feature cards = 120px energetic mini-grids (IO-gated). Auth modal = 72px energetic grid. Pro card = CSS `@keyframes` cycling 5 agent colors over 14s. Canvas can't read CSS vars — agent palette hex values are hardcoded in JS (architectural constraint).

## Test Accounts

- **Free**: `kernel-test-bot@antigravitygroup.co` / `KernelTest2026!`
- **Pro**: `kernel-pro-test@antigravitygroup.co` / `KernelProTest2026`
