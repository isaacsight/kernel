# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-03-09)

### Accomplished This Session

#### K:BOT Major Update + Security Audit + Cloud Engine

**K:BOT CLI Improvements:**
- Particle grid ASCII art banner — terminal translation of kernel.chat's ParticleGrid visual identity
- Updated all 14 providers with `models` arrays (full model catalogs)
- Updated defaults: OpenAI → gpt-4.1, Google → gemini-2.5-pro
- Added missing models: claude-opus-4-6, o3, o4-mini, deepseek-reasoner, codestral, sonar-reasoning
- Ollama: 30+ open-weight models listed, improved task-based routing (deepseek-r1, qwen2.5-coder:32b, gemma3:27b)
- Silent auto-update system: checks npm on startup → installs in background → zero user action
- `kbot update` explicit command for manual updates
- `kbot-engine` edge function — cloud backend for kbot CLI (proxy, sync, route, usage, health, models)

**Security Audit — PASS (0 P0, 0 P1):**
- Full platform scan: 0 secrets in src/, 46/46 edge functions auth-verified, 0 eval/Function
- K:BOT security hardening: fixed shell injection in glob/grep, plugin directory permission checks, case-insensitive destructive patterns + piped command detection
- npm audit: 0 critical, 0 prod vulnerabilities (17 dev-only)

**kernel.chat Landing Page:**
- K:BOT CLI section with animated terminal mockup and install instructions
- Account settings: K:BOT install card with copy-to-clipboard command

**kbot-engine Edge Function:**
- `/proxy` — multi-provider LLM proxy (Anthropic, OpenAI, Google, Groq)
- `/sync` — persist learning data across machines (kbot_memory table)
- `/route` — fast agent classification via Groq
- `/usage` — usage tracking
- `/health` + `/models` — provider status and model catalog
- Migration 077: kbot_memory table with RLS

**Deployments (completed this session continuation):**
- kbot-engine edge function deployed — healthy (200 OK, Anthropic + Groq live)
- kbot_memory table created on remote (RLS, indexes, grants applied)
- All migrations 073-078 verified applied on remote
- Repaired migration history (5 orphaned remote versions marked reverted)

**Model Downloads (in progress):**
- qwen2.5-coder:14b, deepseek-r1:14b, gemma3:12b, phi4:14b, llava:13b — downloading sequentially, network stable at ~3.8 MB/s

### Pending
- Wire kbot CLI to connect to kbot-engine for cloud sync
- User asked about "best option for new user" re: Ollama — consider updating landing copy to clarify free local vs cloud options
- Verify all 5 Ollama models downloaded successfully

---

## Previous Session (2026-03-03, continued)

### Accomplished

#### 6-Phase Platform Expansion — ALL PHASES COMPLETE

Implemented, tested, and deployed all 6 phases from the platform expansion plan:

**Phase 1: Conversation Folders** (completed in prior session)
- DB migration `058_conversation_folders.sql`, `useFolders.ts` hook, ConversationDrawer accordion UI
- Move-to-folder submenu in header ⋮ menu, custom folder icons

**Phase 2: Voice Input/Output**
- `useVoiceInput.ts`: Web Speech API primary + MediaRecorder/Whisper fallback
- `useVoiceOutput.ts`: OpenAI TTS (Pro) + browser speechSynthesis (free)
- `useVoiceLoop.ts`: continuous voice conversation mode (Pro only)
- `VoiceLoopOverlay.tsx`: full-screen animated overlay (listening/thinking/speaking)
- Mic button in input bar, TTS speaker button on messages

**Phase 3A: SW Cache Versioning**
- `lazyRetry.ts`: SKIP_WAITING instead of unregistering SW, only clear app-code cache
- `sw.ts`: navigation preload in activate handler

**Phase 3B: Bundle Splitting**
- Converted `manualChunks` from object to function form
- Extracted `vendor-i18n` (22KB gzip) and `vendor-zustand` chunks
- **Main `index.js`: 106KB gzip → 17KB gzip (84% reduction)**

**Phase 3C: E2E Test Suite**
- 15 tests across auth, chat, conversations, dark-mode, pro-gating, mobile
- Playwright fixtures with mock claude-proxy, auth state persistence
- Visual regression tests (light/dark mode screenshots)
- `.github/workflows/e2e.yml` CI workflow
- Total: 28 E2E tests passing

**Phase 4: Collaborative Live Share**
- Migration `059_live_shares.sql`: live_shares + live_share_participants tables
- Edge function `live-share`: create/join/kick/revoke/status
- `useLiveShare.ts`: Supabase Realtime channels + presence tracking
- `LiveShareBadge.tsx`, `ShareModal.tsx` live share tab, `LiveSharePage.tsx`
- Route: `/#/live/:code`

**Phase 5: Team/Workspace Tier**
- Migration `060_teams_workspaces.sql`: workspaces, workspace_members, workspace_invitations
- Edge function `workspace-invite`: invite/accept/revoke/list
- `useWorkspace.ts`, `WorkspaceSwitcher.tsx`, `WorkspaceAdminPage.tsx`
- Route: `/#/workspace/:id`

**Phase 6: Mobile App Wrapper (Capacitor)**
- `capacitor.config.ts`: appId `chat.kernel.app`, push notification config
- `src/utils/platform.ts`: isNativePlatform, getPlatform, isIOS, isAndroid
- `src/hooks/useNativePush.ts`: dynamic import, registration, listeners
- npm scripts: cap:sync, cap:ios, cap:android

#### Deployment Summary
- All commits pushed to `origin/main`
- Frontend deployed to kernel.chat (GitHub Pages)
- DB migrations 059 + 060 applied to Supabase
- Edge functions deployed: `live-share`, `workspace-invite`, `project-files`

#### Test Results
- 420/420 unit tests pass (Vitest)
- 28/28 E2E tests pass (Playwright)
- Zero TypeScript errors
- Clean build

#### Bugs Fixed During Testing
- `gen_random_bytes` → `md5(random())` for Supabase compatibility
- Migration 060 forward reference: reordered tables before policies
- Playwright config: switched to preview server (legacy dir broke dev server)
- `test.use(devices[...])` moved to top level in mobile.spec.ts
- `SpeechRecognition` class declaration added to vite-env.d.ts
- Voice hook ordering: split hooks to avoid block-scoped variable error

---

## Previous Session (2026-03-03)

### Accomplished
- Dark mode tokens (warm brown), removed VITE_GEMINI env vars
- framer-motion → motion upgrade (51 files)
- Server-side project persistence (Pro feature)
- Image gen continuity, lightbox mobile dismiss
- Mobile auth redirect fix (3 root causes)
- PWA cache staleness fixes

---

## Previous Sessions (2026-02-26 to 2026-02-28)

### Accomplished
- Image gen reference images, backlog cleanup, ship pipeline
- Image credit packs, auto-expire comped subscriptions
- Data export, API key rotation, notification UX, landing page redesign

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
- **P1 test fixes** (non-blocking): MoreMenu.test.tsx and BottomTabBar.test.tsx have pre-existing failures (component changed, tests not updated) — actually these now pass after recent changes
- **Capacitor native shells**: Need `npx cap add ios && npx cap add android` to generate native projects (requires Xcode/Android Studio)
- **Capacitor advanced**: Biometric auth, deep linking, App Store submission not yet implemented

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
- Image generation: Credit-gated (not subscription-included), Gemini 2.5 Flash Image. Rate limit 10/min.
- Subscription expiration: task-scheduler checks every 5 min, deactivates expired subs
- Landing page: ParticleGrid visual identity. Canvas can't read CSS vars — hex values hardcoded in JS.
- **OAuth: implicit flow** (`flowType: 'implicit'`), `detectSessionInUrl: false`. Manual token handling in `main.tsx` before React renders. No hardcoded API key fallbacks.
- **SW caching**: `fetchOptions: { cache: 'reload' }` on HTML route bypasses browser HTTP cache. 30-min periodic update check for SPAs.
- **framer-motion → motion**: Rebranded in v12. Import path `'motion/react'`. Drop-in replacement.
- **Project file persistence**: Pro feature. Edge function `project-files` saves to Supabase Storage.
- **Bundle splitting**: Function-form manualChunks. vendor-i18n + vendor-zustand extracted. Main index.js 106KB → 17KB gzip.
- **Live Share**: Supabase Realtime channels for presence + postgres_changes for message sync. Access codes via md5(random()).
- **Workspaces**: 3-role system (owner/admin/member). Invite by email with 7-day expiry. workspace_id on conversations + folders.
- **Voice I/O**: Web Speech API primary, Whisper fallback. Pro TTS via OpenAI edge function, free via speechSynthesis. Voice loop = continuous listen→submit→TTS cycle.
- **Capacitor**: appId `chat.kernel.app`. Dynamic imports for native plugins (avoids bundling for web). ios/ and android/ gitignored.
- **E2E tests**: Playwright with preview server (not dev server — legacy dir breaks Vite scan). Mock claude-proxy via page.route(). Visual regression snapshots.
- **Supabase gen_random_bytes**: Not in default search path. Use `md5(random()::text || clock_timestamp()::text)` instead.

## Test Accounts

- **Free**: `kernel-test-bot@antigravitygroup.co` — password in .env
- **Pro**: `kernel-pro-test@antigravitygroup.co` — password in .env
