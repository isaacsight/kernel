# THE STACKS — the back catalog as a walkable room

**Date:** 2026-07-20
**Status:** Approved (design review with Isaac, this session)
**Reference:** claygarden.jp/series (The SUKIMA project) — floating
scanned clay objects in a dark void, scroll-descent into bilingual
editorial spreads. Maker's walkthrough: "We Built a Journal You Can
Walk Through (CLAY → 3D → WEB)", Designer In Japan, YouTube oWT7il2EKAo.

## Why

The magazine's grammar (bilingual lockups, dossiers, plates,
series-as-issues) already matches SUKIMA's editorial layer. The delta
is one thing: a spatial, inhabitable layer over the archive. SUKIMA's
power is that its objects are real scanned clay; kernel.chat's issues
need equivalent bodies that are honest to what the magazine is.

## Concept

A new room at **`/archive`** — THE STACKS. Ink-stock dark. Organized
as **volumes by cover month** (the grouping the back catalog already
uses). Entering a volume: the bilingual volume lockup ("FEB 2027 ·
二〇二七年二月") floats center while that month's issues drift around
it. Scrolling descends through the field to a colophon strip and a
**NEXT VOLUME gate** that walks into the previous month. Activating an
issue pushes the camera toward it and lands on the real `/issues/N`
route — the existing spread IS the descent's destination. The room is
a way in, not a duplicate archive.

## The objects — four body kinds, one system

Resolved by `bodyFor(issue)` (pure function over the issue record):

| Kind | Milestone | Which issues | Body |
|---|---|---|---|
| **Sheet** | M1 (default) | all | Cover art as a printed signature: gently curved plane, paper thickness, ink sheen; back face uses back-cover art where it exists. Zero new assets. |
| **Instrument** | M2 | 419+ (artifact era) | Small glowing framed capture of the issue's artifact edition, emissive against the dark. Static capture textures, not live iframes. |
| **Monument** | M3 | milestones (360, 390, 400, 419…) | Procedural sculptural form seeded deterministically from accent + stock + layout. No hand-modeling. |
| **Scan** | M4 | when real objects exist | Photogrammetry. First clay: KERNEL PRESS Edition №001 (the physical A5 booklet). |

## Technical approach (decided)

**react-three-fiber + drei, entirely inside the lazy `/archive` route
chunk.** three.js (~160KB gzip) never enters the main bundle, so the
300KB main-bundle budget is untouched. Fits the existing React + Vite
+ `lazyRetry` architecture; Suspense integrates with existing loading
states.

Rejected: vanilla three.js (manual lifecycle grows poorly with body
kinds); standalone artifact-style static page (duplicates the issue
registry outside the app, loses SPA navigation into spreads).

## The laws, kept

- **Motion:** reduced-motion renders the room composed and at rest —
  no drift, no scroll-jacking; the resting page is complete and fully
  navigable.
- **Keyboard:** every body focusable in catalog order; Enter opens the
  issue; the folio always carries a plain link to `/issues` (the fast
  catalog stays first-class).
- **Degradation:** no WebGL2 → graceful redirect to `/issues`.
- **Vocabulary:** stacks / volume / gate / body — never scene, canvas,
  3D viewer in user-visible copy. No emojis. Bilingual lockups.
- **Performance:** DPR capped at 2; rendering paused when the tab is
  hidden; cover textures downscaled from existing art; max ~12 bodies
  resident per volume room.

## Data

Everything derives from the existing `ALL_ISSUES` registry
(`src/content/issues`) — number, feature, featureJp, cover month,
accent, stock, cover art paths. No new content files. New pure
modules: volume grouping (month → issues, newest first) and
`bodyFor`.

## Testing

- Unit: volume grouping, `bodyFor` resolution, deterministic monument
  seeding (M3).
- e2e: keyboard path through a volume; `/issues` fallback link; no-
  WebGL redirect.
- Design QA: `audit-page.mjs` against `/archive` (desktop + mobile +
  reduced motion) before ship.
- Gates: lint:adherence, lint:editorial, tsc, vitest, main bundle
  ≤300KB gzip (three confined to route chunk — assert via build
  output).

## Sequence

- **M1 — the room:** sheets + volumes + descent + gates + issue
  navigation. Complete, shippable experience with one body kind.
- **M2 — instruments:** artifact-era captures.
- **M3 — monuments:** procedural milestone bodies.
- **M4 — the first scan:** Edition №001 photogrammetry.

Each milestone independently shippable behind the same gates.

## Dependencies

Builds on PR #62 (`feat/real-urls-cloudflare`) — real paths are
assumed for `/archive` and camera-push navigation into `/issues/N`.
