# Back Cover — Design Spec (verso surface)

> **Status:** Draft. Specifies the recurring back-cover surface for
> kernel.chat issues. Builds on the move named in ISSUE 379 (ON BECOMING
> A REAL MAGAZINE) and the character work in ISSUE 381 (ON PROVENANCE).
> No code shipped yet; this is the spec that makes shipping possible.

## I. Why the magazine has a back cover

Magazines have backs. POPEYE has its Sailor Popeye illustration on every
issue — the same character, the same brushwork, recognizable from across
a newsstand. Brutus uses the back for a recurring food still life.
PAPERSKY, when it carries one, runs a single quiet image with the
issue's place name set small below it. The back cover is a surface a
magazine cannot avoid having, because it is the surface a reader sees as
often as the front — every time the issue is set down face-up on a table.

The frame currently has no back. Every issue's cover is a front; the
inside flows into a feature; the feature ends with a sign-off; and then
the issue ends. There is no verso surface, no recurring back-cover slot,
no place for the small, slow, asymmetric work a magazine accretes over
time.

This spec adds one.

## II. The visual rule (one paragraph)

**One still-life subject per issue, photographed under one light setup,
laid out on one paper stock, with the issue's dateline and tomato spot
beneath.** The setup never changes; the subject rotates. The discipline
is in the repetition — by ISSUE 391 the back covers form a wall; by ISSUE
411 the wall reads as the magazine. The subjects are things the magazine
has touched in the issue or the work the magazine reports on: a working
tool, a piece of hardware, a printed document, a hand-drawn diagram, a
single typeface specimen.

## III. The subject conventions

Subjects must:

- **Be physical**, or photographable as if physical. Screens are
  discouraged unless the screen *is* the subject (e.g., a terminal cursor
  framed in a CRT). Digital renderings are permitted only when the
  rendering is itself the artifact.
- **Connect to the issue's argument** without illustrating it. The back
  is a *resonance*, not a recap. ISSUE 381 (ON PROVENANCE) might carry
  a back cover of a hand-stamped notary mark on a single sheet of cream
  paper; the notarisation isn't the topic of the issue, but the gesture
  is the issue's grammar.
- **Be small enough to hold in two hands**, or render small enough to
  feel held. Large landscapes are not the register. The implicit scale
  is desk, hand, table.
- **Carry one shadow.** One light source, one shadow direction. Every
  back cover honours the same fall of light so the series reads as a
  series.
- **Not include a person.** No portraits, no hands holding the object.
  The object stands alone. This isn't a portrait magazine; the back is
  not the place to break the rule.

Subjects must NOT:

- Be a screenshot of software (use the back of an issue *about* software
  for a different subject — the keyboard, the cable, the manual).
- Be a stock-photo-shaped object lit dramatically. The register is
  natural light, soft contrast, neutral background.
- Repeat a previous subject within 24 issues. The wall benefits from
  variation; near-repeats undermine the series.
- Carry secondary text overlays. Caption goes below the image, not on it.

## IV. The layout

```
┌──────────────────────────────────────────┐  ← top edge of back cover
│                                          │
│                                          │
│                                          │
│            ┌─────────────────┐           │
│            │                 │           │
│            │    SUBJECT      │           │
│            │   (still life)  │           │
│            │                 │           │
│            └─────────────────┘           │
│                                          │
│                                          │
│              [subject_jp]                │  ← 8pt EB Garamond italic
│                                          │
│              [subject_en]                │  ← 9pt Courier Prime caps
│                                          │
│                                          │
│  ★                              V·26     │  ← tomato glyph + dateline
└──────────────────────────────────────────┘  ← bottom edge
```

Margins follow the existing cover system. Subject occupies the centre
two-thirds vertically, centred horizontally. Caption sits below the
image with the same baseline rhythm as the masthead on the front cover —
so when an issue is folded open and both covers face the reader, the
typographic anchors align.

The ★ system glyph sits in the lower-left, the dateline in the
lower-right — mirrored from the front cover's monument number
placement. This is the only deliberate front/back symmetry.

## V. Paper stock for the back

The back inherits the issue's `coverStock` by default. Three deliberate
exceptions:

- **`'ledger'` stock for any issue whose front is `'ink'`.** Reading a
  matte back after a nocturnal front gives the verso a daylight register.
  ISSUE 381 (front: ink, back: ledger) is the first test.
- **`'cream'` always** if the back's subject is a printed document, a
  letter, a manuscript, a card. The stock matches the subject's
  material.
- **`'kraft'`** for issues whose subject is industrial — a hand-soldered
  PCB, a coiled cable, a tool with patina. Kraft signals "field" without
  the cover needing to.

## VI. The TypeScript surface

Add to `src/content/issues/index.ts`:

```ts
/**
 * Optional back-cover specification. When set, the issue carries a
 * verso surface — a recurring still-life subject under the established
 * back-cover layout. Subject rotates per issue; layout is fixed.
 *
 * See docs/back-cover-spec.md for the full design spec.
 */
export interface BackCoverSpec {
  /** Subject name in English, set as a small caps caption. */
  subject: string
  /** Subject name in Japanese, set in italic above the English caption. */
  subjectJp: string
  /**
   * Optional image asset path (relative to public/). If omitted,
   * renders a textured placeholder with the subject name set across
   * the centre — useful for issues that ship before the photograph is
   * commissioned.
   */
  image?: string
  /**
   * Paper stock for the back cover. Inherits the issue's front
   * `coverStock` if omitted. See §V of back-cover-spec.md for the
   * deliberate exceptions.
   */
  stock?: IssueCoverStock
  /**
   * Optional photographer credit. Appears in the colophon, not on the
   * back cover itself.
   */
  photographer?: string
}
```

And on `IssueRecord`:

```ts
export interface IssueRecord {
  // ... existing fields ...

  /** Optional back-cover specification. Leave undefined to omit the
   *  verso surface for this issue. See docs/back-cover-spec.md. */
  backCover?: BackCoverSpec
}
```

## VII. The React component (signature only)

```tsx
// src/components/IssueBackCover.tsx

import type { BackCoverSpec, IssueCoverStock } from '../content/issues'

interface IssueBackCoverProps {
  backCover: BackCoverSpec
  /** The issue's dateline — usually the same value passed to the front. */
  dateline: string
  /** Fallback stock if backCover.stock is undefined. */
  inheritedStock: IssueCoverStock
}

export function IssueBackCover(props: IssueBackCoverProps): JSX.Element
```

Renders a single `.pop-back-cover` block with the layout described in §IV.
Lives next to `IssueCover.tsx` in `src/components/`. The CSS goes in
`src/pages/LandingPage.css` next to `.pop-cover*` rules; class prefix
`.pop-back-cover` so future overrides are localised.

## VIII. The route

```
GET /:issueNumber/back
```

Renders the back cover full-bleed on its own page, matching the existing
front-cover route's layout but mirrored. Suitable for direct linking and
for the print stylesheet (where the verso is its own physical page).

The catalog route (when built, per ISSUE 379) shows the back-cover
thumbnails alongside the fronts in a separate row, so the archive wall
reveals both surfaces at once.

## IX. The print discipline

The back cover is the move that makes print real. A digital-only back
cover is harmless; a printed back cover constrains the magazine in a
way the front does not. The print stylesheet for the back must:

- Set the back as a separate `@page` with no chrome.
- Hold the ★ glyph and dateline at the same baseline as the front's
  monument number, so the issue lays flat with aligned anchors.
- Use the back's `stock` (not the front's) for the background tone.
- Suppress all interactive chrome — no navigation, no hover states, no
  outlines.

Hit ⌘P from `/:issueNumber/back` and the result should be a single PDF
page a short-run printer would accept without modification.

## X. The first ten back covers

Concrete subjects, in the order I'd commission them. Adjust by issue
context as you go.

| # | Subject | Stock | Rationale |
|---|---|---|---|
| 381 | A hand-stamped notary mark on cream paper | ledger | The grammar of provenance, made physical |
| 382 | A coiled patch cable, copper-tipped | kraft | Working tools, hand-scale |
| 383 | An open ledger with hand-drawn audit trail in tomato ink | cream | The audit chain, before software made it digital |
| 384 | A single typewriter key, "TAB," removed from its row | ivory | The pause between actions |
| 385 | A Polymarket trade slip printed and folded once | butter | The prediction-market wedge, as physical artifact |
| 386 | A signed SEC EDGAR cover page on cream paper | cream | What "filing" used to mean |
| 387 | A hand-set wood-type uppercase R, slightly off-register | kraft | The R for "replay," made by hand |
| 388 | A working brass key on a leather fob | kraft | Material custody |
| 389 | A folded EU AI Act Annex IV page with handwritten margin notes | ledger | The compliance artifact as paper |
| 390 | A used cassette tape labelled in Japanese | ivory | Memory, written down once, played many times |

Two rules visible in the list: nothing is digital; each subject points
sideways at the issue's argument without illustrating it. By 390 the
wall has its first ten objects. The character of the back is the
intersection of those ten objects — not any single one.

## XI. Photography conventions

Until commissioned originals exist, the system supports four fallback
shapes, listed in increasing fidelity:

1. **Textured placeholder block.** A flat colour swatch matching the
   back's stock, with the subject's `subjectJp` and `subject` set in the
   centre. Useful for ISSUEs filed faster than the photograph can be
   commissioned.
2. **Stock photograph (last resort).** A neutral, isolated object photo
   from a license-cleared source, processed through a single LUT (warm
   shadow, matte highlights). Marked in the colophon as "stock."
3. **In-house photograph.** Phone or DSLR, natural light, neutral
   backdrop. Edited to match the LUT. Marked with the photographer's
   name.
4. **Commissioned photograph.** Real photographer, real light setup, the
   subject brought into the studio or the studio brought to the
   subject. Marked with the photographer's name.

Aim for shape (3) by ISSUE 384 and shape (4) by ISSUE 390. Skip shape (2)
unless absolutely necessary; stock photography is the visual register the
magazine has deliberately avoided since the beginning, and the back
cover is not the place to start using it.

**Addendum (added with ISSUE 381):** a fifth shape exists in practice
when a real photograph cannot be commissioned in time but the magazine
wants more presence than the textured-block fallback (1):

5. **AI-generated placeholder.** A generated image, credited honestly
   in the `photographer` field as the model + service that produced
   it, with an explicit `placeholder` or `commission pending` tag in
   the credit string. Held to the same subject-discipline rules of
   §III: no people, no readable text, single-shadow lighting, neutral
   background. Replaced as soon as a commissioned shape (4) is in
   hand. The honesty primitive: never let a placeholder pass as a
   commissioned photograph in the colophon. ISSUE 381 is the first
   instance and the precedent — read its `photographer` field for
   the format.

Shape (5) is permitted, not preferred. The discipline is to move
toward shape (4) for every back cover on a defined timeline, not to
stay on shape (5) for the long run.

## XII. What this is not

- **Not a place for advertising.** The back is editorial surface. If the
  magazine ever runs sponsored placements, they belong inside the issue
  with a clear demarcation, not on the back.
- **Not a recap of the issue.** The back doesn't summarise. It resonates.
- **Not a place for the wordmark.** The wordmark belongs on the front.
  The back is signed only by the ★ glyph and the dateline.
- **Not a portrait surface.** No people. The object stands alone. (See
  §III.)

## XIII. The discipline radiating outward

Once the back exists, three other moves get easier:

- **Print** (ISSUE 379's named move) — the back is the second page that
  forces print to be real.
- **Catalog wall** — back covers form a second row of thumbnails the
  archive view can show alongside the fronts.
- **Per-issue Japanese display word** — the back's `subjectJp` is a
  natural place to introduce the hand-drawn JP register, since the
  caption is small and the commission cost is low.

The back cover is the smallest move that makes the next three moves
easier. That's why this spec is dated before any of the others ship.

---

*Spec by kernel.chat group · May 2026 · CC BY 4.0. Forkable into other
serial publications considering the same question.*
