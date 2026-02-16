# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Last Session (2026-02-16)

### Accomplished
- **P0-1: Engine state persistence to Supabase** — world model + lasting memory now dual-write to localStorage (fast) and Supabase (durable backup via debounced 7s sync)
  - Created `supabase/migrations/007_user_engine_state.sql` — table with RLS, applied live
  - Added `getEngineState()` + `syncEngineState()` to `SupabaseClient.ts`
  - Added `persistState()`, `scheduleSyncToSupabase()`, `setUserId()`, `loadFromSupabase()` to `AIEngine.ts`
  - Replaced all 6 direct `saveWorldModel`/`saveLastingMemory` call sites with `persistState()`
  - Wired auth lifecycle in `EnginePage.tsx` via useEffect
- **P0-2: Discussion mode guardrails** — max 10 turns, quality floor 0.3 avg over 3-turn window, `discussion_stopped` event
- **Updated engine evaluation** — score 7.8 → 8.2/10, P0s marked resolved
- Committed: `95f72dee` — "feat: Sync engine state to Supabase + discussion mode guardrails"
- Pushed to origin/main, deployed to GitHub Pages (verified 200)

### Vite build note
- Build emits a warning: `SupabaseClient.ts is dynamically imported by AIEngine.ts but also statically imported by other files` — this is expected and harmless (dynamic import in AIEngine avoids circular deps, Vite just notes it won't split the chunk)

## Pending Tasks

- **P1: Unify intent classification** — Observer (AIEngine keyword) and Chat (AgentRouter Haiku) use different routing logic; should converge on AgentRouter as single source of truth
- **P1: Parallelize DeepResearch queries** — currently sequential, should use Promise.all like SwarmOrchestrator
- **P2: Implement think() or remove dead code** — returns null, still called in cognitive loop
- **P2: Haiku-based reflection scorer** — for high-complexity queries (complexity > 0.6)
- **P3: Split AIEngine.ts** — 1,461 lines, could decompose into sub-modules
- **P3: Add test suite** — perception, attention, reflect are pure functions, zero tests exist
- **Uncommitted changes remain**: `CLAUDE.md`, `LoginGate.tsx`, `src/index.css` (prior UI work — header menu, textarea, skeleton loading, scroll-to-bottom, stop button)

## Key Decisions Made

- **Separate table** for engine state (`user_engine_state`) vs MemoryAgent profiles (`user_memory`) — different systems, different data shapes
- **Write-through pattern**: localStorage is always the fast source of truth; Supabase is the durable async backup
- **Debounce at 7s**: cognitive cycles fire every message, batching avoids DB hammering
- **Conflict resolution**: higher `totalInteractions` wins (simple last-write-wins with interaction count tiebreaker)
- **Dynamic import** of SupabaseClient in AIEngine: avoids circular deps, keeps engine testable without Supabase
- **Discussion guardrails**: 10 max turns, 0.3 quality floor, 3-turn window — conservative defaults that can be tuned later
