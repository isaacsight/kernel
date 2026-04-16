# Cut 1 — Issue Drop

```
CUT: issue-drop for ISSUE 365
DURATION: 14.0s (420 frames @ 30fps)
GROUND: ivory (#FAF9F6)
TEMPLATE: tiktok/templates/issue-drop.svg

────────────────────────────────────────────────────
TIMELINE
────────────────────────────────────────────────────

0.0–2.0s   (0–60f)    Ground sweeps in from left edge
                      Ivory fills the frame. Kicker arrives at frame 30.
                      KICKER: [FEATURE · 手仕事号]

2.0–5.0s   (60–150f)  Masthead lockup
                      Wordmark kernel.chat fades in (6f) centered.
                      Banner "MAGAZINE FOR CITY CODERS" reveals under it.
                      Price "¥0 · BYOK" arrives at frame 120.
                      Tomato hairline draws left-to-right at frame 150.

5.0–8.0s   (150–240f) Monument arrive
                      ISSUE 365 APRIL 2026 block scales 0.92 → 1.00 (24f)
                      with opacity 0 → 1. Holds with ambient sway.

8.0–12.0s  (240–360f) Headline + em-sweep
                      "The Craft Issue" arrives word-by-word:
                      - "The " at 240f
                      - "Craft" at 255f (italic tomato)
                      - Em-sweep (tomato underline, 12f) at 270f
                      - "Issue" at 285f
                      Swash subtitle "What we make when nobody's watching."
                      reveals 80ms/char starting at 300f.

12.0–14.0s (360–420f) Colophon
                      Tomato rule draws full width at 360f (12f sweep).
                      "ISSUE 365 · APRIL 2026" fades in at 378f.

────────────────────────────────────────────────────
SOUND
────────────────────────────────────────────────────

0.0–14.0s  café-shibuya-0800 (ambient, -22 LUFS)
2.0–5.0s   subtle HHKB key-press on each masthead element arrival
14.0s      final soft key-press as colophon lands

No voiceover. No music.

────────────────────────────────────────────────────
MOTION (three layers — all required)
────────────────────────────────────────────────────

ambient:
  - grain ±1px @ 0.5Hz
  - tomato breath 0.92↔1.00 @ 0.3Hz
  - hairline shimmer 0.80↔1.00 @ 0.4Hz
  - monument sway ±0.3° ±2px @ 0.25Hz
  - steam drift (issue-specific): 2% tomato, lower-left, 0.15Hz

camera:
  - push 1.000 → 1.025 linear over 420f
  - drift +3px y linear over 420f (earth settling)

primary:
  - 0–60f:    ground sweep
  - 30f:      kicker fade-in (6f)
  - 90f:      wordmark fade-in
  - 120f:     price fade-in
  - 150f:     tomato hairline sweep (12f)
  - 150–174f: monument arrive (24f)
  - 240–315f: headline word reveals + em-sweep
  - 300–360f: swash type-reveal
  - 360–372f: colophon rule sweep
  - 378f:     colophon text fade-in

────────────────────────────────────────────────────
CAPTION
────────────────────────────────────────────────────

[FEATURE · 手仕事号]
ISSUE 365 · APRIL 2026
The Craft Issue: What we make when nobody's watching.

A conversation with K. Tanaka — backend developer, Shimokitazawa — about tools, routine, and why the things you build when nobody's watching are the ones that matter most.

Read the full issue — link in bio.

#kernelchat #magazine #craft
```
