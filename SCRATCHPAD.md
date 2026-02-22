# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-22)

### Accomplished This Session

#### P15: Build Fix + P16–P18 Platform Enhancements
- **Build fix**: Removed phantom `./memory` and `./mcp` exports from `tools/index.ts` (introduced in `2a002b3`)
- **Conversation search enhancements**: Highlighted match text in search snippets (`<mark>` + `.conv-highlight`), added search result count badge, clear button, loading spinner. Dark mode support.
- **Onboarding flow redesign**: Refreshed with Rubin design language — literary serif titles (italic, 1.6rem), pill-shaped active dots, transparent bordered CTA buttons (uppercase mono), refined interest picker and tier cards. Full dark mode overrides.
- **Animation token system**: Replaced hardcoded durations in LoginGate, Layout, SubscriptionGate, KernelAgentObserver with `DURATION.*`, `EASE.*`, `TRANSITION.*` from `constants/motion.ts`. 5 components migrated.
- **New specialist emblems**: Created 7 SVG emblems matching existing style (italic serif letter in outlined circle with unique accent) for aesthete, guardian, curator, strategist, infrastructure, quant, investigator. Wired `emblem` paths into `specialists.ts`.
- **Test coverage**: Added 4 new test files (TaskPlanner, SwarmOrchestrator, ClaudeClient, specialists). 292 tests passing (was 234).
- **Bundle splitting (P21)**: Converted `manualChunks` from object to function form. Split app code into `kernel-engine` (73KB) and `kernel-agents` (24KB) chunks. Main index chunk: 529KB → 193KB (63% reduction). No chunk exceeds 500KB warning. Build time: 9.6s → 6.3s.
- Build: PASS (no warnings). Tests: 292/292 PASS.

---

## Previous Session (2026-02-20, continued)

### Accomplished This Session

#### Visual Identity — Ink Drop Mark + Platform Polish
- Updated all logo SVGs with V4 Ink Drop mark (sepia stroke, italic amethyst K, seed dot)
- Regenerated PNG icons (192 + 512)
- Standardized emblem strokes (1.5/1/0.5 hierarchy)
- Boosted hero-darkmode.svg visibility
- Design audit: found + fixed missing dark mode overrides for danger classes
- Accessibility: 17 aria-hidden additions on decorative icons across 9 components
- Code-splitting: lazy-loaded LoginGate (504KB → 499KB)
- Component tests: 21 new tests (BottomTabBar, MoreMenu, useDarkMode) — 234 total passing
- Performance audit: PASS (161KB gzip JS, 23KB gzip CSS, 6.1s build)

#### Visual Identity Audit & CSS Token System (P14)
- **Indigo → Amethyst**: Replaced `--rubin-primary: #6366F1` → `#6B5B95` across 37 instances (CSS, agents, components). All `rgba(99,102,241)` → `rgba(107,91,149)`. Dark mode `#818CF8` → `#8B7BB5`.
- **Spacing scale**: Defined `--space-xs` through `--space-4xl` (8 tokens). ~280 replacements (gap, padding, margin).
- **Dark mode variables**: Defined 8 `--dark-*` tokens. Replaced all hardcoded `#1a1a1a`, `#0f0f0f`, `#e8e6e3`, `#333` in dark selectors.
- **MediaRenderer.tsx**: Migrated from Tailwind to vanilla CSS with 12 `ka-media-*` classes. Zero Tailwind in codebase.
- **Border radius**: Added `--radius-xs: 3px`, replaced 16 hardcoded small radii.
- **`background: #fff`** → `var(--rubin-ivory)` (5 instances).
- **CLAUDE.md**: Updated specialist color table to match Rubin palette.
- **User refinements**: Optical kerning (`text-rendering: optimizeLegibility`), fluid spacing (`clamp()`), calm micro-interactions (pressed paper hover effect), invisible scrollbars.
- Build: PASS (499KB JS, 2.18s). Tests: 234/234 PASS.
- Deployed 4 times: `6ee28dd5`, `d1b0a5b4`, `d934c3ee`, `d8f611e0`

---

## Previous Session (2026-02-20, morning)

### Accomplished

#### Design Overhaul — "The Rubin Evolution" (P12)
Full 5-phase design overhaul committing to the literary-minimalist direction.

**Phase 1: Design Token Foundation**
- Extended Rubin palette: `--rubin-ivory-warm`, `--rubin-sepia`, `--rubin-ink`, `--rubin-ink-faint/light`
- Muted watercolor agent colors: kernel `#6B5B95`, researcher `#5B8BA0`, coder `#6B8E6B`, writer `#C4956A`, analyst `#A0768C`
- Typography tokens: letter-spacing scale (tight/normal/wide/caps), line-height scale (tight/normal/relaxed)
- Body: 20px (was 22px), `font-feature-settings: 'kern' 1, 'liga' 1, 'onum' 1` (old-style numerals)
- Added `--ease-spring`, `--duration-instant`, `--radius-lg` → 20px
- Updated all 5 specialist colors in `specialists.ts`

**Phase 2: Dark Mode — "Lamplight Reading"**
- Replaced ALL cool grays with warm browns: `#1C1A18` base (was `#1A1A1A`), `#262320` surface, `#36322E` elevated
- Gold accent `#C4A882` for input focus, drag handles, dividers
- Warm message bubbles: kernel `#282520`, user `#332F2A`, with sepia-tinted borders
- Dark agent colors slightly more luminous (e.g. kernel `#8B7BB5`)
- Ambient vignette: `radial-gradient` pseudo-element on `.ka-chat` (pointer-events: none)
- Updated 30+ dark mode selectors (tabs, menus, stats, conversations, popover, gate auth)

**Phase 3: Panel Unification**
- Enhanced `.ka-panel-header`: sepia border-bottom, italic serif title (font-weight 400), `svg { opacity: 0.5 }`, close button with hover background
- Migrated 4 panels to shared classes: GoalsPanel, WorkflowsPanel, ScheduledTasksPanel, BriefingPanel
- Bottom sheet: `max-width: 520px` (was 480), `padding: 24px` (was 20), `border-radius: var(--radius-lg)`
- Drag handle: 40px wide, 4px tall (was 56/6)
- Empty state: italic serif title, serif description (was mono), uppercase mono CTA with sepia border

**Phase 5: Chat Experience**
- Ink-appear animation: `blur(1px)→blur(0)` + `translateY(6px)→0` on kernel messages
- Literary monogram avatars: 28px outlined circle, serif italic letter, agent-specific border/color via `data-agent` attribute
- Kernel bubble: `var(--rubin-ink-faint)` background, `border-radius: var(--radius-sm)` (subtle, near-transparent)
- Typing indicator: 4px dots (was 6), accent color (was slate), slower 1.6s (was 1.2s)
- Thinking indicator: manuscript annotation style — transparent bg, left accent border, serif italic text

**Phase 4: Home Screen**
- Monogram icon: 48px outlined circle (was 64px filled), serif italic "K", accent-colored
- Title: italic, 1.8rem, tight letter-spacing
- Time-of-day greeting: "Good morning/afternoon/evening" — serif italic, opacity 0.5
- Recent context cards: top 2 conversations as clickable cards with relative time
- Topic pills: transparent background (was filled), sepia border, uppercase, wide letter-spacing
- Briefing card: accent left border (3px)

**Commit & Deploy**
- **`2329ec4f`** — feat: Design overhaul — "The Rubin Evolution"
- Deployed to kernel.chat
- Playwright visual verification at 390×844 (iPhone 14) — light + dark mode: home, chat, panel

### Files Modified
| File | Changes |
|------|---------|
| `src/index.css` | All 5 phases — tokens, dark mode, panels, home, chat |
| `src/agents/specialists.ts` | 5 agent color updates |
| `src/pages/EnginePage.tsx` | `data-agent` attr, greeting helper, recent context cards |
| `src/components/GoalsPanel.tsx` | Panel class migration |
| `src/components/WorkflowsPanel.tsx` | Panel class migration |
| `src/components/ScheduledTasksPanel.tsx` | Panel class migration |
| `src/components/BriefingPanel.tsx` | Panel class migration |

---

## Previous Session (2026-02-20, late night)

### Accomplished
- Mobile UI/UX Audit & Fixes (P11) — 11 fixes: bottom cutoff, dark mode contrast, panel headers, tabs, more menu, topic pills, briefing markdown, drawer actions
- i18n Extraction — ErrorBoundary, MessageContent, meta tags
- Writing Audit (P8) — canonical vocabulary, warm tone, i18n extraction
- `a497297c`, `c301174d`, `2032a2f8` — pushed and deployed

## Previous Sessions (2026-02-17 to 2026-02-20)

### Accomplished
- Writing Audit, Usage Cost Tracking, Auto Model Selection (P8–P10)
- Artifact System Overhaul, Agent Audit & Cleanup (P6–P7)
- Dark Mode Audit & Fixes (~70% → ~95% coverage)
- Haiku-based Reflection Scorer, Test Suite (184 tests), InsightsPanel, 24 locales
- Feature Discovery, Discord Bot, Stripe Webhooks, Mobile UX Polish

---

## Ongoing Backlog

- **P1–P11**: All DONE
- **P12: Design overhaul** — DONE ("The Rubin Evolution" — tokens, dark mode, panels, chat, home)
- **P13: Platform polish** — DONE (icons, accessibility, code-splitting, tests, perf audit)
- **P14: Visual identity audit** — DONE (indigo→amethyst, spacing tokens, dark mode vars, Tailwind removal, radius tokens, optical kerning, fluid spacing)
- **P15: Build fix** — DONE (phantom exports removed)
- **P16: Conversation search** — DONE (highlights, count badge, clear button, spinner)
- **P17: Onboarding redesign** — DONE (Rubin design language, dark mode)
- **P18: Animation token system** — DONE (5 components migrated to motion constants)
- **P19: New specialist emblems** — DONE (7 SVG emblems + wired into specialists.ts)
- **P20: Test coverage** — DONE (292 tests, +58 from 234)
- **P21: Bundle splitting** — DONE (529KB → 193KB main chunk, +kernel-engine 73KB, +kernel-agents 24KB)
- **Next candidates**: Keyboard shortcuts (Cmd+K search), conversation export, agent memory UI

## Key Decisions Made

- Bottom-sheet pattern for all panels (Goals, Workflows, Scheduled, Briefings, Insights)
- Haiku-based progress extraction for goals (every 3 messages)
- AgentRouter (Haiku) is single source of truth; keyword matching is minimal fallback
- AgentSelection uses SPECIALISTS directly (not swarm mapping) when router confidence >= 0.7
- Auto-artifact: >= 8 lines + known language → inferred filename → artifact card
- Dynamic filename extraction from user messages for explicit ordering
- Dark mode: warm brown undertones throughout, never cool gray — "lamplight reading" principle
- Ambient vignette in dark mode for reading-lamp peripheral dimming effect
- Reflection scorer: 60/40 AI/heuristic blend, rubric system prompt, intent-aware weights
- Free tier: 10 messages (enforced in claude-proxy edge function)
- Auto model selection: complexity >= 0.85 → Opus, <= 0.2 → Haiku, else Sonnet
- Usage tracking: fire-and-forget INSERT after every API call, $5/day Discord alert
- Edge function deploys: ALWAYS use `--no-verify-jwt` flag
- Writing audit canonical vocabulary: "Kernel", "Deep research", "Persistent memory", "10 messages to start"
- Shared `.ka-panel-header` CSS with italic serif titles, sepia dividers — all panels unified
- Agent avatars: outlined circle monograms with agent-specific colors (not filled circles)
- Kernel messages: ink-appear animation (blur + translate), near-transparent background
- Topic pills: transparent + sepia border + uppercase mono (not filled background)
- Mobile conv drawer: hide actions by default, show only on active item (no hover on touch)
- More menu: needs max-height + overflow-y for scrollable content on small screens
