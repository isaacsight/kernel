# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-26, latest)

### Accomplished This Session

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

- **All prior work items**: DONE (P1-P15, backend, accounts, legal, convergence, limits, Pro features, thinking toggle, animation tokens, design polish, dep updates, MCP dotenv fix, legal compliance overhaul, legal accuracy audit)
- **Data export endpoint**: Policy promises "request a copy in a structured format" but currently requires manual email. Build `/export-user-data` edge function for automated GDPR/CCPA portability.
- **Share link previews**: Research done — Cloudflare Workers recommended. Implementation is a separate project (~2-4h). Not yet built.
- **Dep updates held**: framer-motion v12 + lucide-react v0.575 (breaking changes, need testing)
- **Discord webhook MCP**: Code fix shipped (`4bfe5432b`), but requires MCP server restart to take effect. Verify after restart.
- **Known limitations**: Claude/Gemini share links produce blank previews (CSR — no server-side content). Fix: Cloudflare Workers proxy (see research above).

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

## Test Accounts

- **Free**: `kernel-test-bot@antigravitygroup.co` / `KernelTest2026!`
- **Pro**: `kernel-pro-test@antigravitygroup.co` / `KernelProTest2026`
