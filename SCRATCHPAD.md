# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-20, late night)

### Accomplished This Session

#### 1. Writing Audit — Platform-Wide Copy Review (P8)
- **6 locale files rewritten** — canonical vocabulary applied everywhere:
  - "Kernel" (not "kernel"), "Deep research" (not "Deep research mode"), "Persistent memory" (not "knowledge graph"), "10 messages to start" (not "10 free messages"), "File creation & download" (not "File generation")
- **Warm, human error messages** — "Couldn't save that goal. Try again." instead of "Failed to add goal" across all panels (goals, workflows, scheduled, briefings, share, stats)
- **Sentence-case empty states** — "Set your first goal" not "Set Your First Goal"
- **i18n extraction** — ConversationDrawer.tsx (9 hardcoded strings → `t()` calls with new `conversations.*` and `relativeTime.*` keys), GoalsPanel.tsx (3 placeholders), EnginePage.tsx (2 brand name fixes)
- **Agent prompt cleanup** — removed stale "knowledge current to early 2025" cutoff, sharpened topic labels ("Think with me", "What's happening today?", "Surprise me")
- **`2032a2f8`** — feat: Writing audit — canonical vocabulary, warm tone, i18n extraction

#### 2. Previous: Usage Cost Tracking & Discord Alerts
- `usage_logs` table, token extraction in 4 providers, $5/day Discord alerts
- `f659e582` — feat: Usage cost tracking with Discord alerts + Opus model support

#### 3. Previous: Auto Model Selection by Complexity
- AgentRouter complexity score → Opus/Sonnet/Haiku routing
- `905ef811` — feat: Auto model selection — engine picks opus/sonnet/haiku by complexity

#### Deployed
- All commits pushed to `origin/main`, deployed to kernel.chat

### Key Lesson
Always deploy Supabase edge functions with `--no-verify-jwt`. The proxy does its own JWT validation internally. Without this flag, the Supabase relay rejects valid ES256 JWTs before they reach the handler code.

---

## Previous Session (2026-02-20, late night / 2026-02-21 early morning)

### Accomplished
- Artifact System Overhaul (Prism.js, live preview, download all, MIME types)
- Agent Audit & Cleanup (23 → 17 agents, 440+ lines removed)
- 3/3 Artifact Generation Fix (specialist routing + auto-artifact)
- `f67c2cf9`, `8d631474` — pushed and deployed

## Previous Session (2026-02-19, late night)

### Accomplished
- Dark Mode Audit & Fixes (~70% → ~95% coverage, system preference, transitions)
- `ce79e1d3` — feat: Dark mode audit

## Previous Session (2026-02-20, evening)

### Accomplished
- Haiku-based Reflection Scorer, Test Suite Expansion (184 tests), InsightsPanel i18n Fix, Mini Phone Layout

## Previous Session (2026-02-20, earlier)

### Accomplished
- Feature Discovery Tooltips, Discord Bot Fixes, Stripe Webhook Hardening, Artifact Branch Merge

## Previous Sessions (2026-02-17 to 2026-02-19)

### Accomplished
- Discord Bot Feature Parity, InsightsPanel, 24 locale translations
- Empty State CTAs, Hover States, Unified Intent Classification
- Mobile UX Polish, 6 Sticky Features, Playwright Config

---

## Ongoing Backlog

- **P1–P5**: All DONE (mini phone, dark mode, reflection scorer, tests, locales)
- **P6: Artifact system** — DONE (3/3 generation, auto-artifact, syntax highlighting, preview)
- **P7: Agent cleanup** — DONE (23 → 17, dead code removed, routing fixed)
- **P8: Writing audit** — DONE (canonical vocabulary, warm tone, i18n extraction across 10 files)
- **P9: Usage cost tracking** — DONE (usage_logs, Discord alerts, $5/day threshold)
- **P10: Opus + auto model selection** — DONE (complexity-based routing)

## Key Decisions Made

- Bottom-sheet pattern for all panels (Goals, Workflows, Scheduled, Briefings, Insights)
- Haiku-based progress extraction for goals (every 3 messages)
- AgentRouter (Haiku) is single source of truth; keyword matching is minimal fallback
- AgentSelection uses SPECIALISTS directly (not swarm mapping) when router confidence >= 0.7
- Auto-artifact: >= 8 lines + known language → inferred filename → artifact card
- Dynamic filename extraction from user messages for explicit ordering
- Dark mode: `data-theme` on `<html>`, token overrides, `useDarkMode()` hook
- Reflection scorer: 60/40 AI/heuristic blend, rubric system prompt, intent-aware weights
- Free tier: 10 messages (enforced in claude-proxy edge function)
- Auto model selection: complexity >= 0.85 → Opus, <= 0.2 → Haiku, else Sonnet
- Usage tracking: fire-and-forget INSERT after every API call, $5/day Discord alert
- Edge function deploys: ALWAYS use `--no-verify-jwt` flag
- Writing audit canonical vocabulary: "Kernel", "Deep research", "Persistent memory", "10 messages to start"
