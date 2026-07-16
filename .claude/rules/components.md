---
paths:
  - "src/components/**"
  - "src/pages/**"
---
# Component & Page Rules

## Typography

- ALWAYS use EB Garamond for headings and prose content
- ALWAYS use Courier Prime for monospace/code/metadata
- NEVER use system fonts or sans-serif for body text

## Styling

- Use vanilla CSS with design tokens from `src/index.css`
- NEVER use Tailwind, inline styles, or CSS-in-JS
- Reference existing CSS custom properties (e.g., `var(--color-ivory)`)
- Follow the Rubin aesthetic: dark backgrounds, warm accents, contemplative feel

## Component Standards

- All components MUST be TypeScript with explicit prop types
- Use named exports, not default exports
- Animation is CSS-only — see Motion below
- Touch-first design — minimum tap target 44px
- Generous whitespace — let content breathe

## Motion — two surfaces, two instruments

kernel.chat is one codebase with two surfaces, and **the surface
decides the motion instrument.** This is a deliberate boundary, not
unpaid debt. Decide which surface a component serves before you
animate it.

### Editorial surface (the magazine) — CSS-only

The reading experience: issues, spreads, covers, pressroom, the
colophon — everything that *is the publication*. A book doesn't
animate itself. Per `docs/design-language.md` § "Ambient motion —
the two accents" (Rules for new ambient motion), all motion here
MUST:

1. Be imperceptibly small — amplitudes ≤ 8% opacity or ≤ 4px translate
2. Respect `prefers-reduced-motion` (the site-wide override in
   `src/index.css` collapses `animation-duration` to 0.01ms)
3. Be CSS-only — **no JS animation libraries, no Framer Motion, no
   `requestAnimationFrame`** — with ONE ratified exception, the
   working-model exception (ISSUE 419), which covers the `plate`
   (`PlateFeature`), `bore` (`BoreFeature`, ISSUE 420), and
   `fourier` (`FourierFeature`, ISSUE 421) shapes — and, as
   amended by ISSUE 422 (the APPARATUS REGISTER, merger ruling),
   the `audit` (`AuditFeature`) shape, whose whole feature carries
   the full artifact contract on-site (springs, proximity masks,
   magnetic dispatch) confined to that feature and meaning-first.
   Inside those spreads' frames, script may move the model's own
   signal (a pulse, a probe, a plate drawing itself), under the
   four constraints in `docs/interaction-language.md` rule 3 as
   amended: confined to the frame; timer-robust (every step
   advances via a rAF-vs-setTimeout race, never rAF alone — rAF
   provably stalls in throttled/background tabs and embedded
   panes); collapsed by reduced-motion; ambient amplitude even
   inside the frame (≤4px)
4. Not trigger layout/repaint hotspots — animate only `opacity` and
   `transform`

Do NOT add `framer-motion` / `motion/react` to an editorial
component. The page is mostly still by design.

### Engine surface (the AI app) — `motion/react`, governed

The interactive application underneath the magazine: `EnginePage`,
the chat stream, panels, bottom-sheets, and their app-specific
controls. This surface is genuinely interactive (drag, exit
transitions, layout reflow) and `motion/react` (`motion@^12.34.5`)
is the **sanctioned** instrument — ~58 `src/components/*` files use
it today. It is not a free-for-all: engine motion is governed by the
token system in `src/constants/motion.ts` (`SPRING` / `DURATION` /
`EASE` / `TRANSITION`) the way editorial motion is governed by the
CSS contract. Use those tokens; do not hand-roll magic numbers.

**Effort tiers — pick the cheapest that does the job:**

| Tier | Examples | Verdict |
|---|---|---|
| Trivial | fade, simple slide | CSS could do it — prefer CSS even on the engine surface |
| Effort | mount/unmount (`AnimatePresence`) | `motion/react` earns its place |
| Irreplaceable | `drag`, `layout` reflow, scroll-linked | only `motion/react` can — use it |

### Deciding the boundary

If a component renders *the publication*, it's editorial → CSS-only.
If it renders *the app around the publication*, it's engine →
`motion/react` tokens. A shared component used by both defaults to
the editorial (CSS-only) contract — the stricter surface wins.

See `docs/figma-motion.md` for how Figma Motion (the authoring tool)
feeds **both** surfaces as a spec, and why only its CSS export ships.

## State

- Use Zustand stores for global state
- Prefer local state (useState) when possible
- Never store derived data in state
