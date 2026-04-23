# UI / UX

Screens, flows, components. Aesthetic and function specified together
per the [`DESIGN_ENGINEERING.md`](./DESIGN_ENGINEERING.md) doctrine.

---

## Screens (Setlist, the Suno angle)

### S1 — Landing / Auth

- **Function**: Sign-in (passkey primary, magic link fallback, Google
  OAuth secondary). No marketing page — this is a logged-in app.
- **Aesthetic**: Monolithic. One centered card on warm base. Display
  face serif ("Setlist") in semi-bold, 72px. Beneath: "Make a track."
  One input (email or passkey prompt). Amber accent on the CTA.
- **Motion**: Background: slow, low-contrast waveform drifting L→R,
  never calling attention. Reduced-motion: static.
- **Empty state**: N/A (it's the entry point).
- **Error**: "We didn't recognize that." Inline, tone warm, no red.
- **Keyboard**: Tab → input, Enter → submit, Cmd-K not yet (unauthed).

### S2 — Studio (home, authed)

The main screen. Three zones.

```
┌───────────────────────────────────────────────────────────────┐
│  LEFT RAIL              │  CANVAS              │  RIGHT RAIL   │
│  - Library              │                      │  - Now Playing│
│  - Playlists            │  Prompt input        │  - Controls   │
│  - Recent               │    ───────────       │  - Share      │
│  - New prompt           │  Waveform            │               │
│                         │    ~~~~~~~~~~        │               │
│                         │  Play controls       │               │
└───────────────────────────────────────────────────────────────┘
```

- **Function**: Prompt → generation → playback → save or share. Left
  rail = navigation, right rail = playback + metadata.
- **Aesthetic**: Canvas is the hero. Rails collapse to icons on <1024px
  width. Canvas background: paper-warm, subtle grain (1% noise).
  Waveform in amber. Prompt input borrowed from the old Rhodes stage
  piano — rounded rectangle, slight top-light gradient.
- **Density modes**: Comfortable (default), Compact (rails wider,
  more density), Spacious (mobile default).
- **Keyboard**: Cmd-K command palette. Space = play/pause. G = new
  generation. J/K = prev/next in recent list.
- **Empty**: No tracks yet → canvas shows a single prompt suggestion
  ("try: lo-fi piano, 72 BPM, after the rain"). One-tap generate.

### S3 — Generation progress (inline in Canvas)

When a generation kicks off, the canvas transforms:

```
  ┌─────────────────────────────────────┐
  │  "Lo-fi piano, 72 BPM, after rain"  │
  │  ─────────────────                   │
  │                                      │
  │  ░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒           │  ← progressive waveform fill
  │                                      │
  │  [ ■ cancel ]      0:14 / 2:00       │
  └─────────────────────────────────────┘
```

- **Function**: Shows live progress as segments decode. User can
  cancel. Each completed segment becomes playable immediately (user
  can hear what's done while the rest finishes).
- **Aesthetic**: Waveform fills left-to-right in amber, trailing into
  a soft gradient toward not-yet-generated. Token ticker (faint,
  monospaced, below waveform) shows generation speed ("243 t/s").
- **Motion**: Fill is smooth, interpolated between segment arrivals.
  Never hangs — if a segment is slow, the fill slows but doesn't
  stop.
- **Failure**: If generation fails at 45%, show the partial waveform
  in muted gray, with a "retry" CTA. Don't delete the progress — it's
  the user's receipt.

### S4 — Track detail

```
  ┌──────────────────────────────────────┐
  │  Title (editable inline)             │
  │  ────────────────                    │
  │  Prompt                              │
  │  Style tags · BPM · Key · Duration   │
  │                                      │
  │  ═══════════════════════════════════ │  ← waveform, full width
  │                                      │
  │  ► ⊙ ⊙ ⊙     0:42 / 2:14             │  ← transport
  │                                      │
  │  Add to playlist ▾  ·  Share ▾       │
  └──────────────────────────────────────┘
```

- **Function**: Play, scrub, share, add to playlist, regenerate a
  segment, download, delete.
- **Aesthetic**: Waveform is the object. Actions are secondary,
  living in a horizontal bar below. Metadata (tags, bpm) is visible
  but softened.
- **Regenerate a segment**: click-drag a range on the waveform →
  tooltip "regenerate this section" → modal with new prompt.
- **Keyboard**: space (play/pause), ← → (seek 5s), shift-← → (seek
  30s), E (edit title), S (share), P (add to playlist).

### S5 — Playlist detail

- **Function**: Ordered list of tracks. Drag to reorder. Click to
  play in sequence. Share the whole playlist.
- **Aesthetic**: Cover art = gradient derived from the tracks'
  average spectral signature (clever, and genuinely informative —
  a jazzy playlist shimmers blue-warm, a drum-heavy one stamps
  amber-deep).
- **Motion**: Reorder uses FLIP + spring. Row that's moving carries
  a subtle shadow. Other rows part to make space.

### S6 — Public share view (unauth)

Same layout as S5 but with:
- No "edit" affordances.
- A small "Made on Setlist · claim this playlist" CTA at the bottom
  (growth hook, not annoying).
- OG image auto-generated server-side from the cover gradient +
  playlist title.
- Works with no JS (server-rendered for this route only).

---

## Component inventory

### Primitives (from shadcn/ui, customized)

- Button (primary / secondary / destructive / ghost, 3 sizes)
- Input (text, password, search)
- Textarea (auto-resize, character counter)
- Select (radix-based, keyboard-first)
- Checkbox, Radio, Switch
- Dialog / Sheet / Drawer
- Tooltip / Popover / HoverCard
- Tabs / Accordion / Collapsible
- Toast (single slot, top-right)
- ContextMenu / DropdownMenu
- Command (Cmd-K palette)
- Progress / Skeleton / Spinner

### Composed components

- **PromptInput**: multiline, with chip-style style-tag input,
  character count, Cmd-Enter to submit.
- **Waveform**: WaveSurfer-backed, configurable height/color,
  streaming-fill variant for in-progress tracks.
- **TrackRow**: waveform mini + title + duration + actions. Used in
  list views.
- **PlaylistCard**: cover gradient + title + track count.
- **ShareDialog**: URL copy + expiration selector + channel label.
- **SegmentPicker**: click-drag on waveform, visual range handles.
- **TokenTicker**: monospaced live counter for generation speed.
- **CoverGradient**: canvas-drawn gradient from spectral data.

### Empty / error / loading states (one per component)

Every component above has all four states specified in its Storybook
story. If a component only has a "loaded" state in Storybook, it's
not done.

---

## Flows

### F1 — First track (new user)

```
landing → sign in (passkey) → studio (empty)
                                   │
                                   ▼
                         prompt suggestion shown
                                   │
                  [user types or accepts suggestion]
                                   │
                                   ▼
                       generation starts (S3)
                                   │
                      first audio plays at ~5s
                                   │
                                   ▼
                       user can scrub, replay
                                   │
                  [user clicks "Save" or autosave after 30s]
                                   │
                                   ▼
                          track in library
```

**Aesthetic beats**:
- Post-signin, the studio doesn't fade in — the waveform *draws
  itself in* as a welcome gesture (3-sec animated sketch).
- First generation's first-sound moment = micro-celebration (cover
  gradient pulses once, haptic if supported).

### F2 — Regenerate a section

```
  track detail → click-drag range on waveform
               → popover "regenerate this section?"
               → click → modal with prompt pre-filled for that range
               → submit → that range shows generation progress
               → other segments keep playing
               → new audio replaces old segment; undo available for 10s
```

**Aesthetic beat**: the replaced segment fades old→new with a 400ms
crossfade, not a cut. Respect the user's ears.

### F3 — Share a playlist

```
  playlist → share button → dialog
          → choose channel (Discord / Twitter / custom label)
          → choose expiration (24h / 7d / never)
          → copy link
          → link goes to S6 (public view)
          → OG image pre-rendered server-side
```

### F4 — Offline save → online sync

If the user is offline (or signed out mid-session):
- Generations are queued in IndexedDB.
- Attempted re-sync on reconnect.
- Conflict: if a playlist was edited server-side, resolve with
  "yours / theirs / merge" UX.

---

## Responsive / adaptive

### Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | < 640px | Single column, rails as bottom tabs |
| Tablet | 640-1024px | Two column: canvas + one rail (other collapses) |
| Desktop | > 1024px | Three column (the default layout above) |
| Wide | > 1440px | Canvas maxes at 960px; rails expand |

### Touch vs pointer

- Touch: bigger hit targets (44pt min), drag handles visible, swipe
  gestures for row actions.
- Pointer: hover states, keyboard shortcuts visible in tooltips,
  cursor changes for draggable regions.

### iPad-specific (important for Procreate angle)

- Apple Pencil: treat as pointer with pressure → map to waveform
  scrub velocity (draw on the waveform to scrub at variable speed).
- Split View: app stays usable in 320pt compact width.
- External keyboard: all shortcuts mirror desktop.

---

## Accessibility

- **WCAG 2.2 AA** minimum. Targeting AAA where cheap.
- Every interactive element: focus ring (accent-colored, 2px offset,
  not hidden), keyboard-reachable, labeled for screen reader.
- Waveform: keyboard-scrubbable (space = play, ← → = seek), live
  region announces playback state.
- Color contrast: 4.5:1 on all text. Amber CTAs on warm neutral hits
  4.9:1.
- Motion: `prefers-reduced-motion` disables all non-essential
  animation. Essential motion (generation progress) is simplified,
  not hidden.
- Screen reader test: every primary flow completable with VoiceOver +
  Safari iOS, NVDA + Firefox.

---

## Microcopy

Voice: **warm but direct**. Like a studio engineer, not a chatbot.

Examples:

| Context | Not this | This |
|---|---|---|
| Empty library | "You haven't created any tracks yet." | "Nothing here yet. Make something." |
| Generation fails | "An error occurred. Please try again." | "That didn't land. Retry?" |
| Share link copied | "Link copied to clipboard!" | "Copied." |
| Delete confirmation | "Are you sure you want to delete this track? This action cannot be undone." | "Delete this track? You can undo for 10 seconds." |
| Login error | "Invalid credentials." | "We didn't recognize that. Try magic link?" |
| Offline | "You are offline." | "Offline. Your work saves locally." |

Principles:
- Short. One sentence where possible.
- Active voice.
- Blame the system, not the user.
- Offer the next action inline.

---

## Design tokens — concrete

### Color (warm, Setlist)

```
primitives.color.neutral:
  0:  #F7F3EC   (paper, lightest)
  1:  #EDE7DC
  2:  #E0D8C9
  3:  #C9BFAC
  6:  #6B5F4B
  9:  #3A3227
  11: #1F1A14
  12: #14100B   (ink, darkest)

primitives.color.amber:
  5:  #C9821E
  6:  #B06E0F   ← primary accent
  7:  #8F5807
```

### Type

```
display:  "Reckless Neue" 700
body:     "Inter"         450 / 600
mono:     "Berkeley Mono" 400

scale (1.2 ratio):
  14  body-sm
  17  body (base)
  20  body-lg
  24  heading-4
  29  heading-3
  35  heading-2
  42  heading-1
  58  display-lg (hero)
```

### Space (4px base, 8pt grid)

```
0,  4,  8,  12,  16,  24,  32,  48,  64,  96,  128
```

### Motion

```
duration:
  fast:     120ms
  medium:   220ms
  slow:     360ms
  epic:    1200ms  (reserved for first-time moments)

easing:
  out:        cubic-bezier(0.22, 1, 0.36, 1)   ← entry default
  in:         cubic-bezier(0.7, 0, 0.84, 0)    ← exit default
  inOut:      cubic-bezier(0.65, 0, 0.35, 1)
  spring:     spring(mass: 1, stiffness: 180, damping: 22)
```

See [`MOTION.md`](./MOTION.md) for the choreography library.

---

## Storybook

Every component lives in Storybook with stories for:
- Default
- All variants (size, tone)
- All states (loading, empty, error, disabled, focus, hover, active)
- Dark mode (mirror)
- Reduced motion
- RTL (for future i18n)

CI runs Chromatic visual regression on every PR. A pixel change is a
PR discussion, not a slip-through.
