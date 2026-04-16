# TikTok Tokens — kernel.chat

> Concrete pixel-level spec for the kernel.chat TikTok grammar.
> Companion to `docs/tiktok.md` (philosophy) and `tiktok/`
> (template files).
>
> Every number in this doc is a measurement, not a range. If the
> token says 36px, it's 36px.

---

## Canvas

| Token | Value | Notes |
|---|---|---|
| `--tk-canvas-w` | 1080px | 9:16 vertical |
| `--tk-canvas-h` | 1920px | 9:16 vertical |
| `--tk-frame-rate` | 30fps | All timings below are in frames @ 30fps |
| `--tk-export-format` | H.264 MP4 | sRGB, no HDR |
| `--tk-loudness-target` | -14 LUFS | Platform standard |

---

## Safe Areas

TikTok UI overlays the top and bottom of the frame. Put nothing
structural inside the forbidden zones.

```
┌──────────────────────────┐ 0
│    TikTok UI (forbidden) │
├──────────────────────────┤ 80   ← --tk-safe-top
│                          │
│   KICKER STRIP           │ 160  ← --tk-kicker-bottom
│                          │
│                          │
│   CONTENT ZONE           │
│   (920w × 1520h)         │
│                          │
│                          │
│                          │
│   COLOPHON STRIP         │ 1760 ← --tk-colophon-top
│                          │
├──────────────────────────┤ 1840 ← --tk-safe-bottom
│    TikTok UI (forbidden) │
└──────────────────────────┘ 1920
```

| Token | Value |
|---|---|
| `--tk-safe-top` | 80px |
| `--tk-safe-bottom` | 80px |
| `--tk-safe-left` | 80px |
| `--tk-safe-right` | 80px |
| `--tk-kicker-bottom` | 160px (safe + 80 strip) |
| `--tk-colophon-top` | 1760px |
| `--tk-content-y` | 240px (start of content) |
| `--tk-content-h` | 1440px (height of content zone) |
| `--tk-content-w` | 920px (canvas minus side safes) |

---

## Type Scale

All type is EB Garamond or Courier Prime. No system fonts. No fallbacks.

### Display — EB Garamond

| Role | Size | Line-height | Letter-spacing | Weight |
|---|---|---|---|---|
| `--tk-type-monument` | 720px | 0.82 | -0.05em | 800 |
| `--tk-type-display-xl` | 200px | 0.92 | -0.04em | 700 |
| `--tk-type-display-l` | 144px | 0.95 | -0.03em | 700 |
| `--tk-type-display-m` | 96px | 1.02 | -0.02em | 600 |
| `--tk-type-pull-quote` | 72px | 1.15 | -0.01em | 500 italic |
| `--tk-type-body` | 48px | 1.35 | 0 | 400 |
| `--tk-type-swash` | 40px | 1.3 | 0 | 400 italic |

### Meta — Courier Prime

| Role | Size | Line-height | Letter-spacing | Weight |
|---|---|---|---|---|
| `--tk-type-kicker` | 36px | 1.2 | 0.16em | 400 UPPERCASE |
| `--tk-type-folio` | 32px | 1.2 | 0.12em | 400 UPPERCASE |
| `--tk-type-colophon` | 28px | 1.3 | 0.14em | 400 UPPERCASE |
| `--tk-type-caption-meta` | 24px | 1.4 | 0.1em | 400 |

---

## Color — same hex as web

| Token | Hex | Role |
|---|---|---|
| `--tk-tomato` | `#E24E1B` | Spot. Em, kickers, rules, catalog numbers. |
| `--tk-ink` | `#1F1E1D` | Primary text on light grounds |
| `--tk-coffee` | `#6B4E3D` | Secondary text, swash |
| `--tk-cream` | `#F3E9D2` | Default ground |
| `--tk-ivory` | `#FAF9F6` | Airy ground |
| `--tk-butter` | `#EFD9A0` | Indoor ground |
| `--tk-kraft` | `#C8A97E` | Material ground |
| `--tk-ink-ground` | `#1F1E1D` | Dark ground |
| `--tk-hairline` | rgba(31, 30, 29, 0.85) | Thin rules |
| `--tk-hairline-soft` | rgba(31, 30, 29, 0.16) | Ghost rules |

**Forbidden:** `#FFFFFF`, `#000000`, any blue, any purple, any
gradient. Never a second accent.

---

## Rules (the graphic element, not the instruction)

| Token | Thickness | Length | Color |
|---|---|---|---|
| `--tk-rule-hairline` | 2px | full content width | `--tk-hairline` |
| `--tk-rule-tomato` | 6px | 180px | `--tk-tomato` |
| `--tk-rule-tomato-wide` | 8px | full content width | `--tk-tomato` |
| `--tk-rule-underline-sweep` | 10px | matches word width | `--tk-tomato` |

---

## Kicker Lockup

The kicker is `[CATEGORY · 日本語]` in mono tomato.

| Spec | Value |
|---|---|
| Text | `[<CATEGORY> · <JP>]` |
| Font | Courier Prime 36 / 1.2 / 0.16em tracking |
| Color | `--tk-tomato` |
| Bracket rendering | Literal `[` and `]` — not Unicode box-drawing |
| Position y | 120px (centered in 80–160 zone) |
| Position x | 80px (left-aligned) |
| Underline | Optional 2px `--tk-hairline` at y=158, width 200px |

Example: `[FEATURE · 手仕事号]`

---

## Colophon Lockup

The colophon is the tomato rule + `ISSUE N · MONTH YEAR`.

| Spec | Value |
|---|---|
| Rule | `--tk-rule-tomato-wide` (8px, full content width) |
| Rule y | 1760px |
| Text | `ISSUE <N> · <MONTH> <YEAR>` |
| Font | Courier Prime 28 / 1.3 / 0.14em tracking |
| Color | `--tk-ink` on light ground, `--tk-ivory` on ink ground |
| Text y | 1800px (40px below rule) |
| Alignment | Centered horizontally |

Example: `ISSUE 365 · APRIL 2026`

---

## Monument Lockup

The monument is the stacked issue-number block. On a monument
cut, it becomes the dominant visual.

```
    ISSUE                  ← Courier 36
    365                    ← EB Garamond 720 italic-optional
    APRIL 2026             ← Courier 36
```

| Spec | Value |
|---|---|
| "ISSUE" label | Courier Prime 36 / 0.16em / `--tk-ink` |
| Number | EB Garamond 720 / 0.82 / -0.05em / 800 / `--tk-ink` |
| "MONTH YEAR" | Courier Prime 36 / 0.16em / `--tk-ink` |
| Vertical gap | 24px between label and number, 24px between number and date |
| Total block height | ~820px |
| Position y | 550px (vertically centered in content zone) |
| Alignment | Centered horizontally |

---

## Masthead Lockup (issue-drop cuts only)

The masthead is the cover identity: wordmark + banner + price.

| Element | Spec |
|---|---|
| Wordmark `kernel.chat` | EB Garamond 200 / 0.92 / -0.04em / 800 / `--tk-tomato` with 2px coffee drop shadow |
| Dot in wordmark | `--tk-ink` italic |
| Banner `MAGAZINE FOR CITY CODERS` | Courier 28 reverse-out: `--tk-ivory` on `--tk-tomato` fill, 8px padding, centered |
| Price `¥0 · BYOK` | Courier 28, `--tk-ink`, right-aligned |

All stacked vertically with 16px between rows. Total height ~340px.

---

## Motion Tokens

Motion has three layers. All three must be present in every cut:
**ambient** (always on), **camera** (always on), **primary** (the
beats). Nothing is ever frozen — held beats last no more than 8
frames without some layer moving.

All timings in frames @ 30fps. Seconds in parens.

### Primary motion (the beats viewers notice)

| Token | Frames | Seconds | Use |
|---|---|---|---|
| `--tk-fade-in` | 6f | 0.200s | Headlines entering, kickers arriving |
| `--tk-fade-out` | 6f | 0.200s | Elements leaving |
| `--tk-dissolve-overlap` | 6f | 0.200s | Outgoing + incoming overlap during transition |
| `--tk-hold-max-static` | 8f | 0.267s | Max frames with no primary motion (ambient keeps going) |
| `--tk-emphasis-sweep` | 12f | 0.400s | Tomato underline drawing under em word |
| `--tk-type-reveal-char` | 2.4f | 0.080s | Per-character type reveal |
| `--tk-monument-arrive` | 24f | 0.800s | Number scaling 0.92 → 1.00 + fade |
| `--tk-ground-sweep` | 60f | 2.000s | New cut's stock filling from one edge |

### Ambient motion (continuous — always on, every frame)

These are the baseline that keeps the video alive. Small
amplitudes on purpose — they should not draw the eye individually.

| Token | Property | Amplitude | Frequency |
|---|---|---|---|
| `--tk-ambient-grain` | Ground x/y offset | ±1px | 0.5 Hz |
| `--tk-ambient-tomato-breath` | Tomato-rule opacity | 0.92 ↔ 1.00 | 0.3 Hz |
| `--tk-ambient-monument-sway` | Monument rotate + y | ±0.3° / ±2px | 0.25 Hz |
| `--tk-ambient-hairline-shimmer` | Hairline opacity | 0.80 ↔ 1.00 | 0.4 Hz |
| `--tk-ambient-type-breath` | Tracking on held display | ±0.001em | 0.2 Hz |

### Camera motion (continuous — always on)

| Token | Move | Rate |
|---|---|---|
| `--tk-camera-push` | Scale 1.00 → 1.025 over the full cut | 0.02% per frame |
| `--tk-camera-drift` | ±4px y-translation over the full cut | 0.1px per frame |

Camera never pulls back, never cuts, never shakes. It always
pushes in slowly and drifts minutely.

### Easing

| Token | Curve | Use |
|---|---|---|
| `--tk-ease-fade` | linear | Opacity changes |
| `--tk-ease-arrive` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Objects settling |
| `--tk-ease-sweep` | `cubic-bezier(0.4, 0, 0.2, 1)` | Underline / ground sweeps |
| `--tk-ease-ambient` | sine (looped) | All ambient motion |
| `--tk-ease-camera` | linear | Camera push |

No spring physics. No bounce. No overshoot. No bezier overshoot
curves (values > 1 are forbidden on the second control point).

---

## Sound Tokens

| Token | Spec |
|---|---|
| `--tk-sound-headroom` | -3dB peak ceiling |
| `--tk-sound-music-level` | -18 LUFS under voiceover |
| `--tk-sound-vo-level` | -14 LUFS target |
| `--tk-sound-ambient-level` | -22 LUFS |
| `--tk-sound-silence-allowed` | yes |

### Sound palette (the library)

| Slug | What it is | Use |
|---|---|---|
| `café-shibuya-0800` | Blue Bottle Shibuya 8am, light rain | Style / field dispatch |
| `hhkb-typing` | HHKB Professional Hybrid Type-S typing | Craft / interview |
| `single-violin-a` | Held A note on violin, 12s | Monument / drop |
| `rain-window-night` | Rain on a Tokyo window, night | Indoor / interview |
| `keyboard-mechanical-slow` | Mechanical keyboard at reading pace | Essay / interview |
| `silence` | Intentional silence | Pull-quote / monument |

Each issue may adopt one as its "sound palette." No issue uses
more than two.

---

## Composition Templates

Each cut type is an SVG master in `tiktok/templates/`:

| Cut | File | Key layers |
|---|---|---|
| Issue drop | `tiktok/templates/issue-drop.svg` | ground fill, masthead, monument, headline, colophon |
| Pull quote | `tiktok/templates/pull-quote.svg` | ground, kicker, quote body, attribution, colophon |
| Monument | `tiktok/templates/monument.svg` | ground, monument lockup, single-line swash, colophon |
| Colophon | `tiktok/templates/colophon.svg` | ground, kicker, credits list, sign-off, colophon |

Import into After Effects (File → Import → SVG, preserves
layers) or Figma (drag-and-drop) or Rive (File → Import).

---

## How to compose a new cut

1. Pick the cut type from `docs/tiktok.md` § Eight Cuts.
2. Start from the SVG master in `tiktok/templates/`.
3. Fill the data slots (kicker text, headline, body, issue).
4. Pick the ground stock matching the issue (or a contrast
   choice, documented in the cut spec).
5. Add the sound slug from the sound palette (or `silence`).
6. Set motion timings from the tokens table above.
7. Export H.264 MP4, -14 LUFS, sRGB.
8. File the cut spec as `tiktok/specs/<issue>/<cut>.md`.

---

## Token source-of-truth

When the tokens here disagree with `docs/tiktok.md` (the
philosophy doc), this doc wins. When they disagree with the
SVG templates, the SVG templates win — fix this doc to match.

When a new cut type is added:
1. Add it to the Eight Cuts table in `docs/tiktok.md`.
2. Add its composition entry to the table in this doc.
3. Ship the SVG master in `tiktok/templates/`.
4. Cross-reference from `tiktok-producer.md`.
