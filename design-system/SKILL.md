---
name: kernel-chat-design
description: Use this skill to generate well-branded editorial interfaces and assets for kernel.chat ("Magazine for City Coders" — an independent magazine that is an unnamed homage to POPEYE), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and editorial UI components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy
assets out and create static HTML files for the user to view. If working on
production code, you can copy assets and read the rules here to become an expert
in designing with this brand.

## Quick start
- **Entry point**: `styles.css` — link it (or its `@import`ed `tokens/` +
  `primitives/editorial.css`) to get every token, the two webfonts, and the
  `pop-*` editorial utility classes.
- **The register** — warm paper stocks, **tomato** (`#E24E1B`) as the only spot
  colour, EB Garamond display + Courier Prime meta, bilingual JP/EN, bracketed
  kickers, numbered catalogs, issue monuments. Type-first, square, hairline
  rules. The terminal "quiet utility core" carries a hard tomato block shadow.
- **Components** (React): `components/editorial/` — `Kicker`, `Banner`,
  `Monument`, `CatalogRow`, `Terminal`. Each has a `.prompt.md` with usage; mount
  from the compiled bundle namespace.
- **Whole surface**: copy `ui_kits/magazine/` (cover → contents → essay spread →
  colophon) and adapt.
- **Icons**: the one system glyph is the **asterisk ★** (inline 3-line SVG);
  `<PopIcon>` editorial pictograms (1.75px stroke) for sparing accents. No emoji.

## Hard rules
1. Never name the design inspiration on any user-visible surface.
2. Tomato is the only spot colour. (Purple `#6B5B95` is the logo mark only.)
3. EB Garamond + Courier Prime for Latin; Noto Serif JP for Japanese.
4. Never pure `#ffffff` — use warm ivory/cream/butter/kraft/ledger stocks.
5. Bilingual everywhere it fits. One system glyph (★). No emoji.
6. Every release is an "ISSUE N · MONTH YEAR".

If the user invokes this skill without any other guidance, ask them what they
want to build or design, ask some questions, and act as an expert designer who
outputs HTML artifacts _or_ production code, depending on the need.
