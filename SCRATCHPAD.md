# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-20, evening)

### Accomplished This Session

#### 1. Haiku-based Reflection Scorer (`src/engine/reflection.ts`)
- Added rubric-based system prompt (`REFLECTION_SYSTEM`) with explicit scoring criteria per dimension
- Added `INTENT_WEIGHTS` map — context-aware dimension weights per intent type (reason/evaluate/build/discuss/converse)
- Extracted `computeWeightedQuality()` shared between heuristic and AI-enhanced paths
- AI prompt now includes intent label and uses system prompt instead of bare one-liner
- 8 new tests (context-aware weighting, system prompt passing, out-of-range scores, boilerplate detection, world model updates)

#### 2. Test Suite Expansion
- New `src/engine/MemoryAgent.test.ts` — 14 tests (emptyProfile, formatMemoryForPrompt sections, mergeMemory fallback/dedup/cap)
- 8 new reflection tests in `src/engine/reflection.test.ts`
- **Total: 184 tests across 16 files, all passing**

#### 3. InsightsPanel i18n Fix (`src/components/InsightsPanel.tsx`)
- Fixed 3 hardcoded English strings (lines 174, 177, 186)
- `challengedStat`: "{{count}}x challenged" → `t('insights.challengedStat', { count })`
- `reinforcedStat`: "{{count}}x reinforced" → `t('insights.reinforcedStat', { count })`
- `challengeAction`: "challenge" → `t('insights.challengeAction')`
- Added keys to all 24 locale `panels.json` files with proper translations

#### 4. Mini Phone Layout Spec
- Wrote `specs/mini-phone-layout.md` — comprehensive spec for Gemini to implement
- Covers: header collapse, chat padding, slim input, 3-tab bar, full-screen panels
- Mostly CSS-only approach at `@media (max-width: 389px)`
- Targeting iPhone SE, iPhone Mini, Galaxy S10e

#### Commits
- `aaad4817` — feat: Haiku reflection scorer with rubrics, expand tests, i18n fixes

#### Deployed
- Pushed to `origin/main`, deployed to kernel.chat via `npm run deploy`

---

## Previous Session (2026-02-20, earlier)

### Accomplished
- Feature Discovery Tooltips (useFeatureDiscovery hook, pulsing dots on MoreMenu + BottomTabBar)
- Discord Bot Fixes (!goal command, fallback messages)
- Stripe Webhook Hardening (safeEpochToISO, try-catch around JSON.parse)
- Branch Review + Merge of `claude/add-file-artifact-generation-7jvKg` (artifact cards, auth i18n, regex tightening)

## Previous Session (2026-02-19)

### Accomplished
- Discord Bot Feature Parity (deep research, swarm, multi-step tasks, KG extraction, goals, briefings, share, help)
- InsightsPanel (5 tabbed sections: world model, beliefs, memory, reflections, agent performance)
- Locale translations for all 24 locales (InsightsPanel keys)
- Deployed and pushed

## Previous Session (2026-02-18)

### Accomplished
- Empty State CTAs (3 panels), Hover States, Unified Intent Classification, SCRATCHPAD Cleanup

## Previous Session (2026-02-17)

### Accomplished
- Mobile UX Polish, Panel Overlay + Empty State Fixes, Playwright Config, Site Audit
- Implemented all 6 Sticky Features (Document Analysis, Shared Conversations, Goal Tracking, Workflows, Recurring Tasks, Daily Briefings)

---

## Ongoing Backlog

- **P1: Mini phone layout** — spec written at `specs/mini-phone-layout.md`, handed off to Gemini 3
- **P2: Haiku-based reflection scorer** — DONE (rubrics, context-aware weights, tests)
- **P3: Test suite** — DONE for now (184 tests). Future: component tests, integration tests
- **P4: Locale translations** — DONE (all 24 locales complete including InsightsPanel + auth + beliefs)

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
- Reflection scorer: 60/40 AI/heuristic blend, rubric system prompt, intent-aware weights
