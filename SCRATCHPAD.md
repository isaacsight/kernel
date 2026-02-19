# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-18)

### Accomplished This Session

#### 1. Empty State CTAs (3 panels)
Replaced generic empty state text in GoalsPanel, WorkflowsPanel, ScheduledTasksPanel with structured empty states:
- Icon (48px, 0.35 opacity) + title (serif 1.15rem) + description (mono 0.78rem) + CTA button
- Shared `.ka-empty-state` CSS class system with dark mode support
- CTA buttons open the corresponding form (goal form, workflow builder, task form)

#### 2. Hover States & Visual Indicators (CSS)
- `.ka-goal-card-header:hover` — subtle bg highlight with border-radius
- `.ka-brief-tab:hover:not(.active)` — bg highlight for non-active tabs
- `.ka-wf-card-delete:hover` — red bg highlight
- `.conv-item:hover` / `.conv-item--active` — strengthened from `var(--rubin-ivory-med)` to `rgba()` with dark mode variants
- Dark mode variants for all new hover states

#### 3. Unified Intent Classification
- `perception.ts:classifyIntent()` — trimmed 70-line keyword switch to 10-line minimal fallback; AgentRouter is single source of truth
- `swarm.ts:routeToAgent()` — trimmed 25-line keyword block to 10-line minimal fallback
- Removed unused `ReasoningDomain` import from perception.ts
- Updated perception.test.ts: replaced `reason` intent tests with `evaluate` + added AgentRouter integration tests
- All 145 tests pass

#### 4. SCRATCHPAD Cleanup
- Removed completed backlog items (cron, think(), split AIEngine)
- Updated backlog to reflect current state

---

## Previous Session (2026-02-17, afternoon)

### Accomplished
- **Mobile UX Polish** — CSS fixes for touch targets, spacing, opacity, line-height (deployed)
- **Panel Overlay + Empty State Fixes** — darker scrim, improved empty state opacity (deployed)
- **Playwright Config** — switched to headed mode
- **Site Audit via Playwright** — partial walkthrough, all clean after fixes

### Navigation & Feature Discovery Overhaul (PENDING)

UX audit identified **7 major navigation issues**:

1. **Hidden Menu System** — Features buried in kebab menu
2. **No Clear Way Back to Home** — Header text not clickable
3. **Unclear Feature Discovery** — Features split across hamburger/kebab
4. ~~**Empty State Confusion**~~ — **DONE** (this session)
5. ~~**Inconsistent Visual Feedback**~~ — **DONE** (this session, hover states)
6. **Briefing Navigation Issues** — Already solved (BriefingPage has TOC)
7. ~~**Hard to See What's Interactive**~~ — **DONE** (this session, hover states)

**Remaining navigation work:**
1. Bottom tab bar with main features (Conversations, Goals, Workflows, Briefings, Stats)
2. Clickable header logo/text as home button
3. Onboarding tooltips for first-time feature encounters

---

## Previous Session (2026-02-17, morning)

### Accomplished
- Implemented all 6 Sticky Features (Document Analysis, Shared Conversations, Goal Tracking, Workflows, Recurring Tasks, Daily Briefings)
- 6 migrations (011-016), 3 edge functions, 29 files changed

---

## Ongoing Backlog

- **P1: ~~Unify intent classification~~** — **DONE** (AgentRouter is single source of truth)
- **P2: Haiku-based reflection scorer** — for high-complexity queries
- **P3: Add test suite** — perception, attention, reflect are pure functions (perception now has 19 tests)

## Key Decisions Made

- Bottom-sheet pattern for all panels (Goals, Workflows, Scheduled, Briefings)
- Haiku-based progress extraction for goals (every 3 messages)
- BriefingGenerator reuses DeepResearch pipeline
- Real-time notifications via Supabase realtime subscription
- verify_jwt=false for shared-conversation, task-scheduler, send-notification
- Write-through pattern: localStorage fast, Supabase durable backup
- Dynamic import of SupabaseClient in AIEngine (avoids circular deps)
- AgentRouter (Haiku API) is single source of truth for intent classification; keyword matching is minimal fallback only
