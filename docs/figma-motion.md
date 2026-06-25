# Figma Motion vs. the kernel.chat motion contract

> **Decision in one line:** Figma Motion is welcome as an
> *authoring/spec* surface. Only its **CSS export** may reach the
> repo, hand-finished under the existing ambient-motion rules.
> The React, Lottie, and runtime-player outputs are **off-policy**
> and do not ship.

Filed 2026-06-25. Trigger: Figma shipped a product literally named
"Figma Motion" at Config 2026 (announced 2026-06-24), and the name
collides with a library this project already bans. This note draws
the line so the collision doesn't quietly erode the motion contract
in [`design-language.md`](./design-language.md) (§ *Ambient motion —
the two accents*).

## The name collision

Two different things are called "Motion." They are not the same and
must not be treated the same.

| Name | What it actually is | Standing here |
|---|---|---|
| **Figma Motion** | Figma's native canvas timeline (keyframes for position / scale / rotation / opacity, presets, motion variables, export to CSS / JSON / React / video). Open beta as of June 2026. | A **design tool**. Allowed as a spec surface. |
| **Motion / Framer Motion** (`motion.dev`, `framer-motion`) | A JavaScript animation runtime. What Figma Make / Figma Sites emit when they "add animation." | A **JS library**. Already banned by design-language rule 3. |

The design language's "no Framer Motion" line was always about the
*runtime library*, not the authoring tool. Figma Motion does not
change that line. It changes only *how a designer might author* the
motion we then rebuild by hand in CSS.

## What Figma Motion exports, mapped to our contract

The contract (design-language § *Rules for new ambient motion*):
amplitudes ≤ 8% opacity or ≤ 4px translate; respects
`prefers-reduced-motion`; **CSS-only — no JS animation libraries, no
Framer Motion, no `requestAnimationFrame`**; animate only `opacity`
and `transform`; audit before adding a third accent.

| Figma Motion output | Ships JS? | Auto-respects reduced-motion? | Verdict |
|---|---|---|---|
| **CSS export** (Dev Mode → copy CSS) | No, if you take only the CSS | **No** — you add the guard yourself | ✅ Allowed, as a *draft* to hand-finish |
| React / `motion.dev` export | Yes (JS runtime) | Library-dependent | ❌ Breaks rule 3 by name |
| Lottie / dotLottie | Yes (player runtime) | No | ❌ Breaks the CSS-only rule |
| MP4 / WebM / GIF / animated SVG | n/a (asset, not motion code) | n/a | Out of scope; treat as an image asset, subject to weight budget |

So exactly one path is open: **author in Figma Motion, export CSS,
then rewrite it to fit.** The export is never paste-and-ship.

## The hand-finish checklist

When a CSS export comes off the Figma canvas, it does not enter the
repo until it has been reduced to our terms:

1. **Re-clamp amplitude.** Figma defaults are UI-scale (200–500ms,
   visible moves). Our accents are imperceptible: ≤ 8% opacity or
   ≤ 4px translate. If a reviewer wouldn't have to be *told* it
   moves, it's still too big.
2. **Guard it.** The site-wide `prefers-reduced-motion` override in
   `src/index.css` collapses `animation-duration` to 0.01ms — make
   sure the keyframe rides that override and isn't driven by a
   property the override doesn't reach (e.g. a `transition` on a
   non-animation property).
3. **`opacity` and `transform` only.** Drop any exported keyframe
   that touches layout, `filter`, `box-shadow`, `background-position`,
   etc. — they are repaint/layout hotspots (rule 4).
4. **No JS rider.** Strip any `import`, any `requestAnimationFrame`,
   any `motion.*` wrapper. If the effect can't survive as pure CSS,
   it doesn't belong on the site.
5. **Run the third-accent audit.** The site's character is stillness
   with two quiet accents (tomato-rule breath, dateline marquee).
   Before a *third* lands, prove the existing two aren't enough
   (rule 5). Figma making motion cheap to author is not a reason to
   add more of it.

## Where Figma Motion genuinely helps

- **Pinning easing and timing** before writing a keyframe by hand —
  the timeline is faster than eyeballing a cubic-bézier.
- **Motion variables** as a shared easing vocabulary, then
  transcribed into our CSS custom properties (not imported).
- **A spec a reviewer can scrub**, instead of a prose description of
  a 3.3s breath.

It is a sketchbook, not a press. The press is still pure CSS.

## Caveats

- **It's days-old open beta.** CSS-export fidelity and motion-variable
  behavior are unproven in public. Do not build a workflow dependency
  on it yet; treat any export as a draft, not a source of truth.
- **Design-system features are paywalled.** Animated-component
  propagation and motion variables sit on paid plans; basic export
  is broader. BYOK-adjacent principle: don't make the magazine's
  motion pipeline depend on a seat tier.

## The standing rule

> Figma Motion may author. Only CSS ships. The motion contract in
> `design-language.md` is unchanged — stillness with two quiet
> accents, CSS-only, reduced-motion-respected — and a slicker
> authoring tool is not a license to loosen it.

See also: [`design-language.md`](./design-language.md) §§ *Ambient
motion*, *Mobile design philosophy → Implemented rules*.
