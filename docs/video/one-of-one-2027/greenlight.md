# Greenlight packet — "One of One" (Spring 2027)

**Status: AWAITING ISAAC'S APPROVAL — no paid generation before sign-off.**
Spec: `docs/superpowers/specs/2026-07-19-one-of-one-2027-design.md`
Plan: `docs/superpowers/plans/2026-07-19-one-of-one-2027.md`
Routing: `docs/video/one-of-one-2027/routing.md` (prices verified live 2026-07-19)

## Visual bible

Character: mid-20s, androgynous, dark cropped hair, calm face. Setting:
compact near-future apartment, warm practical light, pre-dawn blue outside
the window. The garment: a matte sage-green structured coat, visible fine
knit texture, small woven white label reading "ONE OF ONE". City: overcast
morning, muted concrete + glass street, no signage, no logos. Grade
target: soft contrast, desaturated except the sage green. Every prompt
ends with the suffix: "vertical 9:16, cinematic realism, 35mm look,
shallow depth of field, no text overlays, no captions".

## Reference stills (nano-banana-pro, $0.15/image)

**reference.png** — Full-body studio-neutral portrait of a mid-20s
androgynous person with dark cropped hair, wearing a matte sage-green
structured knit coat with a small white woven chest label reading "ONE OF
ONE", standing relaxed, facing camera, soft overcast light, plain
warm-grey background, vertical 9:16, cinematic realism, 35mm look, no
text overlays.

**reference-street.png** — Overcast morning city street, vertical 9:16
composition: at least twelve pedestrians of different ages mid-stride in
both directions, every one wearing the identical matte sage-green
structured knit coat, nobody interacting, muted concrete and glass, no
signage, no logos, cinematic realism, 35mm look.

## Shot prompts (1–10)

1. Static camera. A dim compact bedroom before dawn, deep blue light
   through the window, a person asleep. On the nightstand a phone screen
   glows softly, lighting the pillow. Nothing else moves. [suffix]
2. (ref-to-video, reference.png) The person stands facing a full-length
   smart mirror in underlayers, arms relaxed. A soft horizontal band of
   warm scan-light sweeps slowly down their body once, head to floor.
   Calm, domestic, unhurried. [suffix]
3. (ref-to-video, reference.png) Macro-to-medium: thousands of fine
   sage-green threads weave themselves into fabric directly onto the
   person's shoulders and torso, knit texture forming in real time, the
   coat taking shape on the body. Mechanical-organic, mesmerizing,
   precise. [suffix]
4. (i2v, reference.png) Medium close-up. The finished coat shifts hue
   once — a slow ripple from grey-green to final matte sage — and
   settles. The person watches themselves, a small pleased exhale.
   [suffix]
5. Extreme close-up sequence on garment details: a cuff seam sealing
   itself, a collar settling flat, a small white woven chest label
   reading "ONE OF ONE". Soft pre-dawn interior light. [suffix]
6. (i2v, reference.png) The person turns once in front of the mirror,
   checking the coat's fit, a brief private moment of vanity, faint
   smile. Warmest beat of the film. [suffix]
7. Close-up: a hand resting on a brushed-metal apartment door handle,
   sage-green cuff visible, a beat of stillness, then the handle begins
   to turn. Pre-dawn interior light. [suffix]
8. (i2v, reference-street.png) Slow lateral pan; ordinary walking motion
   in both directions; every pedestrian keeps the identical sage-green
   coat; nobody looks at anyone; ordinary pace, no reactions. [suffix]
9. (ref-to-video, reference.png) Street level, medium shot. The person
   has stopped mid-stride on the sidewalk. They look down at their own
   sleeve, then up. Micro-expression, unreadable — not horror, not
   comfort. Identical sage coats blur past in fore- and background.
   [suffix]
10. Static wide from across the street: the person walks on and merges
    into a flow of pedestrians in identical sage-green coats until they
    are indistinguishable. Overcast, quiet, unhurried. [suffix]

## ElevenLabs audio (via engine /v1/audio/sfx)

1. assembly-purr (5s): soft mechanical-organic knitting machine purr,
   thousands of fine threads weaving, intimate close mic, no music
2. fabric-whisper (4s): fine knit fabric settling and shifting against
   skin, gentle cloth movement, close mic, no music
3. scan-tone (3s): single soft rising electronic scan tone, warm sine
   character, domestic smart-mirror, subtle
4. phone-chirp (1s): gentle two-note smartphone notification chime,
   soft, modern, unobtrusive
5. street-ambience (15s): quiet overcast city morning, distant traffic
   hum, sparse footsteps, no voices, no music
6. room-tone (10s): near-silent apartment room tone, faint HVAC
7. pulse-score (~60s, elevenlabs-music): minimal two-note pulse, 84 BPM,
   sub-heavy, sparse, hypnotic, no melody, no drums beyond the pulse —
   must survive a hard mute at ~29s on a note boundary

## Spend ledger

| Item | Endpoint | Planned | Actual |
|---|---|---|---|
| reference.png (1 + 2 retakes) | nano-banana-pro | $0.45 | |
| reference-street.png (1 + 3 retakes) | nano-banana-pro | $0.60 | |
| Shots 2+3 heroes (10s x 3 takes, audio off, 1080p) | veo3.1/reference-to-video | $6.00 | |
| Shot 8 hero (8s x 3 takes, audio off, 1080p) | veo3.1/image-to-video | $4.80 | |
| Shot 8 repair (0–2 edits) | gemini-omni-flash/edit | $0–4 | |
| Connective 7 shots (~44s incl. retakes, audio off) | veo3.1/fast/(image|reference)-to-video | $4.40 | |
| SFX x6 + retakes | elevenlabs/sound-effects/v2 | ~$1.00 | |
| Pulse score (1–2 takes) | elevenlabs/music | $1.60 | |
| **Total** | | **~$19–23** | |

Cap: $50 (this ledger). Engine backstop: $65/day limit, $0 spent today.
Every generation goes estimate → signed quote → generate; the quote is
the binding price shown before each spend.

## Approval

- [ ] Isaac approves prompts and spend. Date: ____
