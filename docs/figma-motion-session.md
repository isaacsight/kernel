# Session log — Figma Motion research & policy

*Recorded 2026-06-25. Branch `claude/figma-motion-cdltib`, PR #53.
This is the working record behind [`figma-motion.md`](./figma-motion.md):
the question that started it, what the research found, and the
decisions that followed.*

## The question

> "What is figma motion?"

It started as a lookup against the branch name `figma-motion`. There
was no "figma motion" concept anywhere in the codebase — the term
only existed as the auto-generated branch name. That triggered a
deep-research pass, which surfaced the real answer: **Figma Motion is
a product Figma shipped at Config 2026 (announced 2026-06-24)** — one
day before this session.

## What the research found

Sourced from Figma's blog/release notes, TechCrunch, motion.dev,
LottieFiles, Figma Help, and 2026 tool comparisons.

### 1. Figma's native motion features
- **Figma Motion (new, June 2026, open beta):** a timeline on the
  canvas. Keyframes position / scale / rotation / opacity
  independently; presets (fade, move, scale); auto-keyframing; motion
  variables (shared easing). Exports CSS / JSON / React / motion.dev
  code, plus MP4 / WebM / SVG / GIF. Design-system propagation gated
  to paid plans. 3D transforms announced via waitlist (not shipped).
- **Smart Animate (established):** prototype-only transitions between
  frames; matches layers by name + hierarchy; linear / ease / custom
  bézier / spring easing. Can't animate Arc-tool objects (falls back
  to dissolve).

### 2. Figma → code handoff
Three paths, decreasing fit for a CSS-only site:
- **Native CSS export** (Dev Mode → copy CSS) — the only path that
  can avoid shipping JS.
- **Lottie / dotLottie** — ships a player runtime; cited ~60% smaller
  than GIF / dotLottie ~98% (LottieFiles' own numbers).
- **Framer Motion / motion.dev** via Figma Make / Sites — emits React
  with a JS animation runtime.

### 3. Fit for kernel.chat
Only the CSS export clears the design-language bar (CSS-only, no JS
animation libs, no Framer Motion, `prefers-reduced-motion`, animate
only `opacity`/`transform`). React and Lottie outputs are off-policy.

### 4. Landscape
2026 consensus is specialization, not one tool: Figma = ideation/spec,
Rive = production 2D / state machines (lightweight, perf), Spline = 3D
web, Lottie = vector handoff, **raw CSS = the right shipping target
for an editorial site.**

## The name collision (the crux)

Two different things are called "Motion":

| Name | What it is | Standing |
|---|---|---|
| **Figma Motion** | Native canvas timeline (authoring tool) | Allowed as a spec surface |
| **Motion / Framer Motion** (`motion.dev`) | JS animation runtime | Already banned by design-language rule 3 |

The "no Framer Motion" rule was always about the *library*, not the
authoring tool. Figma Motion doesn't change it.

## Decisions shipped

- **`docs/figma-motion.md`** — the standing policy:
  > Figma Motion may author. Only CSS ships.
  Allowed: Figma Motion as a spec surface; its CSS export, hand-finished
  (re-clamp to ≤8% opacity / ≤4px translate, guard via
  `prefers-reduced-motion`, `opacity`+`transform` only, strip any JS
  rider, run the third-accent audit). Off-policy: React / Lottie /
  dotLottie / runtime-player outputs.
- **PR #53** opened as draft.

## How Figma helps kernel.chat (practical map)

Figma is a **drafting table**, not the press:
- **Comp new issue spreads** at 393px before building in `pop-*`.
- **Mirror tokens as Figma variables** (type ramp `--text-xs…2xl`,
  paper stocks, letter-spacing tiers) so comps stay on-grammar.
- **Preview a candidate accent hex** on ivory / butter / kraft / ink
  before committing a seed (the `accents.ts` one-hex→5-tone system).
- **Compose cover / back-cover art.**
- **Figma Motion as a motion spec** → CSS export, hand-finished.

Don't use: Figma Make/Sites codegen (React + framer-motion), Figma →
Tailwind/component export, Lottie export, or Dev Mode "copy code"
classes (read it only for measurements).

## Live Figma ↔ Claude (the MCP note)

Figma's Dev Mode MCP server serves at `http://127.0.0.1:3845/mcp`.
It can't be reached from a **remote web session** — that runs in a
cloud container whose `127.0.0.1` is not the user's machine. To use
it live, run Claude Code **locally** alongside the Figma desktop app:
enable "Dev Mode MCP Server" in Figma preferences, then
`claude mcp add --transport http figma http://127.0.0.1:3845/mcp`.
Even then, prefer `get_variable_defs` / `get_image` and transcribe by
hand — `get_code` emits React/Tailwind, off-policy here.

## Sources

- Figma — [Introducing Figma Motion](https://www.figma.com/blog/introducing-figma-motion/)
- Figma — [Config 2026 recap](https://www.figma.com/blog/config-2026-recap/)
- TechCrunch — [Figma adds code layers + animations (2026-06-24)](https://techcrunch.com/2026/06/24/figma-adds-code-layers-support-for-animations-more-ai-features-in-new-update/)
- motion.dev — [Figma integration](https://motion.dev/docs/figma)
- Figma Help — [Smart Animate](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames) · [easing & spring](https://help.figma.com/hc/en-us/articles/360051748654-Prototype-easing-and-spring-animations)
- LottieFiles — [for Figma](https://lottiefiles.com/plugins/figma)
- illustration.app — [Figma vs Spline vs Rive 2026](https://www.illustration.app/blog/which-tool-wins-for-motion-branding-in-2026-figma-spline-or-rive)
