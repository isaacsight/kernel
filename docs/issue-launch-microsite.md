# Issue launch microsite — spec

> **Decision in one line:** A per-issue launch microsite is a single
> promotional surface for *one* issue. Build it **native** (a
> kernel.chat route, CSS-only, ships on the same domain) by default;
> reach for a **detached Framer-builder** microsite only when the
> launch genuinely needs to live off the magazine — a separate URL,
> a separate audience, a separate lifecycle.

Filed 2026-06-25. Companion to [`figma-motion.md`](./figma-motion.md)
and [`figma-tokens-to-variables.md`](./figma-tokens-to-variables.md).
Anchored to **ISSUE 391 — ON THE HOUSE STYLE** as the worked example.

## What it is

When an issue ships, the magazine itself is the artifact. A *launch
microsite* is the thing you point a link at — from a post, an email,
a press note — that sells the single issue: its feature, its stakes,
one pull quote, a cover, a call to read. It is a poster, not a
publication. One issue, one scroll, one action.

## Two build paths

| | A — Native route (recommended) | B — Detached Framer build |
|---|---|---|
| Lives at | `kernel.chat/#/launch/391` | e.g. `391.kernel.chat` (Framer hosting) |
| Surface | **Editorial** → CSS-only contract | Off the main app entirely |
| Tokens | Real `pop-*` / Rubin tokens from `src/index.css` | Mirrored Figma variables, re-entered in Framer |
| Motion | CSS ambient accents (tomato breath, dateline drift) | Framer Motion (the runtime) — allowed *here*, because it's not the magazine |
| Cost | Reuses `IssueRecord` data + existing primitives | Hand-built in Framer, kept in sync by hand |
| Drift risk | None — one source of truth | High — a second copy of the grammar |
| When | Default for every issue launch | A standalone campaign with its own life |

**Recommendation: Path A.** The hash router (`createHashRouter`)
already supports a new route with zero server config, the editorial
primitives already exist, and the issue's content is already typed in
`src/content/issues/391.ts`. Path B duplicates the grammar in a tool
that can't read `IssueRecord` and re-introduces exactly the drift the
design system was built to kill. Keep Path B in the toolbox for a
launch that is deliberately *not* the magazine — a recruiting page, a
sponsor splash, a one-off event — where a detached URL is the point.

---

## Path A — native route spec

### Route

`/#/launch/:number` → `LaunchPage`, lazy-loaded, wrapped in the same
`ErrorBoundary` as every route in `src/router.tsx`. Reads its issue
from `getIssue(number)` (the `IssueRecord` already in
`src/content/issues/`). No new data model.

### Surface & contract

This is the **editorial surface**. CSS-only motion, `opacity` /
`transform` only, `prefers-reduced-motion` honored — per
`.claude/rules/components.md` § "Motion — two surfaces." No
`motion/react` on this page.

### Tokens (from `figma-tokens-to-variables.md`)

Drive everything off the issue's declared identity, no hand-mixed
values:

- **Ground:** the issue's `coverStock` → `--pop-{stock}`. 391 is
  `ivory` → `--pop-ivory` (`#FAF9F6`). Never `#fff`.
- **Ink:** `--pop-ink` / `--rubin-slate`.
- **Spot:** `--pop-tomato` (`#E24E1B`) — the one spot, used for the
  rule breath and the single CTA underline. No second spot colour.
- **Accent:** the issue's `accent` seed → the adaptive 5-tone OKLCH
  system (`IssueAccent.css`). 391 is `amethyst`. The microsite tints
  hairlines/kicker with `--issue-accent-*`, never a raw hex.
- **Type:** EB Garamond (`--font-serif`) for the feature + deck;
  Courier Prime (`--font-mono`, `tracking/caps`, uppercase) for the
  kicker, folio, dateline, and CTA label.

### Sections (one scroll, top → bottom)

1. **Postmark bar** — mono kicker: `ISSUE 391 · JUN 2026 · ¥0 · BYOK`.
   Folio glyph (the asterisk) at the right. Hairline under.
2. **Feature lockup** — `feature` ("ON THE HOUSE STYLE") in EB
   Garamond display, `featureJp` beneath in mono caps. The `tagline`
   as a quiet line below. Tomato rule with the ambient breath accent.
3. **Cover plate** — the issue cover (`coverStock` ground,
   `coverLayout`, `coverOrnament`, `coverSeal`). Reuse the existing
   cover component; do not redraw it.
4. **Stakes strip** — the issue's `contents[]` rendered as a numbered
   mono list (`001 The drawer and the press` …). This is the table of
   contents doing promo duty for free.
5. **One pull quote** — the `spread.pullQuote`. Exactly one. The
   poster's single loud line.
6. **CTA** — "Read the issue →" linking to `/#/issues/391` (the real
   reading route). Tomato underline, the only spot on the page.
7. **Colophon footer** — `credits` block, mono, small. KERNEL PRESS
   seal where the issue carries one.

### Motion

Only the two sanctioned editorial accents: the tomato-rule breath
(§2) and, if a dateline is present, the marquee drift. Nothing else.
A launch poster that respects stillness reads as *the magazine's*
poster, not an ad.

### Build order

1. `LaunchPage.tsx` + `LaunchPage.css` (CSS-only), route in
   `src/router.tsx`.
2. Compose from existing primitives (`pop-rule`, kicker, cover,
   contents list) — new CSS only for the poster layout.
3. Verify the cover renders pixel-identical to `/#/issues/391`
   (shared component, not a copy).
4. Check bundle: the page is lazy-loaded; it must not pull
   `motion/react` into the editorial chunk.

---

## Path B — detached Framer build (when it's genuinely off-magazine)

Use only when the launch is *not* the magazine. Then:

1. **Mirror the tokens into Figma variables** per
   `figma-tokens-to-variables.md` (names 1:1) so the Framer comp
   stays on-grammar.
2. Build in Framer; **Framer Motion is fine here** — this surface is
   outside the editorial contract by definition (it's not on
   kernel.chat). The two-surface rule only governs the codebase.
3. Keep the spot discipline by hand: one tomato, two faces, one
   glyph, ivory ground, no pure white.
4. **Accept the drift cost knowingly.** A Framer microsite is a hand
   copy of the grammar; when tokens change, it does not. Log it as a
   detached artifact, not part of the system.

The honest caveat: every Framer microsite is a fork of the house
style that can't read `IssueRecord`. That's acceptable for a campaign
with its own lifecycle; it's waste for a routine issue launch. Default
to Path A; spend Path B deliberately.

## See also

- [`figma-tokens-to-variables.md`](./figma-tokens-to-variables.md) — the token mirror both paths lean on
- [`figma-motion.md`](./figma-motion.md) — why only Figma's CSS export reaches the editorial surface
- `.claude/rules/components.md` § "Motion — two surfaces, two instruments"
