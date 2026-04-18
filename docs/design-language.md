# Design Language — kernel.chat

> An editorial homage to **POPEYE Magazine** (Tokyo, Magazine House Co.).
>
> The site itself never names this inspiration. This document is for
> contributors so the design system stays coherent across future pages
> and issues.

---

## Why POPEYE

POPEYE — *Magazine for City Boys* — is a 50-year-old Japanese style
magazine. Its design grammar is one of the most disciplined editorial
systems in print: warm paper stocks, a single spot color (tomato red),
bracketed kicker categories, numbered catalogs, bilingual JP/Latin
lockups, and a confident feature monument on every cover.

We borrowed all of that.

The thought experiment that shaped the redesign:

> *What would a POPEYE × kernel.chat collab issue look like if Magazine
> House let the kbot terminal write the field reports?*

Answer: warm editorial frame around a quiet utility core. Loud cover,
quiet command line. Bilingual everywhere. Tomato as the only spot
color. Every release is **ISSUE N · MONTH YEAR** — like a magazine
back-catalog, not a changelog.

The site never says "POPEYE." The grammar carries the homage on its own.

---

## Editorial neighbours

POPEYE is the spine. Around it we keep a working file of **editorial
neighbours** — magazines whose mechanics we want to learn from
without imitating. Each entry below is a quick decode (what makes
the cover read as that magazine) plus a short list of transferable
mechanics (what we could borrow without it reading as homage to a
second magazine on top of POPEYE). This section grows as we
encounter new references; future entries follow the same shape.

### PAPERSKY

PAPERSKY (Tokyo, 2002–present, founded by
Lucas Badtke-Berkow / Knee High Media — rebranded as PAPERSKY Inc.
in 2024) is a quieter cross-reference. Self-described as **"a
different way to travel,"** it runs roughly quarterly, bilingual
JP/EN, anchored each issue to a single place — most issues built
around a walking, hiking or cycling route through it. The
SHIMANAMI issue (#69 "Dreamy") is built around the Setouchi
Shimanami Kaido, the ~70 km route from Onomichi (Hiroshima) to
Imabari (Ehime) across the Seto Inland Sea.

We do not want to look like PAPERSKY — its serene white-bordered
single-photo cover is so identifiably PAPERSKY that direct mimicry
would read as homage to a second magazine on top of the first.
What we want from it is a **small set of mechanics** the POPEYE
grammar doesn't already give us.

#### The PAPERSKY cover, decoded

| Element | What it does | Notes |
|---|---|---|
| Single full-bleed photograph in natural light | Functions as the cover headline; no cover lines compete with it | Available light, candid, place-led. Editorial brief, not layout rule |
| Generous white border around the photo | Reads as gallery print, not magazine bleed | Margin, not bleed |
| Sans-serif white wordmark set high, modest scale | Stable masthead across every issue | Geometric sans, all-caps, tight tracking |
| All-caps Latin subtitle ("A DIFFERENT WAY TO TRAVEL") | Stable tagline under the wordmark | Tracked tight |
| Custom JP display lettering for the issue's place name | Per-issue signature gesture | Hand-drawn or commissioned per issue — never a system font |
| Paper-airplane glyph below the place word | Recurring folio / wayfinding mark | The "paper" + "sky" rebus, used as a small system element |
| Centred place dateline at the bottom (e.g. "HIROSHIMA & EHIME") | Postmark, not subtitle | Small-caps Latin |

#### Transferable mechanics

Things kernel.chat could borrow without copying the silence:

1. **Per-issue custom display lettering for the topic word**, paired
   with the stable Latin wordmark — gives every issue an identity
   without breaking the masthead. Our equivalent is the
   `headline.emphasis` italic-tomato word; the move PAPERSKY suggests
   is occasionally commissioning a hand-drawn JP word for
   `featureJp` or for the cover's secondary lockup, instead of
   defaulting to the body type.
2. **A small recurring glyph as a system folio mark** — PAPERSKY
   uses a paper airplane. We could reserve a single mark (a tomato
   spot, a kernel, a caret, a block-quote bracket) and use it
   consistently as the cover/section/page-number ornament. We
   already have `<PopIcon>` infrastructure for this; the discipline
   we lack is using **one** glyph as a system thread, not eleven.
3. **Centred place / topic dateline as postmark** — small-caps Latin
   anchored at the bottom centre of the cover, separate from the
   monument. Could co-exist with the existing bottom-right monument
   on `classic` layout, or replace it on a future `postmark` cover
   variant.
4. **One-photo cover with a real margin** — for the rare future
   issue where photography is the right voice (a place dispatch, a
   field report, a maker profile). Resist cover lines; let the
   image be the headline. We have not shipped this yet — would
   need a new `coverLayout: 'photo-postmark'` variant.
5. **Photographic register rule** — when we do use photography,
   commit to natural light, place-led, candid, no studio gloss.
   This is a brief to photographers, not a CSS rule.
6. **Issue-as-place** — anchor each issue to one subject (a route,
   a problem, a maker, a fish) rather than a mixed bag. We already
   do this; PAPERSKY confirms the discipline.

#### What's PAPERSKY-distinctive vs widely shared

The bilingual parallel text and the place-anchored issue concept
are **table stakes** in the JP indie ecosystem (POPEYE, &Premium,
Brutus, Subsequence). The **distinctive** PAPERSKY moves are the
per-issue custom JP display word, the paper-airplane folio glyph,
the postmark dateline, and the disciplined white margin around a
single quiet hero image. Borrow the mechanics; do not borrow the
silence — kernel.chat has a louder voice.

---

## The system

### Tokens (`src/index.css:118-150`)

**Stocks** — warm paper grounds:
- `--pop-ivory` `#FAF9F6` — primary white ground
- `--pop-cream` `#F3E9D2` — warm secondary stock
- `--pop-butter` `#EFD9A0` — summer / reading issue stock
- `--pop-sepia` `#D4C5A9` — muted accent
- `--pop-kraft` `#C8A97E` — camel / outdoor issue
- `--pop-coffee` `#6B4E3D` — warm brown text
- `--pop-ink` `#1F1E1D` — primary dark ground

**Spot color** — the punch:
- `--pop-tomato` `#E24E1B` — banners, rules, italic em accents,
  catalog numbers, terminal prompt. The only spot color the press
  needs to mix.
- `--pop-tomato-soft` — 8% tomato wash for hover states

**Reserved accents** (defined, not yet used — earmarked for future
issue variants):
- `--pop-cobalt` `#1D4E89` — winter issue
- `--pop-ivy` `#2E4A2E` — nature issue
- `--pop-pool` `#4FB5C8` — terminal agent label

**Editorial rules**:
- `--pop-hairline` — 0.5px ink rule
- `--pop-hairline-soft` — 16% opacity rule
- `--pop-tape` — butter tape overlay

**Terminal traffic-light dots** (mac-style chrome):
- `--pop-term-red`, `--pop-term-yellow`, `--pop-term-green`

### Type stack

- **Display + prose**: EB Garamond → `var(--font-serif)`
- **Meta + code**: Courier Prime → `var(--font-mono)`

Nothing else. No system fonts, no sans-serif.

### Primitives (`src/index.css:29320+`)

| Primitive | What it is | Where it appears |
|---|---|---|
| `.pop-rule` | Hairline divider (1px) | Section breaks |
| `.pop-rule--tomato` | 2px tomato spot rule | Section accents |
| `.pop-rule--short` | 64px max-width centered rule | Under kickers |
| `.pop-kicker` | Bracketed `[CATEGORY · 日本語]` mono label | Every section head |
| `.pop-banner` | Tomato tag box (reverses to ivory text) | Issue banner, tags |
| `.pop-hash` | `#tag` chip | Cover stats |
| `.pop-catalog-num` | `001.` numbered item (tabular nums) | Catalog rows, cards |
| `.pop-price` | `¥0 · BYOK` price tag | Cover masthead |
| `.pop-monument` | Stacked issue-number block | Cover bottom-right, colophon |
| `.pop-bilingual` | Latin/JP lockup wrapper (`.pop-latin` + `.pop-jp`) | Catalog cards, specialist cards |
| `.pop-display` | EB Garamond display headline (italic em → tomato) | All section titles |
| `.pop-swash` | Italic coffee accent | Decks, subtitles |
| `.pop-stock-*` | Paper ground (cream/butter/kraft/ivory/ink) | Whole sections |
| `.pop-row` | Catalog row grid (num · label · badge) | Table of contents |
| `.pop-folio` | Page number / byline / date strip | Masthead, frame footer |
| `.pop-section-header` | Editorial lockup (kicker + rule + title) | Every section |
| `.pop-section-title` | Large display title | Section titles |
| `.pop-section-header--on-ink` | Dark mode variant | Field report, Security, Bench |
| `.pop-feature-jp` | Mono Japanese subtitle | Feature hero, page heads |
| `.pop-term-dot` | Terminal traffic-light (red/yellow/green) | All terminal demos |

### MagazineFrame (`src/components/MagazineFrame.tsx`)

A wrapper that gives every inner route the same masthead strip + folio
footer as the cover — wordmark + ISSUE · MONTH YEAR + page kicker on
top, "← BACK TO COVER" + folio on bottom. Optional `title` /
`titleJp` / `deck` for pages that want a full editorial head block,
or just the wrapper strip for pages that keep their own hero. `dark`
mode for ink-ground pages.

### Issue metadata (`src/content/issue.ts`)

Every release is a new issue. Cover, masthead, folios all read from a
single typed `ISSUE` object:

```ts
{ number: '360', month: 'APRIL', year: '2026',
  feature: 'THE URBAN OUTDOORS REVIEW',
  featureJp: '都会のコードと、自然のOS',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために' }
```

Bumping the issue is a one-line change.

### Print stylesheet (`src/index.css` `@media print`)

The design begs to be printable. Print:
- A4 page, ink on white, all stocks collapse
- Tomato preserved as press spot color
- Interactive chrome hidden (CTAs, install pill, nav, buttons)
- URLs exposed beside inline links
- `page-break-inside: avoid` on sections, cards, rows
- Display sizes in points

Print any route (`Cmd+P`) for the printable zine form.

---

## Application matrix

| Route | Wrapper | Stock | Dark | Section heads | Bilingual |
|---|---|---|---|---|---|
| `/` Landing | — (cover) | cream / butter / ivory / ink mixed | mixed | ✓ on every section | ✓ catalog + specialists |
| `/security` | MagazineFrame | ink | ✓ | ✓ tomato kickers, on-ink | section-head only |
| `/bench` | MagazineFrame | ink | ✓ | ✓ tomato kickers, on-ink | section-head only |
| `/privacy` | MagazineFrame | cream | — | h2s get tomato spot rule via CSS | masthead only |
| `/terms` | MagazineFrame | cream | — | h2s get tomato spot rule via CSS | masthead only |

---

## Rules for contributors

1. **Never name the inspiration on the site.** The grammar carries
   the homage. No "POPEYE" copy in user-visible surfaces.
2. **Never hardcode color or font.** Always go through `--pop-*`,
   `--font-serif`, `--font-mono`.
3. **Never use inline styles** for color, font, or spacing. Extract
   to CSS classes per `.claude/rules/components.md`.
4. **Bilingual everywhere it fits.** Catalog items, section heads,
   page titles — wrap in `.pop-bilingual > .pop-latin / .pop-jp`.
5. **Tomato is the only spot color.** Don't introduce a second
   accent without proposing a new issue-variant token (cobalt /
   ivy are reserved for that).
6. **Every release is an issue.** Bump `src/content/issue.ts` on
   each version. Don't ship a kernel.chat update without
   incrementing the issue number — like a real magazine.

---

## Editorial tools — per-feature modules

Different issues need different tools. An essay wants section
kickers, drop caps, and a pull quote. An interview wants a subject
dossier and a Q&A format. A recipe (future) wants an ingredient
list and a method block. Rather than force every feature into one
layout, the `spread` field on `IssueRecord` is a **discriminated
union** — each issue picks the right tool, and the
`IssueFeature` router renders the matching component.

### Current tools

| Tool | `spread.type` | Component | Used by | Grammar |
|---|---|---|---|---|
| Essay | `'essay'` | `EssayFeature` | ISSUE 363 | Mono section kickers, serif prose, drop cap on lead paragraph, tomato pull-quote, sign-off |
| Interview | `'interview'` | `InterviewFeature` | (available) | Subject dossier card with tomato corner badge, alternating Q./A. blocks, drop cap on final answer |

### How to add a new tool

1. Extend `IssueSpread` in `src/content/issues/index.ts` with a new
   member of the union, e.g. `{ type: 'recipe', ... }`.
2. Build `src/components/<Name>Feature.{tsx,css}` following the
   `EssayFeature` / `InterviewFeature` conventions.
3. Add a case to the switch in `src/components/IssueFeature.tsx`.
4. TypeScript's exhaustiveness check will flag any variant that
   isn't handled.

### Tools worth adding next

- **`recipe`** — ingredients list (numbered rows), method block
  (numbered steps), field variables (time, yield, temp). POPEYE
  runs these in food issues.
- **`review`** — product review grid: 4–6 cards with rating,
  price, pros/cons. Good for gear / tools / café issues.
- **`letters`** — reader letters column: one block per letter
  with italic signature right-aligned.
- **`dispatch`** — field report: location-date header, monospace
  diary entries, observation notes.
- **`gallery`** — when images arrive: caption-first photo grid.

---

## The toolkit — four layers

Inspired by how designers work across Illustrator, Photoshop,
InDesign, and Adobe Express (or their Figma equivalents), the
kernel.chat magazine is a four-layer toolkit. Each layer has a
distinct job; each issue picks what it needs from each.

| Layer | Adobe analog | Figma analog | What it does | Status |
|---|---|---|---|---|
| Layout + text flow + features | **InDesign** | Pages + auto-layout | Grid, masthead/frame, feature modules (essay / interview / forecast) | ✅ shipped |
| Ornaments — shape, icon, path-text | **Illustrator** | Components (vector) | Editorial marks that compose inside any feature | ✅ shipped |
| Images + textures | **Photoshop** | Image fills | Photography, overlays, raster texture | ⏸ deliberately skipped |
| Template builders | **Adobe Express** | Community templates | One-call issue helpers so authoring is faster | ⬜ next |

### Ornaments — the Illustrator layer

Three families of decorative primitive, all in `src/components/ornaments/`:

#### `<PopShape />` — geometric marks
Tokenized shapes for editorial badges, corner marks, dividers.
Renders as inline SVG taking `currentColor` so it adopts the ink
of wherever it sits.

| name | use |
|---|---|
| `circle` · `ring` · `dot` | counters, corner badges, index markers |
| `square` · `lozenge` | subject-card corner badges, feature tags |
| `triangle` · `star` | flags, anniversary covers, play buttons |
| `slash` | diagonal accent, strike-through headlines |

Sizes: `sm · md · lg` (all via `clamp()` — mobile-first).
Colors: `tomato · ink · coffee · ivory · current`.
Optional `label` prop centers mono text inside the shape.

```tsx
<PopShape name="lozenge" size="md" color="tomato" />
<PopShape name="circle" size="lg" label="03" />
```

#### `<PopIcon />` — editorial pictograms
Hand-tuned inline SVGs with a slightly thicker editorial stroke.
Not Lucide / Feather / Material — these speak the magazine's
type weight.

Icons: `arrow · asterisk · sparkle · leaf · coffee · sun · moon ·
book · pin · quote · thread · pilcrow`. Sizes: `sm · md · lg`.
Takes `currentColor`.

```tsx
<PopIcon name="asterisk" size="sm" />
<PopIcon name="arrow" aria-label="continue" />
```

#### `<PopPathText />` — writing along a path
SVG `<textPath>` primitive for curved headlines, arc signoffs,
wavy drop-in ornaments.

Presets: `arc-top · arc-bottom · wave`. Custom `d` supported for
bespoke curves.

```tsx
<PopPathText text="Summer is Here" preset="arc-top" color="tomato" />
```

### Editorial tools — per-feature modules (InDesign layer)

Different issues need different tools. An essay wants section
kickers, drop caps, and a pull quote. An interview wants a subject
dossier and a Q&A format. The `spread` field on `IssueRecord` is a
**discriminated union** — each issue picks the right tool, and the
`IssueFeature` router renders the matching component.

| Tool | `spread.type` | Component | Used by | Grammar |
|---|---|---|---|---|
| Essay | `'essay'` | `EssayFeature` | ISSUE 363 | Mono section kickers, serif prose, drop cap on lead paragraph, tomato pull-quote, sign-off |
| Interview | `'interview'` | `InterviewFeature` | (available) | Subject dossier card with PopShape corner lozenge, alternating Q./A. blocks, drop cap on final answer |

#### How to add a new tool

1. Extend `IssueSpread` in `src/content/issues/index.ts` with a new
   member of the union, e.g. `{ type: 'recipe', ... }`.
2. Build `src/components/<Name>Feature.{tsx,css}` following the
   `EssayFeature` / `InterviewFeature` conventions.
3. Add a case to the switch in `src/components/IssueFeature.tsx`.
4. TypeScript's exhaustiveness check will flag any variant that
   isn't handled.

#### Tools worth adding next

- **`recipe`** — ingredient list, method block, field variables.
- **`review`** — product review grid, ratings, pros/cons.
- **`letters`** — reader letters column.
- **`dispatch`** — field report, location/date header.
- **`gallery`** — when images arrive: caption-first photo grid.

---

## Mobile design philosophy

Mobile is **primary**, not responsive. Six principles guide every
layout decision:

1. **Mobile is the cover.** Design at 393px first; scale up.
2. **The thumb is the turn-of-page.** 44px tap targets everywhere,
   no sticky nav, no hamburger menu, no horizontal scroll (except
   deliberate editorial moves like wide tables).
3. **Type-first, never card-first.** No rounded-rectangle UI
   chrome. The pop-* primitives are all typographic — pop-kicker,
   pop-banner, pop-folio, pop-rule.
4. **Warm grounds beat pure white.** Ivory/cream/butter/kraft stocks
   soften mobile blue-light. No pure `#ffffff`. No dark mode (the
   ink stock handles dark sections on a per-section basis).
5. **Generous vertical rhythm, tight horizontal frame.** 18–22px
   horizontal padding on ≤640px; `line-height: 1.6+` for serif
   prose.
6. **One issue per session.** Linear read: cover → feature → next.
   No discovery UI, no menus, no app-shell. The issue is the app.

### Implemented rules

- All `.pop-landing` and `.pop-frame` use `env(safe-area-inset-*)`
  so iPhone notch + home indicator are respected.
- `prefers-reduced-motion` disables transitions site-wide.
- Every layout variant has a mobile-first `clamp()` pass.
- Ornaments (PopShape, PopIcon, PopPathText) use `clamp()` sizing
  by default.

---

## Ambient motion — the two accents

A print-inspired magazine is mostly still on the web. A book
doesn't animate itself. But two very small ambient moves keep
the page from feeling dead — both respect
`prefers-reduced-motion` via the site-wide override in
`src/index.css` (animation-duration collapses to 0.01ms).

| Accent | Where | Spec |
|---|---|---|
| Tomato rule breath | Every `.pop-rule--tomato` | Opacity 0.92 ↔ 1.00, 3.3s period (0.3Hz). CSS keyframe `pop-rule-breath`. |
| Dateline marquee | Cover dateline JP tagline | ~4px/second horizontal drift via `.pop-marquee` + `.pop-marquee-track`. Static folio beside it stays still. Mask gradient softens the entry/exit edges. |

Both are deliberately subtle — a reviewer should have to be told
they exist. The tomato rule breath is also the one motion token
shared with the TikTok grammar, a quiet cross-medium tie-in.

**Rules for new ambient motion:**
1. Must be imperceptibly small (amplitudes ≤ 8% opacity or
   ≤ 4px translate).
2. Must respect `prefers-reduced-motion`.
3. Must be CSS-only — no JS animation libraries, no Framer
   Motion, no `requestAnimationFrame`.
4. Must not trigger layout or repaint hotspots — animate only
   `opacity` and `transform`.
5. Before adding a third ambient accent, audit whether the
   existing two are enough. The site's character is stillness
   with two quiet accents — not a gallery of ambient effects.

---

## Future moves (not yet shipped)

- PDF export per route — actual printable issue file
- Cobalt / ivy / pool accents wired to seasonal issue variants
- Template builder layer (Adobe Express analog): one-call helpers
  like `createEssayIssue({...})` that fill in defaults
