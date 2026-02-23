# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-02-22, late)

### Accomplished This Session

#### Dark Mode Header Fix
- Burger menu (`.ka-menu-btn`) and header icon buttons (`.ka-header-icon-btn`) were invisible in dark mode — inherited dark color against dark background
- Added `[data-theme="dark"]` override: `color: var(--dark-text)` for both selectors
- Entity animation refinements also included (garden creature, warmer palette, smoother easing, idle wiggle — previously unstaged)
- Committed `25775e83`, deployed to kernel.chat

---

## Previous Session (2026-02-22, earlier)

### Accomplished

#### ChatGPT Conversation Import
- **Import modal**: link-only input for ChatGPT share URLs (no tabs/paste — simplified per user request)
- **Edge function** (`import-conversation`): accepts `url` param, fetches ChatGPT backend API JSON, falls back to HTML parsing + Haiku extraction
- **DB migration**: added `metadata` JSONB column to `conversations` table (was missing, caused PGRST204 error)
- **Session fix**: `createConversation` now calls `refreshSession()` proactively before insert
- **Error surfacing**: `createConversation` throws with actual Supabase error (code + message) instead of returning null silently. `forkSharedConversation` throws too. All callers updated.
- **Resilience**: 32KB content truncation per message, batch inserts (50 at a time)
- **Modal centering**: Framer Motion `y` prop was overwriting CSS `translate(-50%, -50%)` — fixed by using `calc(-50% + 20px)` in motion values
- **HTTPS enforcement**: re-enabled on GitHub Pages (was unchecked, causing mixed content "Failed to fetch" errors)
- 6 commits: `b47057e4` → `4627c690`, all pushed to origin/main

#### 16-bit Garden Creature Upgrade
- **Shape redesign**: angular angel → round friendly garden blob with two eyes at all tiers, sprout/flower/leaf theme
- **16-bit CSS**: all pixels now use `linear-gradient` fills with `box-shadow` inner highlight/shadow for depth
- **Eye sparkles**: new `eye-light` variant — 3px white dots inside each eye with shimmer animation
- **Eyes**: `radial-gradient` rendering with warm depth + inner highlight
- **Sprout/leaves/particles/glow**: all upgraded with gradient fills and ambient shadows
- **Smooth animations**: removed all `steps()` timing → `ease-in-out` / `ease-out` throughout
- **Dark mode**: all 16-bit variants have matching gradient dark mode styles
- **Core/Crown/Notif**: radial gradients, topic-colored glow, gradient gold crown
- **Idle wiggle**: random 6-12s happy shimmy via JS class toggle
- Committed as `d3d18b94`, deployed to kernel.chat, pushed to origin/main

#### Entity Evolution System (P15) — earlier this session
- 3 new files: `pixelGrids.ts`, `useEntityEvolution.ts`, `PixelEntity.tsx`
- EnginePage: replaced ~85 lines inline pixel JSX with `<PixelEntity />`
- 5 tiers, 6 topic domains, transient states (time-of-day, goals, activity, briefing, pro)
- 24 new tests — 345 total passing
- Committed as `d5b984ff`

---

## Previous Session (2026-02-20, continued)

### Accomplished

#### Visual Identity — Ink Drop Mark + Platform Polish (P13)
- Updated all logo SVGs with V4 Ink Drop mark (sepia stroke, italic amethyst K, seed dot)
- Regenerated PNG icons (192 + 512)
- Accessibility: 17 aria-hidden additions across 9 components
- Code-splitting: lazy-loaded LoginGate (504KB → 499KB)
- Component tests: 21 new tests — 234 total passing

#### Visual Identity Audit & CSS Token System (P14)
- Indigo → Amethyst across 37 instances
- Spacing scale (8 tokens), dark mode variables (8 tokens), border radius tokens
- MediaRenderer: Tailwind → vanilla CSS. Zero Tailwind in codebase.
- Optical kerning, fluid spacing, calm micro-interactions

---

## Previous Sessions (2026-02-17 to 2026-02-20)

### Accomplished
- P12: Design overhaul — "The Rubin Evolution" (tokens, dark mode, panels, chat, home)
- P11: Mobile UI/UX audit & fixes (11 items)
- P8–P10: Writing audit, usage cost tracking, auto model selection
- P6–P7: Artifact system overhaul, agent audit & cleanup
- P1–P5: Dark mode, reflection scorer, test suite, InsightsPanel, i18n, feature discovery, Discord bot, Stripe webhooks

---

## Ongoing Backlog

- **P1–P15**: All DONE
- **ChatGPT import**: DONE (link-only, ChatGPT backend API → preview → import)
- **Next candidates**: Onboarding flow redesign, conversation search, animation token system
- **Known limitations**: Claude/Gemini share links don't work (CSR — no server-side content). Would require headless browser to fix.

## Key Decisions Made

- ChatGPT import uses `/backend-api/share/{id}` JSON endpoint (public, no auth needed)
- Import modal: link-only, no paste tab (user preference)
- `conversations` table has `metadata` JSONB column for import source tracking
- `createConversation` throws on error (not silent null return) — all callers use try/catch
- Entity evolution score: log2-based, 3 signals (conversations 40%, KG 35%, goals 25%)
- Tiers are additive — higher tiers render all lower-tier pixels plus new ones
- 16-bit aesthetic: gradient fills, inner highlight/shadow box-shadows, radial gradients for eyes/core
- All animations use smooth easing (no steps()) — organic garden feel
- Topic color applied via CSS custom properties + `color-mix()` for gradual bleed
- Bottom-sheet pattern for all panels
- AgentRouter (Haiku) is single source of truth; keyword matching is minimal fallback
- Dark mode: warm brown undertones, never cool gray — "lamplight reading" principle
- Auto model selection: complexity >= 0.85 → Opus, <= 0.2 → Haiku, else Sonnet
- Zero Tailwind — all vanilla CSS with `ka-` prefix and Rubin design tokens
- Edge function deploys: ALWAYS use `--no-verify-jwt` flag
