# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-28)

### Accomplished This Session

#### Image Gen Reference Images
Added support for uploaded files/images to be used as reference material when generating images. When a user attaches an image and asks to "draw me..." Gemini receives the uploaded image(s) as style/content guidance alongside the text prompt.

**Modified files:**
- `src/engine/imageGen.ts` — Added `ReferenceImage` type, `referenceImages` param to `generateImage()`, sends as `reference_images` array
- `supabase/functions/image-gen/index.ts` — Accepts `reference_images` array (max 4, 4MB each), adds as Gemini `inlineData` parts, augments prompt with reference context, increased body limit 6MB→20MB, tracks `referenceImageCount` in audit
- `src/hooks/useChatEngine.ts` — Collects reference images from: (1) current message attachments, (2) recent conversation history `imageDataUrls`. Max 4 references.

**E2E verified:** curl test with reference image → HTTP 200, audit log shows `referenceImageCount: 1`. Edge function deployed.

- Commit: `a8025396` (already committed before session started)
- Edge function deployed, frontend deployed to GitHub Pages

#### Backlog Cleanup — 4 Items Resolved

1. **Cloudflare DNS / OG Proxy** — RESOLVED. Nameservers already on Cloudflare (`mcgrory.ns.cloudflare.com`, `jo.ns.cloudflare.com`). OG proxy Worker confirmed active — Twitterbot UA returns proper OG meta tags for `/s/{uuid}` URLs. Was listed as pending but is actually live.

2. **Discord Webhook** — FIXED. Local `.env` URL was valid (HTTP 200). Re-set `DISCORD_WEBHOOK_URL` Supabase secret to ensure edge functions have correct URL. Test notification sent successfully (HTTP 204).

3. **Supabase CLI Migration Sync** — FIXED. Ran 80+ `migration repair` commands (40 reverted remote-only timestamps, 38+ marked applied for local migration files 007-044). `supabase migration list --linked` now shows all migrations synced.

4. **Frontend Deploy** — Done. Published to GitHub Pages, kernel.chat HTTP 200 (301ms).

#### Ship Pipeline — All 6 Gates PASS

- Gate 1 Security: PASS — 0 P0 findings, 4 P1 non-blocking (Gemini key in URL param, dangerouslySetInnerHTML via Prism, VITE_GEMINI_API_KEY type decl, notification action_url)
- Gate 2 QA: PASS — tsc 0 errors, build clean (1084 modules, 2.19s)
- Gate 3 Design: PASS — Rubin compliant. P1: 6 buttons <44px, 3 cool-gray dark tokens
- Gate 4 Performance: PASS — JS 93KB gzip (31%), CSS 41KB gzip (27%), 0 prod vulns
- Gate 5 DevOps: PASS — kernel.chat HTTP 200 (301ms)
- Gate 6 Product: PASS — Home, chat UI, mobile 375px all verified via Playwright

Discord notification sent (204).

---

## Previous Session (2026-02-27)

### Accomplished

#### Image Credit Packs + Auto-Reload + Fixes
Converted image generation from Pro-included to credit-based system with auto-reload. Stripe credit packs (Starter 25/$4.99, Standard 75/$12.99, Power 200/$29.99). Admin bypass via `ADMIN_USER_IDS` env.

#### Comped Pro for siijoseph333@gmail.com
1 month complimentary Pro (expires 2026-03-27). Auto-expiration in task-scheduler.

#### Auto-Expire Comped Subscriptions
task-scheduler checks every 5 min for expired `current_period_end`, deactivates subs.

#### AI Image Generation (earlier)
Built Gemini 2.5 Flash image gen. Credit-gated, rate limited 10/min. AgentRouter detects `needsImageGen` intent.

---

## Previous Session (2026-02-26)

### Accomplished
- Data export endpoint (GDPR/CCPA portability) — E2E verified
- API key rotation (Anthropic + Google)
- Notification UX (auto-read, dismiss, clear all)
- Tooltips + discovery pulse for toggle buttons
- Landing page ParticleGrid redesign
- Vibe Coding R&D — 6 features + white paper + 12 hardening fixes
- Legal update — 20 new clauses (ToS + Privacy Policy)
- Legal accuracy audit — fixed 3 sub-processor disclosure errors
- Backlog sweep + thinking toggle redesign

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

- **Dep updates held**: framer-motion v12 + lucide-react v0.575 (breaking changes, need testing)
- **Comped Pro — siijoseph333@gmail.com**: Active until 2026-03-27. Auto-expiration handles it.
- **Future Pro candidate**: Server-side project persistence (Supabase Storage for files that survive page reload + work across devices). Has real infrastructure cost — natural Pro feature when needed.
- **P1 design items** (non-blocking): 6 buttons below 44px iOS HIG minimum (scroll btn, image download/refine, lightbox close, toggle switch); 3 dark mode tokens use cool neutral grays instead of warm browns (`--dark-bg-surface`, `--dark-bg-deep`, `--dark-border-subtle`)
- **P1 security items** (non-blocking): Remove `VITE_GEMINI_API_KEY` from `src/vite-env.d.ts` to prevent accidental client-side usage

### Resolved This Session
- ~~Share link OG proxy DNS~~ — DONE, Cloudflare nameservers active, Worker intercepting
- ~~Discord webhook 401~~ — FIXED, Supabase secret re-set
- ~~Supabase CLI migration sync~~ — FIXED, 80+ repairs, all migrations aligned
- ~~Image gen reference images~~ — DONE, deployed and verified

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

## Test Accounts

- **Free**: `kernel-test-bot@antigravitygroup.co` — password in .env
- **Pro**: `kernel-pro-test@antigravitygroup.co` — password in .env
