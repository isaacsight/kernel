# Cut 4 — Pull Quote: "The Craft is Being Courteous"

```
CUT: pull-quote for ISSUE 365
DURATION: 16.0s (480 frames @ 30fps)
GROUND: ivory (#FAF9F6)
TEMPLATE: tiktok/templates/pull-quote.svg

────────────────────────────────────────────────────
TIMELINE
────────────────────────────────────────────────────

0.0–1.0s   (0–30f)    Ground + kicker
                      KICKER: [PULL QUOTE · 引用]
                      Short tomato rule at 24f.

1.0–12.0s  (30–360f)  Quote reveals, character by character
                      "The craft is being courteous to a stranger
                       in the future who will read your code at 11pm
                       and be slightly annoyed already."

                      80ms/char = ~146 characters ≈ 350f.
                      Em-sweep on "courteous" at ~75f (12f).
                      Em-sweep on "slightly annoyed" at ~320f (12f).

12.0–13.5s (360–405f) Brief hold on full quote with ambient motion.

13.5–14.5s (405–435f) Attribution fades in
                      "K. TANAKA · ISSUE 365"

14.5–16.0s (435–480f) Colophon
                      Tomato rule full-width (12f sweep).
                      "ISSUE 365 · APRIL 2026"

────────────────────────────────────────────────────
SOUND
────────────────────────────────────────────────────

0.0–16.0s  café-shibuya-0800 (-22 LUFS, very faint)

Optional voiceover — magazine voice, reading quote at normal pace,
starting at frame 60. If used, -14 LUFS over music dipped to -26.
Default is silent.

────────────────────────────────────────────────────
MOTION (three layers — all required)
────────────────────────────────────────────────────

ambient:
  - grain ±1px @ 0.5Hz
  - tomato breath 0.92↔1.00 @ 0.3Hz
  - hairline shimmer 0.80↔1.00 @ 0.4Hz
  - type breath ±0.001em @ 0.2Hz on held quote
  - steam drift (issue-specific): 2% tomato, lower-left, 0.15Hz

camera:
  - push 1.000 → 1.025 over 480f
  - drift ±4px y sine wave over 480f (one full period)

primary:
  - 0–30f:    ground + kicker
  - 24–36f:   short tomato rule under kicker
  - 30–380f:  quote type-reveal (80ms/char)
  - ~75f:     em-sweep on "courteous" (12f)
  - ~320f:    em-sweep on "slightly annoyed already" (12f)
  - 405–435f: attribution fade-in
  - 435–447f: colophon rule sweep
  - 450f:     colophon text fade-in

────────────────────────────────────────────────────
CAPTION
────────────────────────────────────────────────────

[PULL QUOTE · 引用]
ISSUE 365 · APRIL 2026
"The craft is being courteous to a stranger in the future who will read your code at 11pm and be slightly annoyed already."

From our interview with K. Tanaka — on what "craft" actually means once you stop calling it that.

The full interview — link in bio.

#kernelchat #magazine #craft
```
