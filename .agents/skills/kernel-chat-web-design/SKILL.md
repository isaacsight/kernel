---
name: kernel-chat-web-design
description: Guides the design, layout, styling, and interactivity of kernel.chat editorial spreads and standalone artifact editions. Use this skill when editing or creating pages, React components, CSS files, or single-file HTML artifacts in the kernel.chat project to enforce the POPEYE-inspired bilingual design grammar and the interaction-language/artifact-language laws.
---

# Kernel Chat Web Design

## Overview

This skill encodes the visual grammar, interaction constraints, styling tokens, and publishing guidelines of **kernel.chat**. It serves as the single source of truth for creating editorial magazine issues that honor the POPEYE-inspired warmth while remaining calm, accessible, and scientifically honest.

---

## The House Grammar

kernel.chat is an **editorial magazine**, not an application. Every release is named `ISSUE N · MONTH YEAR`. 

### Voice & Copy Constraints
1. **Never name the inspiration on the site.** No mention of "POPEYE" in user-visible copy. Homage is carried entirely through grammar.
2. **Magazine terminology only.** Use terms like *issue*, *feature*, *spread*, *folio*, *kicker*, *monument*, *colophon*, *masthead*, *dateline*, *bulletin*. Do **not** use app terms like *dashboard*, *panel*, *card*, *widget*, *modal*.
3. **Typography.** EB Garamond for prose, Courier Prime for metadata, Noto Serif JP for Japanese subtitles and parallel text.
4. **Bilingual Lockups.** EN-primary with selective JP subtitles/lockups (`.pop-bilingual > .pop-latin / .pop-jp`).
5. **No Emojis.** Use the star/asterisk symbol (★) as the single recurring folio system glyph.

---

## Core Design System & Tokens

CSS custom properties live in `src/index.css` (specifically lines 118-150 for tokens). Do not hardcode values; always use these variables.

### The Stock Cabinet (Paper Grounds)
- `--pop-ivory` (`#FAF9F6`) — Serious-sober / press-preview white ground.
- `--pop-cream` (`#F3E9D2`) — Warm default magazine paper.
- `--pop-butter` (`#EFD9A0`) — Summer / slow leisure reading paper.
- `--pop-kraft` (`#C8A97E`) — Camel / outdoor field-report paper.
- `--pop-sepia` (`#D4C5A9`) — Muted background accent.
- `--pop-coffee` (`#6B4E3D`) — Rich brown text / neutral accent.
- `--pop-ink` (`#1F1E1D`) — Night / nocturnal dark mode ground.
- `--pop-ledger` (`#F2EFE2`) — Pale graph-ruled paper for audit issues.

### The Ink Cabinet (Spot Accents)
Declaring an accent shifts the Spot Color (`--issue-accent-base` and derived tones via `oklch`). Raw hexes are permitted if they pass `isPopeyeSafe()` (rejects gray, neon, and RGB primaries).

| Seed | Base Hex | Fits / Temperament |
| :--- | :--- | :--- |
| `tomato` | `#E24E1B` | The default house accent. 370+ issues. |
| `brick` | `#9E3A2B` | Deeper, archival — literature, memory, record-of-record. |
| `cobalt` | `#1D4E89` | Winter, nocturnal, nightlife, city transit-blue. |
| `pool` | `#4FB5C8` | Teal — systems, terminal, code, infrastructure. |
| `ivy` | `#2E4A2E` | Deep forest — nature, outdoor, agriculture. |
| `olive` | `#6B7A3D` | Fatigue-olive — field work, labor, maps. |
| `celadon` | `#6F968A` | Muted grey-jade (비색) — Korean lifestyle / yeobaek (negative space). |
| `amethyst` | `#6B5B95` | Metapage / anniversary / year-in-review. |
| `oxblood` | `#5E2328` | Burgundy — literature, wine, memory, endings. |
| `coffee` | `#6B4E3D` | Rich brown — craft, conversation, slow work. |
| `graphite` | `#3F3D3A` | Pencil-lead grey — audits, ledger-books. |

---

## The Interaction Language

Interactive elements must obey **The Seven Rules** from `docs/interaction-language.md`.

1. **Calm by Default.** Touches deepens; it never gates. The page at rest is complete.
2. **Calibrated Instruments.** Controls represent a variable the story is *about*. No hover effects, cursor trails, scroll-triggered fades, or decorative animations.
3. **Motion is Weather.** CSS-only transitions and keyframes at weather amplitude (movement of paper in a room).
   - *Exception: Working-Model Plate.* Script-driven animation (`requestAnimationFrame`) is allowed **only** inside a framed plate, must be timer-robust (race rAF with `setTimeout`), and must collapse instantly to resting state under `prefers-reduced-motion`.
4. **Everything Stays on the Page.** Every state exists in the DOM at all times. Print (`@media print`) must stack all states. Generative plates must print their deterministic seed (No.###) on the artwork so they can be re-drawn.
5. **Established ARIA Patterns.** Roving tab-index radiogroups, switch, tablist/tabpanel, standard button toggles. Focus states must use the issue accent and remain visible on all stocks.
6. **The Meter Tells the Truth.** No faked gauges or progress bars. Displayed numbers are measured, or labelled representative next to the number (`meterNote` / `plateNote`). Ledgers are session-only and unrecorded.
7. **Two Instances Before a Pattern.** Do not extract shared machinery until a second story absolutely requires it.

### The Thirteen Interaction Shapes
- **Dial** (`instrument`, ARIA radiogroup): N ordered positions on one variable.
- **Compare** (`compare`, ARIA switch): A binary toggle between two co-equal lenses.
- **Sequence** (`sequence`, ARIA tablist): An ordered process in discrete, complete stages.
- **Galley** (`galley`, ARIA pressed toggles): Passage-level strike/stet editorial marks.
- **Margin** (`margin`, native textareas): Writable session-only margins for notes.
- **Press** (`press`, composition sliders): Composing stock, ink seed, and layout.
- **Close** (`close`, sibling buttons): A feed with an equal-weight stop control.
- **Proof** (`proof`, line adjudication): Adjudicating machine drafts (keep / edit / strike).
- **Day** (`day`, moment selectors): Marking time-lived moments (LET IT RIDE / STEP IN).
- **Plate** (`plate`, block simulation): Operational blocks with wires, redraws, and seeds.
- **Bore** (`bore`, gauge WINCH button): Vertical strata probe with carried context.
- **Fourier** (`fourier`, canvas phasor): Harmonic wave summation and Web Audio preview.
- **Audit** (`audit`, proximity beam): Attention metering, proximity-mask spotlight, and budgets.
- *Composite:* **Tutor** (`tutor`, lesson frame): Composes primitives to teach interaction.

---

## Standalone Artifact Editions

Every issue ships both as a site spread and as a standalone **Artifact Edition** (`artifacts/<N>-<slug>.html`).

### The Artifact Grammar
1. **One Self-Contained File.** Strictly CSS-inline, strict CSP-safe, no external CDNs or scripts. Font stacks must utilize local fallbacks.
2. **The Depth Doctrine.** Must go deep vertically (axis with a gauge, carried context from upper layers, floor that pays, emphasis-never-existence).
3. **Tactile Physics.** Dragging or shifting should use interruptible spring physics, inertia, friction, and lag rather than linear bezier curves.
4. **Disclosures.** Running head, colophon, and notes explaining that data is session-only and reload erases it.

---

## Verification & Publishing Workflow

Always run verification commands before merging/shipping:

```bash
# 1. Check TypeScript compilation
npx tsc --noEmit

# 2. Verify production bundler
npm run build

# 3. Preview local server
npm run dev
```

### Visual Verification Checklist
- [ ] Confirm cover matches the `coverStock`, `coverLayout`, and chosen `accent` seed.
- [ ] Verify the system glyph (★) appears at Cover dateline, Frame masthead, and Frame footer.
- [ ] Check mobile breakpoint ($\le$640px) to ensure titles do not break or overflow.
- [ ] Print preview (`Cmd+P` or Chrome DevTools print emulation). Ensure all stock colors collapse to dark ink on white, interactive buttons are hidden, and all interactive states stack instead of overlaying.
- [ ] File standalone edition at `artifacts/<N>-<slug>.html` and cite it in the issue's `audit` block in `<N>.ts`.
- [ ] Add the issue catalog entry to the index table in `docs/design-language.md`.
- [ ] Perform Playwright verification if testing interactive components.
