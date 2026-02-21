# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-20, late night)

### Accomplished This Session

#### 1. Mobile UI/UX Audit & Fixes (P11)
- **Playwright-based visual audit** at 390×844 (iPhone 14) — screenshotted 10+ screens across light/dark modes
- **4 panel bottom-cutoff fixes** — KG, Stats, Insights, Share panels were missing 64px tab bar padding
- **Insights panel header** — added missing `.ka-panel-header` CSS (close button was below title, now inline-right)
- **Insights tabs overflow** — hidden scrollbar, smooth horizontal scroll on small screens
- **More menu cutoff** — added tab bar padding + `max-height: 80vh` + `overflow-y: auto` (Delete account was hidden)
- **Dark mode message contrast** — kernel bubbles `#262626` + border, user bubbles `#2E2E2E` + border (was nearly invisible)
- **Topic pills layout** — `max-width: 360px` centering for better wrapping on narrow screens
- **Briefing markdown fix** — `normalizeMarkdown()` ensures `##` headings have blank line separators before truncation
- **Conversation drawer cleanup** — actions hidden on mobile, shown only on active conversation item
- **`a497297c`** — fix: Mobile UI audit — bottom cutoff, dark mode contrast, panel layout

#### 2. i18n Extraction — ErrorBoundary & MessageContent
- **ErrorBoundary.tsx** — extracted hardcoded "Something went wrong" / "Try Again" → `t()` calls via ErrorFallback wrapper
- **MessageContent.tsx** — i18n for Copy/Copied/Download/Preview/Code labels + artifact actions + download all
- **index.html** — Twitter card description updated to canonical tagline
- **package.json** — added `prismjs` + `@types/prismjs` to deps
- **`c301174d`** — feat: i18n extraction — ErrorBoundary, MessageContent, meta tags

#### 3. Previous: Writing Audit (P8)
- 6 locale files rewritten, canonical vocabulary, warm error messages, i18n extraction
- **`2032a2f8`** — feat: Writing audit — canonical vocabulary, warm tone, i18n extraction

#### Deployed
- All commits pushed to `origin/main`, deployed to kernel.chat
- Screenshot artifacts cleaned up (32 PNGs removed)

### Design Audit Findings (for future reference)
- Generated comprehensive design improvement prompt for use with design AI tools
- Key areas identified: dark mode contrast, panel consistency, conversation drawer UX, topic pill layout, briefing markdown rendering
- All critical bugs fixed this session; remaining items are polish/aesthetic improvements

---

## Previous Session (2026-02-20, late night)

### Accomplished
- Writing Audit — Platform-Wide Copy Review (P8)
- Usage Cost Tracking & Discord Alerts (P9)
- Auto Model Selection by Complexity (P10)
- `2032a2f8`, `905ef811`, `f659e582` — pushed and deployed

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

## Previous Sessions (2026-02-17 to 2026-02-20)

### Accomplished
- Haiku-based Reflection Scorer, Test Suite Expansion (184 tests), InsightsPanel i18n Fix, Mini Phone Layout
- Feature Discovery Tooltips, Discord Bot Fixes, Stripe Webhook Hardening, Artifact Branch Merge
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
- **P11: Mobile UI audit** — DONE (11 fixes: bottom cutoff, dark mode contrast, panel headers, tabs, more menu, topic pills, briefing markdown, drawer actions)

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
- Shared `.ka-panel-header` CSS for consistent panel headers across all bottom sheets
- Mobile conv drawer: hide actions by default, show only on active item (no hover on touch)
- More menu: needs max-height + overflow-y for scrollable content on small screens
