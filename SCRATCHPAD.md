# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-20)

### Accomplished This Session

#### 1. Feature Discovery Tooltips
- Created `src/hooks/useFeatureDiscovery.ts` — tracks which features users have opened, persisted in localStorage per user
- Discoverable features: workflows, scheduled, knowledge, stats, insights
- Modified `MoreMenu.tsx` — pulsing dot indicators on undiscovered feature items
- Modified `BottomTabBar.tsx` — dot on "More" tab when undiscovered features exist
- Modified `EnginePage.tsx` — wired hook, passed props to MoreMenu + BottomTabBar + header kebab menu
- Added CSS: `.ka-feature-dot` with `ka-dot-pulse` animation

#### 2. Discord Bot Fixes (`tools/discord-bot.ts`)
- Fixed `!goal` command matching: `content === '!goal' || content.startsWith('!goal ')` (bare `!goal` was missed)
- Fixed `discordPlanAndExecute` fallback: returns accumulated context instead of generic message on final step failure
- Bot tested live — starts, connects, logs in as Capital-Native AI#7115

#### 3. Stripe Webhook Fix (`supabase/functions/stripe-webhook/index.ts`)
- **Root cause**: `JSON.parse(body)` and `createClient()` were outside try-catch; `new Date(undefined * 1000).toISOString()` threw RangeError on invoices missing period data
- Added `safeEpochToISO()` helper — returns null instead of crashing on undefined/NaN
- Moved `JSON.parse(body)` and `createClient()` inside try-catch
- Added explicit validation for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars
- Deployed with `--no-verify-jwt` (Stripe sends webhooks without Supabase JWT)
- Verified: 400 for missing/invalid signatures (correct), no more 500s
- User resent both failed `customer.subscription.updated` events from Stripe dashboard — confirmed working

#### 4. Branch Review: `claude/add-file-artifact-generation-7jvKg`
- Reviewed file artifact system, auth UX, system prompts, free tier copy, CSS
- 10 issues found (2 medium, 1 high merge conflict, rest low/info)
- Key issues: hardcoded English in LoginGate toggle (breaks i18n), branch deletes feature discovery (merge conflict), regex edge cases, duplicated FILE ARTIFACTS prompt in kernel.ts vs specialists.ts

#### Commits
- `1aa1a007` — feat: Add feature discovery tooltips + fix Discord bot issues
- `6d1ea8bc` — fix: Harden stripe-webhook against unhandled crashes causing 500s

---

## Previous Session (2026-02-19)

### Accomplished
- Discord Bot Feature Parity (deep research, swarm, multi-step tasks, KG extraction, goals, briefings, share, help)
- InsightsPanel (5 tabbed sections: world model, beliefs, memory, reflections, agent performance)
- Locale translations for all 24 locales (InsightsPanel keys)
- Deployed and pushed

## Previous Session (2026-02-18)

### Accomplished
- Empty State CTAs (3 panels), Hover States, Unified Intent Classification, SCRATCHPAD Cleanup

## Previous Session (2026-02-17, afternoon)

### Accomplished
- Mobile UX Polish, Panel Overlay + Empty State Fixes, Playwright Config, Site Audit

## Previous Session (2026-02-17, morning)

### Accomplished
- Implemented all 6 Sticky Features (Document Analysis, Shared Conversations, Goal Tracking, Workflows, Recurring Tasks, Daily Briefings)

---

## Ongoing Backlog

- **P1: Merge artifact branch** — `claude/add-file-artifact-generation-7jvKg` needs fixes (hardcoded English, merge conflict with feature discovery) before merging
- **P2: Haiku-based reflection scorer** — for high-complexity queries
- **P3: Add test suite** — perception, attention, reflect are pure functions (perception now has 19 tests)
- **P4: Locale translations** — InsightsPanel keys added for English only; needs 23 other locales

## Key Decisions Made

- Bottom-sheet pattern for all panels (Goals, Workflows, Scheduled, Briefings, Insights)
- Haiku-based progress extraction for goals (every 3 messages)
- BriefingGenerator reuses DeepResearch pipeline
- Real-time notifications via Supabase realtime subscription
- verify_jwt=false for shared-conversation, task-scheduler, send-notification, stripe-webhook
- Write-through pattern: localStorage fast, Supabase durable backup
- Dynamic import of SupabaseClient in AIEngine (avoids circular deps)
- AgentRouter (Haiku API) is single source of truth for intent classification; keyword matching is minimal fallback only
- Discord bot uses direct `callClaude()` (service key), not `getProvider()` (browser-only)
- InsightsPanel receives engineState as prop from useChatEngine (no extra subscription needed)
- Feature discovery persisted per-user in localStorage, dots on MoreMenu + BottomTabBar
