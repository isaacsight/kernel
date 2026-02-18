# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-17, afternoon)

### Accomplished This Session

#### 1. Mobile UX Polish — Antigravity Audit CSS Fixes (DEPLOYED)
All changes in `src/index.css`, deployed to GitHub Pages.

**P0 — Critical:**
- Drag handle: `56px` wide, `6px` tall, `0.4` opacity (was 48/5/0.25)
- Header icons `.ka-header-icon-btn`: `40x40` touch targets (was 32x32)
- `.ka-header-right` gap: `8px` desktop, `6px` mobile (was 6/4)
- `.ka-msg-action-btn`: `36x36` (was 28x28)
- `.ka-goal-action-btn` + `.ka-share-expiry-btn`: padding `8px 14px`, font `12px` (was 4px 10px / 11px)
- `.ka-msg-bubble` padding: `16px 20px` (was 14px 18px)
- Kernel bubble line-height: `1.7` (was 1.6), user bubble: added `line-height: 1.5`
- `.ka-agent-badge`: `0.6rem` + `opacity: 0.85` (was 0.5rem)
- Form spacing (`.ka-goal-form`, `.ka-sched-form`, `.ka-wf-builder`): gap `12px` (was 8px)

**P1 — High:**
- `.ka-input` border: `rgba(100,100,100, 0.2)` (was `var(--rubin-ivory-dark)`)
- `.ka-input::placeholder` opacity: `0.45` (was 0.35)
- `.ka-msg` margin-bottom: `24px` (was 20px)

**P2 — Easy wins:**
- `.ka-upgrade-overlay` bg alpha: `0.72` (was 0.6)
- Dark mode: added `[data-theme="dark"] .ka-input::placeholder` and `[data-theme="dark"] .ka-notif-empty`
- `.ka-wf-card-delete` already had `color: #DC2626` — no change needed

#### 2. Panel Overlay + Empty State Fixes (DEPLOYED)
- `.ka-kg-overlay` bg: `rgba(0,0,0, 0.55)` (was 0.4) — darker scrim, chat no longer bleeds through
- Empty state text opacity (`.ka-goals-empty`, `.ka-wf-empty`, `.ka-sched-empty`, `.ka-brief-empty`): `0.7` (was 0.5)
- `.ka-kg-header` border-bottom: `rgba(0,0,0, 0.1)` (was 0.06)
- `.ka-kg-panel` box-shadow: `rgba(0,0,0, 0.25)` (was 0.15)

#### 3. Playwright Config
- Changed `.mcp.json` Playwright from `--headless` to headed mode (takes effect on next session restart)

#### 4. Site Audit via Playwright (partial)
Walked through: gate screen, conversation drawer, chat bubbles, menu dropdown, Share modal, Goals panel + form, Stats panel, KG panel. All looked clean after fixes.

---

### PENDING: Navigation & Feature Discovery Overhaul

A thorough UX audit identified **7 major navigation issues**. This is the next big task:

#### The Audit Findings (from user's Antigravity walkthrough):

1. **Hidden Menu System** — Features (Goals, Workflows, Scheduled Tasks, Briefings, KG, Stats) are buried in kebab menu. No persistent visual hierarchy.
2. **No Clear Way Back to Home** — "Kernel Agent" text isn't clickable. Users feel trapped in conversations.
3. **Unclear Feature Discovery** — Features split across hamburger (conversations) and kebab (everything else). Users won't find them.
4. **Empty State Confusion** — Generic messages don't guide users on *how* to use features or *why* they matter.
5. **Inconsistent Visual Feedback** — ADMIN badge purpose unclear, missing hover states, no smooth transitions.
6. **Briefing Navigation Issues** — Long-form page with no TOC, anchor links, or section navigation.
7. **Hard to See What's Interactive** — Briefing tags, conversation titles lack visual distinction as clickable elements.

#### Recommended Implementation Order:
1. **Bottom tab bar** with main features (Conversations, Goals, Workflows, Briefings, Stats) — solves #1, #3, and partially #2
2. **Clickable header logo/text** as home button — solves #2
3. **Empty state improvements** with actionable CTAs and guidance — solves #4
4. **Hover states & visual indicators** for all interactive elements — solves #5, #7
5. **Briefing TOC** with section anchors — solves #6
6. **Onboarding tooltips** for first-time feature encounters — solves #3

#### What's Working Well:
- Quick-start prompts on home screen
- Conversation sidebar when opened
- Dark mode toggle
- Core chat UX (after our CSS fixes)

---

## Previous Session (2026-02-17, morning)

### Accomplished
- **Implemented all 6 Sticky Features** from the Kernel retention plan:
  1. **Document Analysis** — File size validation, FilePreview, attachments column, AgentRouter file detection
  2. **Shared Conversations** — ShareModal, SharedConversationPage, shared-conversation edge function
  3. **Goal Tracking** — GoalsPanel, GoalTracker engine, goal context in system prompt
  4. **Workflows** — WorkflowsPanel + WorkflowBuilder, enhanced ProceduralMemory
  5. **Recurring Tasks** — ScheduledTasksPanel, NotificationBell, Scheduler engine, edge functions
  6. **Daily Briefings** — BriefingPanel, BriefingPage, BriefingGenerator
- 6 migrations (011-016), 3 edge functions, 29 files changed, committed as `38c9a844`

---

## Ongoing Backlog

- **Set up external cron** for task-scheduler edge function (GitHub Actions, every 5 min)
- **P1: Unify intent classification** — converge on AgentRouter as single source of truth
- **P2: Implement think() or remove dead code** — returns null, still called in cognitive loop
- **P2: Haiku-based reflection scorer** — for high-complexity queries
- **P3: Split AIEngine.ts** — 1,461 lines, could decompose into sub-modules
- **P3: Add test suite** — perception, attention, reflect are pure functions, zero tests exist

## Key Decisions Made

- Bottom-sheet pattern for all panels (Goals, Workflows, Scheduled, Briefings)
- Haiku-based progress extraction for goals (every 3 messages)
- BriefingGenerator reuses DeepResearch pipeline
- Real-time notifications via Supabase realtime subscription
- verify_jwt=false for shared-conversation, task-scheduler, send-notification
- Write-through pattern: localStorage fast, Supabase durable backup
- Dynamic import of SupabaseClient in AIEngine (avoids circular deps)
