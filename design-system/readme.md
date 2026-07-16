# kernel.chat — Design System

> *Magazine for City Coders · 街のコーダーのために*

kernel.chat is an independent **editorial magazine**. Every product release ships
as an **ISSUE N · MONTH YEAR** — like a magazine back-catalog, not a changelog.
The visual grammar is an unnamed homage to **POPEYE Magazine** (Tokyo): warm
paper stocks, a single tomato spot colour, bracketed kicker categories, numbered
catalogs, bilingual JP/Latin lockups, and a confident issue monument on every
cover.

The site **never names the inspiration**. The grammar carries the homage on its
own. Loud cover, quiet command line. Tomato is the only spot colour the press
mixes. Inside the loud editorial frame sits a quiet utility core — the terminal /
field-report motif.

This system is **editorial only**. It is the design language of the magazine
surface (landing, issues, the Pressroom, the colophon) — not an app UI kit.

## Sources

Reverse-engineered from a snapshot codebase:

- **Codebase**: `kernel-chat-site/` (a clean copy of the kernel.chat magazine
  site — React/Vite). Key references:
  - `docs/design-language.md` — the full editorial grammar (POPEYE + PAPERSKY +
    WIRED editorial-neighbours framework, issue identity catalog, ornaments).
  - `src/index.css` — the production token block + `pop-*` editorial primitives.
  - `src/components/IssueCover.tsx`, `src/pages/LandingPage.{tsx,css}`,
    `src/components/IssueContents.tsx`, `src/components/EssayFeature.tsx` — the
    magazine surface.
  - `src/content/issues/` — the typed issue archive (issues 360–390).
  - `src/components/ornaments/` (`PopIcon`, `PopShape`, `PopPathText`) — the
    editorial illustration layer.
- The reader is not assumed to have access; paths are recorded in case they do.

---

## CONTENT FUNDAMENTALS

How the magazine writes — editorial, bilingual, catalog-led.

- **Magazine vocabulary in user copy.** issue · spread · folio · monument ·
  colophon · dateline · feature · catalog. A release is an *issue*; a section is
  a *spread*; a footer is a *colophon*; a release date is a *dateline*.
- **Bilingual everywhere it fits.** Latin display over a Japanese subtitle.
  Catalog items, section heads, page titles: `CONTENTS · 目次`,
  `FEATURE · 特集`. EN-primary with selective JP (the inverse of POPEYE).
- **Casing.** Mono meta is **UPPERCASE** with wide tracking
  (`[ FIELD REPORT · 実地報告 ]`). Serif display is **sentence case**
  (*"The Urban Outdoors Review"*, *"In this issue"*). Never title-case headlines.
- **Kickers are bracketed**: `[ CATEGORY · 日本語 ]`. Italic emphasis inside a
  serif headline turns tomato (`The *Urban Outdoors* Review`).
- **Numbers are catalog numbers**: `001.` `002.` — padded, tabular, tomato.
- **Pull-quotes** are the most-quotable italic line, or — WIRED-style — the
  *measurement* itself (`8.8×`, `670 → 105`).
- **Tone**: confident, dry, specific. Field-report energy. Short paragraphs; let
  the whitespace breathe. A sign-off line ends every feature, italic and placed:
  *"Filed from a fifth-floor walk-up, with the window open."*
- **Every release is an issue.** Bump the issue number like a real magazine.

### Emoji & symbols
- **No emoji.** Anywhere. The system has exactly **one** recurring small mark:
  the **asterisk ★** (the folio glyph). That is the whole symbol budget.
- Unicode used functionally only: `·` (middot separator), `→` `←` (arrows in
  "back to cover" / continue), `¥` (price), `✓` (feature checks).

---

## VISUAL FOUNDATIONS

### Colour
- A warm **Rubin neutral base** (ivory→slate) + the **POPEYE layer** (paper
  stocks + tomato). See `tokens/colors.css`.
- **One spot colour.** `--pop-tomato #E24E1B` is the *only* spot — banners,
  rules, italic em, catalog numbers, terminal prompt, drop caps. Never introduce
  a second without proposing a new issue-variant token.
- **Reserved accents** (`--pop-cobalt`, `--pop-ivy`, `--pop-pool`) exist for
  future issue variants; only `pool` is in live use (the terminal agent label).
- **The purple `--rubin-primary #6B5B95`** is reserved for the **logo mark** (the
  ink-drop "K" seed) only — not a UI accent.
- **Never pure `#ffffff`.** Warm grounds soften blue-light: ivory `#FAF9F6`,
  cream `#F3E9D2`, butter, kraft, ledger. Each paper stock *signals an issue
  register* (cream = anchor, ink = night, kraft = field, ivory = sober/method,
  ledger = audit, butter = summer/reading).

### Type
- **Two Latin faces and one Japanese companion. No generic UI sans-serif.**
  - **EB Garamond** → all display + prose. 800 for the wordmark, 700 headlines,
    400 body. Tight tracking (−0.06 to −0.025em) on display; +0.02em on body.
    Old-style figures (`onum`) on. Italic carries emphasis (→ tomato in display).
  - **Courier Prime** → Latin meta: kickers, folios, banners,
    catalog numbers, code, terminal. Uppercase, +0.14em tracking (caps), tabular
    figures.
  - **Noto Serif JP** → Japanese subtitles and parallel text, with restrained
    tracking. It is the bilingual companion, not a third Latin register.
- **Scale** is a Major Third (1.25); body = **20px** (the magazine reads like
  print). See `tokens/typography.css`.

### Backgrounds & imagery
- **Warm paper grounds**, never gradients. Sections sit on a single stock; the
  *ink* stock handles dark on a per-section basis (no global dark mode).
- **Imagery register** (when used): warm, hand-drawn, retro-computing
  illustration — see `assets/portfolio_*.png` (a wood-grain "A.I. TERMINAL"
  with a phosphor-green screen, paper grain, hand-inked linework). Natural
  light, place-led, candid — never studio gloss, never bluish-purple AI gradient
  slop. Photography is deliberately rare (the Photoshop layer is "skipped").
- **No repeating patterns**; ornaments are hand-tuned per-issue SVGs
  (ink-spread blot, warty-spots, flash-burn) — never systemwide texture.

### Borders, rules & shadows
- **Hairlines, not boxes.** The divider system is the `pop-rule` family: 1px
  ink, 16%-opacity soft, and the 2px **tomato rule** (which *breathes*
  imperceptibly — opacity 0.92↔1.00 over 3.3s).
- **Editorial surfaces stay square.** The only "shadow" is the terminal's hard
  **tomato offset block** (`8px 8px 0`), not a soft drop. Soft radii + warm
  shadows (`--shadow-sm/md/lg`) are reserved for the few framed surfaces (an
  install pill, an inset card).
- **Cards**: the magazine has almost no rounded-rectangle chrome — it is
  type-first (kicker + rule + title lockups, hairline-separated catalog rows).

### Layout
- **Mobile is primary**, not responsive. Design at 393px first, scale up. 44px
  tap targets. No sticky nav, no hamburger, no horizontal scroll.
- **Type-first, never card-first.** Generous vertical rhythm, tight horizontal
  frame (18–22px padding ≤640px). `line-height: 1.6+` on serif prose.
- **One issue per session** — linear read: cover → feature → next. The issue is
  the app; no discovery UI, no menus.
- `env(safe-area-inset-*)` respected (notch / home indicator).

### Hover / press / focus
- **Hover**: editorial rows take an 8% tomato wash; the install pill *inverts*
  to tomato; links/CTAs warm toward tomato.
- **Press**: a 1px downward translate (`:active`). No scale-shrink.
- **Focus**: `--rubin-accent` 2px outline, 2px offset.
- **Transitions** are quick (150ms) on `--ease-out` `cubic-bezier(0.16,1,0.3,1)`.

### Motion — stillness with two accents
The magazine is paper; it is mostly still. The character is **stillness**, not a
gallery of effects. Rules: CSS-only (no JS animation libraries), animate only
`opacity` / `transform`, always `prefers-reduced-motion`-gated.

The whole **ambient** budget is two imperceptible moves (amplitude ≤8% opacity /
≤4px translate):
1. **Tomato rule breath** — opacity 0.92↔1.00, 3.3s (`pop-rule--tomato`).
2. **Dateline marquee** — JP tagline drifts ~4px/s (`pop-marquee`).

Beyond ambient, the motion layer (`primitives/motion.css`) ships:
- **Entrance** — one-shot `pop-anim-settle` / `pop-anim-fade-up` with `pop-anim-d1…d5`
  stagger, run on load *from* hidden so print/PDF/reduced-motion show content.
- **Functional micro-motion** — `pop-anim-msg` (8px message slide-in), `pop-typing`
  (thinking dots).
- **The loading constellation** (`pop-constellation` / `<KernelLoading>`) — the
  signature "ink on paper" loader: macro drift (ink diffusing) + micro tremor
  (surface tension) + thread pulse (the binding rhythm).

No bounce, no parallax, no infinite decorative loops on content.

---

## ICONOGRAPHY

**No emoji, ever.** The editorial layer carries its own pictograms.

### Editorial pictograms — `<PopIcon>` (`src/components/ornaments/`)
Hand-tuned inline SVGs with a thicker **1.75px editorial stroke** — deliberately
*not* Feather/Lucide; they speak the magazine's type weight. Vocabulary:
`arrow · asterisk · sparkle · leaf · coffee · sun · moon · book · pin · quote ·
thread · pilcrow`. Used sparingly as section markers / sign-offs — never as UI
buttons.

- **The one system glyph**: the **asterisk ★** (PopIcon `asterisk`). It is the
  single recurring mark, threaded through every folio strip (cover dateline,
  frame masthead, frame footer). Tomato, 0.85em of the folio text, 6px right
  margin. Reproduced inline in the brand cards and the Magazine kit — copy that
  3-line SVG rather than reaching for a library.
- Other PopIcons are available for single-use editorial accents inside a
  specific issue, but **none are systemwide**. A system with eleven small marks
  has none. We have one. Keep it.
- `<PopShape>` (geometric badges: circle/ring/lozenge/star/slash) and
  `<PopPathText>` (text-on-a-curve) round out the illustration layer.

### Logos (`assets/`)
- `logo-mark.svg` / `.png` — an EB Garamond italic **K** in purple inside a sepia
  ring, with a purple **ink-drop "seed"** below it.
- `logo-wordmark.svg` — *kernel* in EB Garamond italic, slate, purple dot.
- `logo-full.svg` — mark + wordmark lockup. `logo-minimal.svg` — ring + seed
  only. `logo-maskable.svg` / `logo-dark.svg` — PWA / dark variants.
- The **magazine masthead** is set live in EB Garamond 800 *tomato* with a coffee
  offset shadow (`pop-wordmark`) — distinct from the purple mark.

---

## INDEX — what's in this folder

### Foundations
- `styles.css` — **the entry point.** `@import`s only; consumers link this.
- `tokens/` — `colors.css` · `typography.css` · `spacing.css` · `fonts.css`.
- `primitives/` — shipped utility-class layers:
  - `editorial.css` — the core `pop-*` grammar (kicker, banner, monument, rule,
    catalog row, folio, wordmark, terminal, stocks, system glyph, section
    header, bilingual lockup, swash).
  - `spreads.css` — the feature-spread layouts (essay, interview, forecast,
    dispatch, review).
  - `ornaments.css` — `pop-shape-*` / `pop-icon-*` / `pop-path-text-*`.
  - `frame.css` — inner-page `pop-frame-*` masthead/footer + `pop-colophon-*`.
  - `cover.css` — the cover print object: layout variants, ornaments, seal.
  - `motion.css` — the motion vocabulary: marquee, entrance (`pop-anim-*`),
    typing dots, and the loading constellation. All reduced-motion-gated.
  - `print.css` — "THE PRESS EDITION": collapse stocks to ink-on-white,
    preserve tomato, strip chrome — Cmd/Ctrl+P on any surface.
- `guidelines/` — foundation specimen cards (Design System tab).

### Components (`window.KernelChatDesignSystem_52d084.<Name>`)
- **Editorial primitives** (`components/editorial/`): `Kicker`, `Banner`,
  `Monument`, `CatalogRow`, `Terminal`.
- **Feature spreads** (`components/spreads/`) — the editorial "tools", one
  layout per feature type: `EssaySpread` (drop-cap prose + pull-quote),
  `InterviewSpread` (dossier + Q&A), `ForecastSpread` (numbered rings, ink),
  `DispatchSpread` (wire slug + checkboxes), `ReviewSpread` (verdict + graded
  grid).
- **Ornaments** (`components/ornaments/`): `PopShape` (geometric badges/marks),
  `PopIcon` (12 editorial pictograms; `asterisk` = the system glyph),
  `PopPathText` (text-on-a-curve).
- **Structure** (`components/structure/`): `IssueCover` (the print object —
  4 layouts + ornaments + seal), `MagazineFrame` (inner-page wrapper),
  `Colophon` (shared footer).
- **Motion** (`components/motion/`): `KernelLoading` — the ink-drop loading
  constellation.
- Each has `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md`; one card HTML per
  directory.

### UI Kits (`ui_kits/`)
- `magazine/` — **The Magazine**: a faithful issue surface (cover → contents →
  feature spread → colophon) with a cream/ink issue toggle, a floating
  spread-type picker (all five tools), gated cover entrance + scroll-reveal.
- `archive/` — **The Issue Archive**: the back-catalog grid (issues 360–378),
  click any spine to open its identity sheet.
- `inner-page/` — **Inner Page (Legal)**: a Privacy spread in `MagazineFrame`
  with a `KernelLoading` splash — the inner-page system end to end.

### Templates (`templates/`)
- `editorial-deck/` — **Editorial Deck**: a magazine-style slide deck
  (cover / section / contents / big-quote / comparison / colophon) as a Design
  Component on `deck-stage`. Copy the folder to start a deck.

### Assets (`assets/`)
Logos, marks, PWA icons, and warm retro-terminal illustrations
(`portfolio_*.png`, `og-image.png`).

### Skill
- `SKILL.md` — makes this folder usable as a downloadable Agent Skill.

---

## RULES FOR CONTRIBUTORS
1. **Never name the inspiration** on any user-visible surface.
2. **Never hardcode colour or font.** Go through `--pop-*` / `--rubin-*`,
   `--font-serif` / `--font-mono`.
3. **Tomato is the only spot colour.**
4. **Two Latin faces + one Japanese companion.** EB Garamond, Courier Prime,
   and Noto Serif JP. No generic UI sans-serif.
5. **Bilingual everywhere it fits** (`.pop-bilingual`, `Kicker jp=…`).
6. **One system glyph** (★). No emoji.
7. **Every release is an issue.** Bump the issue number like a real magazine.
