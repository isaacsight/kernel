# The Artifact Language

> The rules for the magazine's second rendering: the **artifact
> edition** — a single self-contained, full-bleed, animated,
> operable HTML object published per issue. Ratified after
> ISSUE 419 (THE INTELLIGENT CANVAS), whose galley proof was
> drafted as an artifact *first* and reduced to a site spread
> *second* — and read better in its original register. The
> editor's direction, filed 2026-07-15: the editorial's language
> and expression shift toward the interactive animated artifact;
> the artifact is no longer a by-product of the issue, it is a
> co-equal rendering of it.
>
> Three documents now govern the publication:
> `docs/design-language.md` (color, type, stock — both surfaces),
> `docs/interaction-language.md` (the hand on the SITE spread),
> and this file (the ARTIFACT edition). When they disagree about
> an artifact, this file wins; when they disagree about a spread,
> interaction-language.md wins.

Status: **LAW** — reviewed each time an issue ships.

---

## I. The two renderings

Every issue from 419 onward ships twice:

1. **The spread** — the issue's page on kernel.chat. Calm by
   default, archival, bound by the seven rules (as amended). The
   spread is the issue of record.
2. **The artifact edition** — the same argument staged as a
   standalone interactive animated object: the pressroom's own
   galley proof, full-bleed, self-contained, operable. The
   artifact is the issue at full expressive amplitude.

**Draft artifact-first.** The artifact edition is not the spread
inflated — the spread is the artifact reduced to the site's law.
Working in this order keeps the expressive register primary (the
419 lesson: the galley invented the shape; the spread inherited
it) and makes the reduction a deliberate editorial act: what the
spread gives up relative to its artifact is a decision, filed in
the issue's header comment.

---

## II. The animation vocabulary

Three species of motion, in descending order of entitlement:

1. **Operational motion** — the subject's own mechanics: a pulse
   walking a wire, a frame drawing its proof, a ledger ticking.
   In an artifact this is the argument itself and runs at full
   amplitude. (On a spread it exists only inside a working
   model's frame, per the 419 amendment.)
2. **Choreographed moments** — a page-load sequence, a pull, an
   orchestrated reveal. Artifacts may stage them; one orchestrated
   moment lands harder than scattered effects, so spend the
   choreography budget in one place and keep the rest of the page
   quiet.
3. **Weather** — ambient paper-room motion: sway, glow, drift, a
   ticker. Permitted on both surfaces; amplitude stays ambient
   even in artifacts.

**The honesty core never relaxes** — these travel into every
artifact exactly as they bind the site:

- **Timer-robust**: no animation step may depend on
  `requestAnimationFrame` alone — race it against a timer. rAF
  provably never fires in embedded panes and throttled tabs; an
  animation that can stall is a broken instrument (419, found in
  this magazine's own galley).
- **Reduced-motion collapses everything**: under
  `prefers-reduced-motion`, pulses skip, sway stops, states
  change instantly. The artifact still works; it just doesn't
  move.
- **Meters tell the truth**: every displayed number is measured
  (the reader's own actions, counted client-side) or labelled
  representative, on-surface. Ledgers are session-only,
  unrecorded, and say so.
- **Simulations are disclosed**: when the artifact models an
  external product, it says so on its own face — drawn in-house,
  nothing generated — in the colophon at minimum.
- **Seeds print**: generative frames are deterministic from a
  seed printed on the artwork. A printed seed is a state the
  archive can re-draw. Fixed resting seeds when the artifact must
  read identically for every reader at rest.

---

## III. The artifact grammar

What makes an object an artifact *edition* rather than a demo:

1. **One self-contained file.** A single HTML file; strict-CSP
   safe: no external fonts, scripts, images, or fetches — inline
   everything. `<meta charset="utf-8">` first (unset charset
   mojibakes the bilingual lockups). Fonts are declared as stacks
   with graceful fallbacks (EB Garamond → Iowan Old Style /
   Palatino / Georgia; Courier Prime → Courier New) — never a
   CDN link that can silently fail.
2. **House grammar carried whole.** Warm stocks (never pure
   white), ink hairlines, ONE spot accent (the issue's accent),
   Garamond display + Courier meta, bilingual JP/EN lockups,
   bracketed kickers, plates with registration ticks, numbered
   catalogs, a running head, a colophon. Magazine vocabulary
   only. No emojis; the ★ glyph travels. Never name the
   inspiration.
3. **Both themes.** Token-level light/dark:
   `prefers-color-scheme` plus `data-theme` overrides in both
   directions; canvas-drawn art re-inks on theme change.
4. **Operable, by every door.** Controls are established
   patterns (buttons first); keyboard reaches everything pointer
   does; focus is visible on every stock.
5. **The colophon discloses.** Set in what, simulated or
   measured, source and read-date, the session-only promise.
   An artifact that models something ends with the seam shown.
6. **Wide things scroll in their own frame.** The page body
   never scrolls sideways; plates get their own overflow.

---

## IV. Filing and publishing

- **File it in the repo**: `artifacts/<N>-<slug>.html`, committed
  in (or alongside) the issue's ship commit. The artifact is part
  of the issue's audit trail — versioned, reproducible, durable.
- **Publish via the Artifact surface** (claude.ai) — private by
  default; the editor decides what gets shared. The published URL
  is pressroom material, not site content: claude.ai artifacts
  are the editor's proofs, so the public site never links them.
- **The issue's `audit` block cites the artifact edition** (that
  it exists, where it is filed).
- **Stable identity per artifact**: keep `<title>` and favicon
  constant across redeploys; a changed favicon reads as a
  different object.

---

## V. Amendment

Like interaction-language.md: amend by shipping an issue whose
artifact argues the amendment, then editing this file in the same
commit.

---

*Ratified VII·26 — ISSUE 419's galley proof was the first artifact
edition (filed at `artifacts/419-the-intelligent-canvas.html`);
the editor's direction of 2026-07-15 made the register standing
law: every issue ships as an artifact, and the artifact leads.*
