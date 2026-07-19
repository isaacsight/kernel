# kernel.chat Agent Rules

These rules apply to all coding, layout design, and editing tasks in this repository. Follow them strictly to maintain the publication's craft standards and technical integrity.

---

## 1. Design & Homage Discipline

- **Homage Silence**: Never name the visual inspiration ("POPEYE Magazine" or "Magazine House") in user-visible copy. The visual grammar alone carries the homage.
- **Magazine Vocabulary**: Use magazine terminology (*issue*, *feature*, *spread*, *folio*, *kicker*, *monument*, *colophon*, *dateline*) instead of application terms (*dashboard*, *panel*, *card*, *widget*, *modal*).
- **Typography Stack**:
  - Display and prose: `var(--font-serif)` (EB Garamond).
  - Metadata and code: `var(--font-mono)` (Courier Prime).
  - Parallel text / JP Subtitles: `var(--font-jp)` (Noto Serif JP).
  - No generic UI sans-serif faces.
- **Bilingual Structure**: Use bilingual lockups for catalog items and headers: `.pop-bilingual > .pop-latin + .pop-jp`.

---

## 2. Interaction & Calmness (LAW)

All interactive features must strictly comply with `docs/interaction-language.md`.

- **Calm Default**: Touch deepens the page; it never gates. The page at rest is complete and makes its argument.
- **Calibrated Instruments**: Avoid hover garnish, cursor effects, scroll reveals, or parallax. The hand adjusts a variable the story is about, and the page returns an honest reading.
- **Motion Budget**:
  - Page/editorial motion is **CSS-only** transitions and keyframes at weather amplitude (e.g. Tomato rule breath).
  - **No JS animation runtimes** (Framer Motion / `motion.dev`, Lottie, etc.) on editorial surfaces.
  - *Exception*: Script-driven motion is allowed only inside a framed mechanism (`plate`/`bore` components). It must be **timer-robust** (race `requestAnimationFrame` with `setTimeout`) and collapse instantly to resting state under `prefers-reduced-motion`.
- **DOM Stability & Print**: Every reachable state must exist in the DOM at all times. `@media print` must render all states stacked.
- **ARIA & Input**: Use standard patterns (roving-tabindex `radiogroup`, `switch`, `tablist` with native keyboard controls). Targets must be $\ge$ 44px. Focus indicators must use the issue accent.
- **Honest Meters**: Displayed readings must be measured or explicitly labelled representative (`meterNote`). Keep input data strictly session-only (no storage or networking) and disclose this in print.

---

## 3. Standalone Artifact Editions

Every issue ships both as a site spread and as a standalone HTML file in `artifacts/<N>-<slug>.html`.
- **Draft Artifact-First**: Design the standalone artifact first, then reduce it to the site's layout constraints.
- **Self-Contained**: The artifact must be a single file containing all CSS and JS inline. Strict CSP must pass. Font stacks must fall back to system defaults gracefully without CDNs.
- **Depth Doctrine**: Bores must include a named axis + gauge, carried context from upper layers, a floor that pays, and emphasis-never-existence.

---

## 4. Verification & Deployment

Never push changes to `main` without running visual and command-line verification:

```bash
npx tsc --noEmit   # Must be clean
npm run build      # Must be clean
```

- **Visual Checklist**:
  - Accent matches the issue's visual register (verified safe via `isPopeyeSafe` checks).
  - Star/asterisk glyph (★) is applied properly.
  - Breakpoints tested at 390px and 393px with zero horizontal scroll on the viewport.
  - Print preview (`Cmd+P`) has no overlapping states and no interactive chrome.
- **Deploying**: `main` is the only publisher. Pushing to `main` deploys to GitHub Pages via CI. Do not run local deploy scripts.
