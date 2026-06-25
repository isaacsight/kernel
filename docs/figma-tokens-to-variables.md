# Mirroring kernel.chat tokens as Figma variables

> **Decision in one line:** Figma is a **drafting table**, not the
> press. Mirror the design tokens into Figma variables so comps stay
> on-grammar — then transcribe finished work back into CSS **by hand.**
> The CSS in the repo is the source of truth; the Figma file is a
> sketch of it, never the reverse.

Filed 2026-06-25. Follow-up to [`figma-motion.md`](./figma-motion.md)
and its session log's "Figma as a drafting table" map. Where that note
drew the line on *motion*, this one does the same for *tokens*: which
ones map cleanly to Figma variables, which ones can't, and how to keep
the two in sync without ever running codegen.

Token source of truth: the `tokens/` files in the
`kernel-chat-design` skill (`colors.css`, `typography.css`,
`spacing.css`, `fonts.css`) and `src/components/IssueAccent.css` for
the adaptive accent system.

## The one rule that makes this safe

**Names match, one-to-one.** Every Figma variable is named after the
CSS custom property it stands for, minus the `--` and with `/` for
grouping. `--pop-tomato` → `color/pop/tomato`. `--space-lg` →
`space/lg`. `--text-2xl` → `size/text-2xl`.

That mechanical naming is the whole trick: when you finish a comp and
read its variables back (via `get_variable_defs`, or by eye), each one
already tells you the exact token to type into CSS. No translation
layer, no judgment call, no drift.

## What maps cleanly

These tokens are static values. They cross into Figma variables with
full fidelity. Build them as one **Primitives** collection (single
mode), grouped by the paths below.

### Color — `tokens/colors.css`

| CSS token | Figma variable | Value |
|---|---|---|
| `--rubin-ivory` | `color/rubin/ivory` | `#FAF9F6` *(primary ground — never `#fff`)* |
| `--rubin-ivory-med` | `color/rubin/ivory-med` | `#F0EEE6` |
| `--rubin-ivory-dark` | `color/rubin/ivory-dark` | `#E8E6DC` *(hairlines)* |
| `--rubin-slate` | `color/rubin/slate` | `#1F1E1D` *(primary ink)* |
| `--rubin-slate-muted` | `color/rubin/slate-muted` | `#6B6966` *(secondary text)* |
| `--pop-ivory` | `color/pop-stock/ivory` | `#FAF9F6` |
| `--pop-cream` | `color/pop-stock/cream` | `#F3E9D2` *(anchor paper)* |
| `--pop-butter` | `color/pop-stock/butter` | `#EFD9A0` |
| `--pop-kraft` | `color/pop-stock/kraft` | `#C8A97E` |
| `--pop-ledger` | `color/pop-stock/ledger` | `#F2EFE2` |
| `--pop-coffee` | `color/pop-stock/coffee` | `#6B4E3D` |
| `--pop-ink` | `color/pop-stock/ink` | `#1F1E1D` |
| `--pop-tomato` | `color/spot/tomato` | `#E24E1B` *(the only spot)* |
| `--pop-hairline` | `color/rule/hairline` | `rgba(31,30,29,0.85)` |
| `--pop-hairline-soft` | `color/rule/hairline-soft` | `rgba(31,30,29,0.16)` |
| `--rubin-primary` | `color/mark/purple` | `#6B5B95` *(logo mark ONLY)* |

Two guardrails to carry into the file as it's built:
- **No pure white.** Figma defaults frames to `#FFFFFF`; the first move
  on any kernel.chat comp is to set the page fill to
  `color/pop-stock/ivory`. There is no `#fff` in the system.
- **Purple is not a colour you design with.** `color/mark/purple`
  exists only so the logo mark renders. Tomato is the only spot the
  press mixes.

### Spacing, radii — `tokens/spacing.css`

Float variables. Group `space/*` and `radius/*`.

| CSS token | Figma variable | Value |
|---|---|---|
| `--space-xs … --space-4xl` | `space/xs … space/4xl` | 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 |
| `--radius-xs … --radius-lg` | `radius/xs … radius/lg` | 3 · 6 · 10 · 20 |
| `--radius-full` | `radius/full` | 9999 |

Editorial surfaces stay square — `radius/*` is for the few framed
surfaces (install pill, inset card) only.

### Type ramp & tracking — `tokens/typography.css`

Sizes and tracking become float variables; the two families become
**text styles** (Figma can't hold a font family in a variable usefully,
so a text style per role is the right container).

| CSS token | Figma variable / style | Value |
|---|---|---|
| `--text-xs … --text-2xl` | `size/text-xs … size/text-2xl` | 12.8 · 16 · 20 · 25 · 31.3 · 39.1 · 48.8 (px) |
| `--letter-spacing-tight` | `tracking/tight` | `-0.01em` |
| `--letter-spacing-wide` | `tracking/wide` | `0.08em` |
| `--letter-spacing-caps` | `tracking/caps` | `0.14em` *(the mono-caps look)* |
| `--font-serif` | text style `Display / EB Garamond` | EB Garamond 400–800 |
| `--font-mono` | text style `Meta / Courier Prime` | Courier Prime 400/700 |

Scale is a Major Third (1.25) off a 20px body. Build text styles in
pairs that already encode the register: **Display** (EB Garamond,
tight tracking, large) for headlines and prose; **Meta** (Courier
Prime, `tracking/caps`, uppercase) for kickers, folios, banners, and
the JP subtitles.

## What does NOT map — and must not be faked

### The adaptive accent system (`accents.ts` + `IssueAccent.css`)

An issue declares **one** base accent hex. CSS then derives five tones
from it with OKLCH relative-colour math:

```
--issue-accent-strong:  oklch(from base  calc(l * 0.78 + lift)  c          h)
--issue-accent-muted:   oklch(from base  calc(l * 1.15 + lift)  calc(c*.45) h)
--issue-accent-whisper: oklch(from base  calc(0.97 + lift*.1)   calc(c*.2)  h)
--issue-accent-ink:     oklch(from base  calc(0.18 + lift*.2)   calc(c*.4)  h)
```

…and bends every tone again per paper stock (`--issue-accent-lift`:
ink `+0.18`, kraft `+0.04`, butter `−0.03`, …) and per mode (dark
`+0.08`, `prefers-contrast: more` pulls chroma back).

**Figma variables cannot do this.** They store values and swap by mode;
they cannot run `calc()` on a referenced colour's lightness. Any
attempt to hand-key the five tones into Figma produces stale,
per-issue swatches that drift from what the build actually renders.

So the boundary is firm:
- **Mirror the inputs.** Build the nine named seeds from `INK_SEEDS`
  as flat reference swatches — `accent-seed/tomato #E24E1B`,
  `accent-seed/brick #9E3A2B`, `accent-seed/cobalt #1D4E89`,
  `accent-seed/pool #4FB5C8`, `accent-seed/ivy #2E4A2E`,
  `accent-seed/olive #6B7A3D`, `accent-seed/amethyst #6B5B95`,
  `accent-seed/oxblood #5E2328`, `accent-seed/coffee #6B4E3D`,
  `accent-seed/graphite #3F3D3A`. These are the *choices a curator
  makes*, so they're worth having on the canvas.
- **Don't mirror the tones.** The derived `strong/muted/whisper/ink`
  stay CSS-only. If you need to *see* them in a comp, paste the
  computed values out of the running dev build (DevTools → computed
  `--issue-accent-strong` on the spread root) into a clearly-labelled
  **"reference only, non-canonical"** group — and delete it before the
  file gets reused.

### Motion

Per [`figma-motion.md`](./figma-motion.md): motion is authored
per-issue when genuinely needed, and `accents.ts` deliberately keeps
motion *out* of the palette system. Nothing about motion belongs in
the variable mirror.

## Two useful moves Figma *can* do

### 1. Paper stock as a variable mode

Make a small second collection — **Ground** — with one variable,
`surface/page`, and a mode per stock: `ivory`, `cream`, `butter`,
`kraft`, `ink`. Flipping the mode reskins a whole comp's ground in one
click, which is exactly the "does this spread hold on butter vs.
kraft?" question you want to answer before building. This is honest
because `surface/page` is a *flat* stock hex — no lift math involved.
(Set text colour by hand when you flip to `ink`; the lift adaptation
that CSS does automatically is not reproduced here, and that's fine for
a sketch.)

### 2. Candidate-accent preview, the right way

To audition a new seed before committing it to `INK_SEEDS`:
1. Drop the candidate hex as a temporary `accent-seed/_candidate`
   swatch.
2. Lay it on `surface/page` across the five stock modes (move #1).
3. Judge only the **base** on each ground — chroma warmth, whether it
   reads as magazine-register or tips into neon/digital (the
   `isPopeyeSafe()` guardrail).
4. If it survives, the real validation is still the dev build: add it
   to `accents.ts`, let the OKLCH derivation + `isPopeyeSafe()` run,
   and check the five tones on a real spread. **Figma narrows the
   field; the build makes the call.**

## Hard "do nots"

Carried from the figma-motion MCP note — same reasoning, same teeth:

- **No `get_code`.** It emits React + Tailwind, both off-policy here.
  Use `get_variable_defs` and `get_image`; read Dev Mode only for
  measurements.
- **No Figma Make / Sites codegen, no Tailwind/component export, no
  Lottie.** The file produces *measurements and decisions*, never code.
- **The repo is canonical.** When a token changes, change it in
  `tokens/*.css` first, then update the Figma variable to match —
  never the other way. The mirror follows the code.

## Setup (local only)

The live Figma↔Claude link needs a **local** Claude Code session on the
same machine as Figma desktop (a remote/web session's `127.0.0.1` is a
cloud container, not your Mac):

1. Figma desktop → enable **Dev Mode MCP Server** in preferences
   (serves at `http://127.0.0.1:3845/mcp`).
2. `claude mcp add --transport http figma http://127.0.0.1:3845/mcp`
3. Prefer `get_variable_defs` (read the variable mirror back as
   token names) and `get_image` (see the comp). Transcribe to CSS by
   hand.

## The standing rule

> Mirror the static tokens; never the derived ones. Figma sketches the
> magazine in its own grammar so the comp is honest — then the work is
> rebuilt in CSS, which stays the single source of truth. A drafting
> table, not a press.

See also: [`figma-motion.md`](./figma-motion.md),
[`design-language.md`](./design-language.md), the `kernel-chat-design`
skill's `tokens/`, and `src/components/IssueAccent.css`.
