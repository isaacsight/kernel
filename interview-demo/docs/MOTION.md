# Motion

Motion is function. Every animation in this product *carries meaning*.
If it doesn't, it's deleted.

---

## Principles

### M1. Motion explains state change

When state changes, motion is the connective tissue that tells the
user *what went where*. A card that moves position **slides**. A card
that's replaced by different content **crossfades**. A card that's
deleted **collapses + fades**.

Without motion, state transitions are pop-cuts — the user has to
reconstruct the change cognitively. Motion makes the change felt, not
inferred.

### M2. Exit is faster than entry

Things come into existence gently (ease-out, 220ms). Things leave
decisively (ease-in, 120ms). This mirrors human perception: objects
*arrive* over time (you notice them appearing), but they *disappear*
instantly (by the time you perceive loss, it's already gone).

### M3. Motion is interruptible

Every motion must tolerate being interrupted mid-flight. A user who
clicks "close" then "open" quickly should not wait for the close
animation to finish. Use **spring physics** with current velocity
preserved, not duration-based keyframes.

### M4. Motion respects intent

If the user drags a card, don't animate the position — the user *is*
the animation. Only animate when the system is moving things on its
own.

### M5. Reduce if asked

`@media (prefers-reduced-motion: reduce)` disables:
- Decorative motion (ambient waveform drift on landing)
- Entrance scales (keep opacity, drop scale)
- Complex layout animations (replace with crossfade)

It does NOT disable:
- Essential feedback (progress fills, loading indicators)
- Hover / focus states (those are affordances, not animation)

---

## The vocabulary

A small, named set of motion primitives. Every motion in the product
maps to one of these; if it doesn't, either the primitive list grows
(rare) or the motion is wrong.

### `appear`

Element enters from nothing.

```
opacity: 0 → 1          (220ms, ease-out)
scale:   0.96 → 1        (220ms, ease-out)
y:       +6px → 0        (220ms, ease-out)
```

Used for: toasts, popovers, dialog content, first-paint of a newly
generated track.

### `disappear`

Element exits.

```
opacity: 1 → 0          (120ms, ease-in)
scale:   1 → 0.98       (120ms, ease-in)
```

Used for: dismissing toasts, closing dialogs, removing a track.

### `slide`

Element moves to a new position in layout.

```
x, y: current → new      (spring: stiffness 180, damping 22)
```

Used for: reordered playlist rows, navigation drawer open/close,
route transitions.

### `crossfade`

One element swaps for another in the same slot.

```
outgoing opacity: 1 → 0  (140ms, ease-in)
incoming opacity: 0 → 1  (220ms, ease-out, delayed 100ms)
```

Used for: avatar swap, cover art swap, regenerated segment swap.

### `expand` / `collapse`

Height (and children) grow/shrink.

```
height: 0 → auto         (280ms, ease-out)  ← expand
height: auto → 0         (200ms, ease-in)   ← collapse
opacity of children: 0 → 1 delayed 80ms on expand
```

Used for: accordion, expandable track detail, stream of log lines.

### `pulse`

Single attention-grab for a successful action.

```
scale:   1 → 1.03 → 1     (360ms, ease-out-in)
```

Used for: first successful generation, share copied, track saved.
Never on recurring events.

### `shake`

Rejection.

```
x: 0 → -6 → +6 → -3 → +3 → 0   (320ms, linear)
```

Used for: invalid input, auth failure. Paired with a subtle haptic if
supported.

### `fill`

Linear progressive reveal.

```
width: 0% → n% → (eventually 100%)
```

Used for: generation progress, upload progress, waveform streaming.
Interpolated smoothly between discrete updates to avoid jank.

### `breathing`

Ambient, slow.

```
opacity: 0.6 → 1 → 0.6   (1800ms, ease-in-out, infinite)
```

Used for: "connected" dot on WebSocket status, waiting-for-Suno
indicator. Disabled under reduced-motion.

---

## Choreography — multi-element flows

Motion gets interesting when multiple elements coordinate.

### C1 — "Generate" → "Streaming"

User hits Generate. The prompt input:
1. Drops focus (cursor leaves).
2. Slides up 8px.
3. Below it, the waveform canvas `appear`s.
4. Inside the waveform, `fill` begins.
5. Below the waveform, the transport `appear`s once the first segment
   is ready to play.

Sequencing (stagger 60ms between beats) makes it feel considered, not
abrupt.

### C2 — Playlist row drag

User grabs a row with pointer (or pencil, or keyboard space+↑/↓).
1. Row gets shadow (elevation 2, appears 80ms).
2. Row lifts (scale 1.02).
3. Other rows part via `slide` to make space at the drop target.
4. On drop: row drops back to flat, shadow fades.

Keyboard version: space picks up, arrows move, space drops. Same
visual beats, no pointer dependency.

### C3 — Generation fails at 60%

1. `fill` freezes at 60%.
2. Fill color transitions amber → muted gray (`crossfade` on the fill
   layer, 280ms).
3. Below, an error card `appear`s with retry button.
4. On retry: card `disappear`s, fill resumes from 60%.

Note: we don't reset to 0% on retry. Partial work is preserved.

### C4 — Route transitions

View Transitions API:
- From studio → track detail: waveform element has the same
  `view-transition-name`, so it *morphs* from list thumbnail to
  hero.
- From track detail → playlist: crossfade.

This is one of the most powerful UX wins in the browser as of 2026.
Use it.

### C5 — First successful generation (the moment)

Once per user, the first time a generation completes:
1. Waveform fills as normal.
2. On completion, cover gradient `pulse`s (scale 1.02, amber flashes
   brighter for 400ms).
3. A subtle line of text drifts up from the bottom: "Made your first
   one." `appear`s, holds 2.5s, `disappear`s.
4. Haptic "success" on supported devices.
5. This never fires again.

This is the "system sings" moment from [`DESIGN_ENGINEERING.md`](./DESIGN_ENGINEERING.md)
P10 — breaking the rule deliberately for an emotional beat.

---

## Physics values (tuned)

Tuned by feel, but these are the opinionated defaults:

```ts
// packages/ui/src/motion/physics.ts
export const springs = {
  snappy:  { stiffness: 300, damping: 28, mass: 1 },   // micro-interactions
  default: { stiffness: 180, damping: 22, mass: 1 },   // layout
  soft:    { stiffness: 120, damping: 20, mass: 1 },   // drawers
  floaty:  { stiffness: 80,  damping: 14, mass: 1 },   // reserved, rarely used
} as const;

export const durations = {
  fast: 120,   // exits, pickups
  med:  220,   // entrances, transitions
  slow: 360,   // pulses, multi-element stagger
  epic: 1200,  // hero moments only
} as const;

export const easing = {
  out:   'cubic-bezier(0.22, 1, 0.36, 1)',
  in:    'cubic-bezier(0.7, 0, 0.84, 0)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
} as const;
```

---

## Implementation — Motion (ex Framer)

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { springs, durations, easing } from '@/motion/physics';

// Appear
<AnimatePresence>
  {open && (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{
        duration: durations.med / 1000,
        ease: easing.out,
      }}
    />
  )}
</AnimatePresence>

// Slide (layout animation)
<motion.div layout transition={{ type: 'spring', ...springs.default }}>
  {/* content */}
</motion.div>

// Fill
<motion.div
  animate={{ width: `${progress}%` }}
  transition={{ duration: 0.08, ease: 'linear' }}
/>
```

### View Transitions API (for route changes)

```ts
// router.tsx
async function navigate(to: string) {
  if (!document.startViewTransition) {
    router.push(to);
    return;
  }
  document.startViewTransition(() => {
    router.push(to);
  });
}
```

Shared elements get `view-transition-name: <unique>` in CSS.

---

## Performance budget

Motion must NOT break perf.

- All animations run on `transform` and `opacity` only (GPU compositor).
- No layout animations above 60fps-guarantee threshold (for big lists,
  use FLIP + compositor hints).
- Reduce motion complexity on low-end devices — detect via
  `navigator.deviceMemory < 4` and degrade to opacity-only.
- Never animate `width`/`height`/`top`/`left` on continuously-moving
  elements; use `transform: scale`/`translate`.

Playwright E2E checks FPS over each animation; fails CI if any
animation drops below 55fps average on a mid-tier device profile.

---

## Reduced motion — what stays, what goes

| Animation | Default | Reduced |
|---|---|---|
| Appear (opacity + scale) | full | opacity only |
| Disappear | full | opacity only |
| Slide (layout) | spring | no motion (snap) |
| Crossfade | full | full (already minimal) |
| Expand/collapse | full | no motion (snap) |
| Pulse | full | removed |
| Shake | full | removed |
| Fill (progress) | full | full (essential feedback) |
| Breathing (ambient) | full | removed |
| View Transitions | full | removed |

Rule of thumb: essential feedback stays, decorative motion goes.

---

## Sound (optional, future)

If we add sound:
- One soft click on generate.
- One soft chime on first-sound (per session, not per generation).
- Sub-audible kick (haptic) on successful action.

Default off. User-toggleable in settings. Muted during playback.

---

## What breaks motion (common mistakes)

- **Animating layout properties** (width, height, padding). Move to
  transforms.
- **Forgetting `exit` on AnimatePresence children**. No exit = pop-cut.
- **Stacking animations on the same element**. Pick one.
- **Using duration when physics is right**. Spring for layout, duration
  for opacity.
- **Not preserving velocity on interruption**. Re-starting from zero
  feels broken.
- **Over-animating**. If every button pulses, nothing is special.
  The [`DESIGN_ENGINEERING.md`](./DESIGN_ENGINEERING.md) P10 rule applies
  to motion too — consistency until it isn't, break the system only for
  rare moments that deserve it.
