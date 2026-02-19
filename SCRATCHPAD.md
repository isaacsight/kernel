# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-19)

### Accomplished This Session

#### 1. Discord Bot Feature Parity (`tools/discord-bot.ts`)

**Enhanced Classification**
- `classifyIntent()` now returns full `ClassificationResult` object: `{ agentId, confidence, needsResearch, needsSwarm, isMultiStep }`
- Classification system prompt updated to match web app's AgentRouter (9 agents → 5 for Discord, but full routing flags)
- `callClaude()` now accepts `options?: { web_search?: boolean }` parameter

**Pro Feature Gating**
- `getUserSubscription()` — checks `subscriptions` table for linked Discord users
- Research/swarm/tasks gated behind Pro; free users get standard chat + web search for researcher

**Deep Research Pipeline** (`discordDeepResearch()`)
- Plan → parallel search (web_search: true) → grade relevance → synthesize (sonnet)
- Same multi-step pattern as web app's `DeepResearch.ts`

**Swarm Orchestration** (`discordRunSwarm()`)
- Select 2-4 agents (haiku) → parallel contributions → synthesize (sonnet)
- 7-agent pool: kernel, researcher, coder, writer, analyst, reasoner, critic

**Multi-Step Tasks** (`discordPlanAndExecute()`)
- Plan decomposition (haiku) → sequential execution → final synthesis (sonnet)
- Each step routed to appropriate specialist

**Knowledge Graph Extraction** (`extractAndSaveKG()`)
- Runs every 3 messages for linked users (piggybacks on memory extraction interval)
- Extracts entities + relations → upserts to `knowledge_graph_entities` and `knowledge_graph_relations`
- Data appears in web app KG panel for linked users

**Goal Commands**
- `!goal add <title>` — create goal
- `!goal list` — show active goals with progress/priority
- `!goal done <id>` — complete a goal
- `!goal check` — AI-powered check-in conversation

**Briefing Command** (`!briefing`)
- Generates personalized briefing using user memory + KG entities
- Web search enabled for current events

**Share Command** (`!share`)
- Creates entry in `shared_conversations` table
- Returns `kernel.chat/#/shared/{id}` link

**Help Command** (`!help`)
- Lists all available commands

**Updated Message Flow**
```
classify → check Pro → route (research/swarm/tasks/standard) → respond → background (memory + KG)
```

#### 2. Intelligence Transparency Panel (`src/components/InsightsPanel.tsx`)

New bottom-sheet panel with 5 tabbed sections:

1. **"How I See You"** (World Model) — apparent goal, communication style badge, expertise badge, situation summary, conviction gauge with trend arrow
2. **"What I Believe"** (Beliefs) — sorted by confidence, confidence bars, source badges, challenge/reinforced counts, challenge & dismiss actions
3. **"My Memory"** (Profile) — interests, goals, facts, preferences from MemoryAgent, communication style badge
4. **"How I'm Performing"** (Reflections) — average quality score (big number), 5-dimension bars (substance/coherence/relevance/brevity/craft), expandable recent lessons, pattern notes
5. **"Agent Performance"** — ranked by quality, dual bars (quality vs usage)

**Integration:**
- `usePanelManager.ts` — added `showInsightsPanel` state + `'insights'` action routing
- `MoreMenu.tsx` — added `'insights'` to `MoreAction` type + Eye icon menu item
- `EnginePage.tsx` — wired InsightsPanel in BottomSheet, added to header kebab menu
- `src/index.css` — full InsightsPanel CSS with dark mode variants
- `public/locales/en/panels.json` — 40+ translation keys for all sections
- `public/locales/en/home.json` — added `menu.insights` key

**Props:** receives `engineState`, `userMemory`, `onChallengeBelief`, `onRemoveBelief`, `onClose`
**Engine interaction:** challenge/remove beliefs via `engine.challengeBelief()` / `engine.removeBelief()`

#### Verification
- `npx tsc --noEmit` — clean
- `npm run build` — builds successfully
- `npx vitest run` — all 145 tests pass

---

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

- **P2: Haiku-based reflection scorer** — for high-complexity queries
- **P3: Add test suite** — perception, attention, reflect are pure functions (perception now has 19 tests)
- **P4: Locale translations** — InsightsPanel keys added for English only; needs 23 other locales

## Key Decisions Made

- Bottom-sheet pattern for all panels (Goals, Workflows, Scheduled, Briefings, Insights)
- Haiku-based progress extraction for goals (every 3 messages)
- BriefingGenerator reuses DeepResearch pipeline
- Real-time notifications via Supabase realtime subscription
- verify_jwt=false for shared-conversation, task-scheduler, send-notification
- Write-through pattern: localStorage fast, Supabase durable backup
- Dynamic import of SupabaseClient in AIEngine (avoids circular deps)
- AgentRouter (Haiku API) is single source of truth for intent classification; keyword matching is minimal fallback only
- Discord bot uses direct `callClaude()` (service key), not `getProvider()` (browser-only)
- InsightsPanel receives engineState as prop from useChatEngine (no extra subscription needed)
