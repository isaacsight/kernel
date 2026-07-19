# "One of One" — a dispatch from Spring 2027

**Date:** 2026-07-19
**Status:** Design approved in brainstorm; awaiting spec review
**Deliverable:** ~45s vertical (9:16, 1080x1920, 30fps) speculative short for
TikTok / Reels / Shorts

## Premise

Standalone trend content arguing a thesis as fiction, not commentary: in 2027,
on-demand AI garment generation gives everyone a "one of one" wardrobe — and
mass customization converges on a new uniformity. One character's morning
routine, played dead straight, until the street reveals that everyone got
exactly what they wanted.

No irony in the camera. The images carry the sting.

## Structure: linear realism

Ten shots, one continuous morning, hard cuts throughout (house style,
ratified in the what-we-made-v3 film).

| # | Dur | Shot | Tier |
|---|-----|------|------|
| 1 | 4s | Pre-dawn bedroom; phone glows on nightstand: "Today's look is ready." | std |
| 2 | 4s | Character at mirror; soft scan-light passes over them. | **hero** |
| 3 | 5s | Garment assembles/knits onto the body — thread finding form, macro texture. | **hero** |
| 4 | 3s | Fabric shifts hue once, settles. Close on face: mild pleasure. | std |
| 5 | 3s | Detail beats: cuff sealing, collar settling, woven label "ONE OF ONE." | std |
| 6 | 3s | Private vanity moment at the mirror. The one warm beat. | std |
| 7 | 3s | Hand on door handle. Ordinary confidence. | std |
| 8 | 8s | Door opens: slow street pan — twelve strangers, same silhouette, same color, same label. Nobody notices. | **hero** |
| 9 | 5s | Character stops. Looks at their sleeve. Unreadable micro-expression. | std |
| 10 | 4s | Static wide; they merge into the flow of identical coats. Dateline card: **SPRING 2027**. | std |

Total ≈ 42s of picture plus breathing room in the cut.

## Sound

- **No VO.** Diegetic bed + minimal two-note pulse score.
- The pulse **drops out** at the door opening; shot 8 plays in street
  ambience only.
- On-screen text limited to two items: the phone notification (shot 1) and
  the dateline card (shot 10). No captions needed.
- Master to -16 LUFS / -1.5 dBTP, two-pass, same chain as what-we-made-v3.

### ElevenLabs SFX (all audio generation)

Bespoke effects, generated not library-pulled:

1. Garment-assembly purr (mechanical-organic; does not exist in libraries)
2. Fabric whisper / settling
3. Scan tone (mirror pass)
4. Phone notification chirp
5. Room tone + street ambience beds (or reuse the compensated-bed technique
   from v3 if generation quality disappoints)
6. Two-note pulse score (ElevenLabs music generation; fallback is a
   hand-built pulse in Ableton if the generated cue feels generic)

Estimated cost: a few dollars.

## Production

### Video generation: fal.ai API

Use the galley-video-engine fal.ai integration (300+ model catalog, E2E
verified 2026-07-18). Palmier Pro is the edit bay only: import, cut,
master, export. Project: `one-of-one-2027.palmier`, 1080x1920 @ 30fps.

Routing:

- **Character/wardrobe reference image first.** Generated with a top image
  model and reused across every shot for consistency — this is the main
  failure risk in AI fashion video and is solved before any video
  generation fires.
- **Hero shots (2, 3, 8):** premium image-to-video model with strong
  texture fidelity, driven from the reference image.
- **Connective shots (1, 4, 5, 6, 7, 9, 10):** cheaper text/image-to-video
  tier.

Budget envelope: **$30–50**, assuming two retakes per hero. Per-shot
pricing tracked from the fal.ai catalog.

### Greenlight gate (hard requirement)

No paid generation fires on fal.ai or ElevenLabs until Isaac approves a
greenlight packet containing:

1. Character reference image (or its prompt if image gen is also paid)
2. Per-shot model routing with prices
3. SFX generation list

This follows the standing no-credit-spend-without-permission rule and the
Directing Room plan/spend separation.

## Delivery

- One 1080x1920 master; native uploads to TikTok, Reels, YouTube Shorts.
- Caption leads with the question, not the thesis: "Everyone got exactly
  what they wanted." Pinned comment carries the take.
- Three hashtags maximum. No hashtag soup.

## Out of scope

- Widescreen recut (revisit only if the vertical performs)
- VO or caption tracks
- Loop/grid structural variants (considered and rejected in brainstorm:
  loop makes the ending a trick, grid is cramped at 9:16 and costs more
  generations)
