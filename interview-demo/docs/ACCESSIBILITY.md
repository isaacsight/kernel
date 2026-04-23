# Accessibility

Not a compliance checkbox. A design-engineering commitment that every
user can use the product.

---

## Standards

- **Baseline**: WCAG 2.2 **AA** on all P0 flows.
- **Aspiration**: AAA where it doesn't fight the product.
- **Platform-specific**: iOS VoiceOver, macOS VoiceOver, Windows
  NVDA, Android TalkBack — tested, not just "standards compliant."

---

## The accessibility contract (per feature)

Every feature ships only when:

1. Keyboard-only usable (no mouse required).
2. Screen reader surfaces the right information in the right order.
3. Color contrast ≥ 4.5:1 for text, ≥ 3:1 for large text + UI
   components.
4. Focus is visible always and never trapped.
5. `prefers-reduced-motion` respected (essential motion preserved,
   decorative motion removed).
6. Works at 200% zoom without horizontal scroll.
7. Works in the system's dark mode.
8. Works with Windows High Contrast / macOS Increase Contrast.

Checklist in `.github/PULL_REQUEST_TEMPLATE.md`.

---

## Keyboard

Every interactive element is keyboard-reachable.

### Navigation

- `Tab` / `Shift-Tab`: forward / back through focusable elements.
- Focus order matches visual order.
- Skip links: "Skip to main content" visible on Tab from URL bar.
- `Escape` closes any overlay (dialog, drawer, popover).

### Shortcuts (studio)

| Keys | Action |
|---|---|
| `Cmd/Ctrl + K` | Command palette |
| `Space` | Play/pause |
| `← →` | Seek 5s |
| `Shift ← →` | Seek 30s |
| `J / K` | Prev/next in list |
| `G` | New generation |
| `E` | Edit selected track title |
| `S` | Share selected |
| `P` | Add to playlist |
| `?` | Show all shortcuts |

Shortcuts:
- Visible in tooltips (on hover).
- Listed in command palette entries.
- Listed on `?` help modal.

### Custom keyboard affordances

- **Playlist drag**: `Space` picks up a row, `↑↓` moves, `Space`
  drops. Live region announces "moved to position N."
- **Waveform scrub**: `Space` play/pause, `← →` seek. Live region
  announces current time when paused.
- **Canvas drawing** (Procreate angle): arrow keys draw in
  direction, `Enter` ends stroke. Accessibility mode for users
  without pointer input.

---

## Screen reader

### Semantic HTML first

Use the right element. `<button>` not `<div onclick>`. `<nav>`,
`<main>`, `<article>` where they fit. Headings in order.

### ARIA only when semantic HTML is insufficient

- Complex widgets (command palette, waveform): `role="combobox"`,
  `role="slider"`, etc.
- Live regions for dynamic updates: generation progress, playback
  state, toast messages use `aria-live="polite"` or `"assertive"`.
- Labels: every interactive element has a name from text,
  `aria-label`, or `aria-labelledby`.

### Live regions (used)

```html
<!-- Generation progress -->
<div role="status" aria-live="polite">
  Generating — 45% complete
</div>

<!-- Play state -->
<div role="status" aria-live="polite" aria-atomic="true">
  Playing "Rainy afternoon" — 1:23 of 2:00
</div>

<!-- Errors -->
<div role="alert">
  That didn't land. Retry?
</div>
```

### Announcements schedule

Throttle so we don't flood:
- Generation progress: once per 10% (not every frame).
- Playback time: every 5 seconds while playing.
- Errors: immediate.

### Waveform — the hard one

A waveform is a slider. ARIA makes it work:

```html
<div
  role="slider"
  aria-label="Playback position"
  aria-valuemin="0"
  aria-valuemax="120"
  aria-valuenow="42"
  aria-valuetext="42 seconds of 2 minutes"
  tabindex="0"
  onkeydown={handleScrub}
>
  <canvas><!-- visual waveform --></canvas>
</div>
```

Keyboard: `← →` for 5s, `Home / End` for start/end, `PgUp / PgDn`
for 30s.

---

## Color & contrast

### Ratios

- Body text on background: 7:1 (AAA target, 4.5:1 required)
- Large text: 4.5:1 (AAA target, 3:1 required)
- UI components (borders, icons): 3:1 minimum
- Focus ring on any background: 3:1 vs adjacent color

### Never encode only in color

- Error states: color + icon + text ("Error: ..." not just red
  text).
- Status dots (connected/disconnected): color + label.
- Selected state: color + checkmark or indicator.

### Design tokens audit

CI check: every semantic color pair (e.g., `ink.primary` on
`surface.base`) runs through a contrast calculator. New tokens
must pass.

---

## Motion

- `@media (prefers-reduced-motion: reduce)` respected.
- Essential motion (generation progress, waveform playhead,
  loading indicators) preserved — simplified, not removed.
- Decorative motion (scale on entrance, ambient drift, pulse)
  fully disabled.

See [`MOTION.md`](./MOTION.md) "Reduced motion" section.

---

## Zoom + reflow

### 200% zoom

Test at Cmd/Ctrl + several `+` presses. Must:
- No horizontal scroll.
- No truncated text.
- Overlapping regions? Responsive breakpoints kick in.

### 400% zoom (text-only)

Browser's text zoom. Must not break layout — flex/grid absorbs.

---

## Forms

- Every input has a `<label>` (or `aria-label`).
- Required fields marked with `aria-required="true"` + text
  indicator (not just asterisk color).
- Validation errors appear in a live region tied via
  `aria-describedby`.
- Submit disabled only after user action, never on initial render
  (screen readers may miss the transition).
- Error messages say what to do: "Enter an email" not "Invalid".

---

## Media

### Audio

- Controls keyboard-accessible (see Shortcuts).
- No auto-play. Ever.
- Transcripts available for any narrated content (post-launch: voice
  instructions).

### Video (if we ship tutorials)

- Captions (SRT/VTT).
- Audio description track for anyone who can't see the screen.
- No auto-play.

---

## Touch

- Hit targets ≥ 44×44 pt (iOS guideline) / 48×48 dp (Android).
- Active spacing ≥ 8 pt between targets.
- Gesture alternatives: swipe actions always have a menu alternative.

---

## Platforms

### iOS Safari + VoiceOver

- Rotor gestures work for headings, links, form controls.
- Rotor reads our heading hierarchy correctly (no skipped levels).
- Swipe down from right for notification center doesn't break in-
  app gesture handlers.

### macOS Safari + VoiceOver

- `VO + Right` reads next element.
- Web rotor (`VO + U`) surfaces landmarks, headings, links, form
  controls.

### Windows NVDA + Firefox / Chrome

- Browse mode + focus mode both work.
- Form field labels read correctly.
- Table semantics where used (there aren't many tables, but
  playlist track lists use `<table>` when density mode is Compact).

### Android TalkBack + Chrome

- Explore by touch works.
- Double-tap activates.
- Two-finger swipe scrolls.

---

## Automated testing

### axe-core + axe-playwright

Runs on every E2E test, on the final state of each flow.

```ts
import AxeBuilder from '@axe-core/playwright';

test('studio is accessible', async ({ page }) => {
  await page.goto('/studio');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

### Lint

- `eslint-plugin-jsx-a11y` (or Biome's a11y rules) catches common
  issues pre-merge.
- Custom rule: disallow `<div onClick>` without `role` + `tabIndex`
  + `onKeyDown`.

### CI

A PR cannot merge with axe violations. A PR with new violations
fails CI hard.

---

## Manual testing

### Quarterly

One engineer + one designer spend a half-day:
- Complete CP1 + CP2 + F1.7 via VoiceOver + Safari iOS.
- Complete the same via NVDA + Firefox Windows.
- Test with Windows High Contrast mode.
- Test with macOS Increase Contrast.

Findings → tickets → fixes before next release.

### Pre-release

Every release candidate gets a keyboard-only pass. Any flow that
requires a mouse to complete fails the release.

---

## User research

Partner with users who rely on assistive tech. Small honorarium,
periodic sessions. Their feedback weighs more than any checklist.

---

## Common mistakes I avoid

- **Focus outline removed with `outline: none`** without replacement.
  If your design hates the default outline, style a custom one —
  never delete.
- **Click-only handlers**. `onClick` without `onKeyDown` makes
  keyboards second-class.
- **ARIA-only widgets where semantic HTML exists**. A `<button>` is
  always better than a `role="button"`.
- **Placeholder as label**. Placeholders disappear on input.
  Always use a real `<label>`.
- **Auto-focusing on page load**. Disorients screen reader users.
  Focus only in response to user action.
- **Trapping focus without an escape**. Modal must close on Escape.
- **Announcing every tiny change**. `aria-live="assertive"`
  everywhere is noise pollution — use `polite` and throttle.

---

## The philosophy

Designing for accessibility makes the product better for everyone.

- Keyboard-first design produces cleaner interaction models.
- High-contrast design reads better on bright sunlight.
- Captions help in loud environments.
- Large hit targets help on tired hands.
- Clear language helps everyone.

An accessible product is an honest product. A product that demands
everyone adapt to it is arrogant. We built this for anyone who'd
hear it.
