# Routing — One of One (verified 2026-07-19, live engine catalog)

Engine: `http://localhost:5412` — health OK, FAL_KEY loaded, daily spend
limit $65, $0 spent today.

## Decision: unified Veo 3.1 family for all picture

The preflight prices overturned one greenlight-era assumption: Seedance
2.0 reference-to-video costs **$0.682/s at 1080p**, while Veo 3.1 has its
own `reference-to-video` endpoint at **$0.20/s audio-off (native 1080p)**
— Veo-tier image quality, native character references, under a third of
the price. Veo 3.1 fast covers connective shots at $0.10/s. One model
family for every shot also buys grade/texture consistency across cuts,
which multi-vendor routing would have to fight for.

| Item | Endpoint | $/unit | Units | Est. cost |
|---|---|---|---|---|
| Character reference still | `fal-ai/nano-banana-pro` | $0.15/img | 1 + 2 retakes | $0.45 |
| Street-scene still (shot 8 comp) | `fal-ai/nano-banana-pro` | $0.15/img | 1 + 3 retakes | $0.60 |
| Shots 2 (4s) + 3 (5s→gen 6s) heroes | `fal-ai/veo3.1/reference-to-video`, audio off, 1080p | $0.20/s | 10s x 3 takes | $6.00 |
| Shot 8 hero (8s) | `fal-ai/veo3.1/image-to-video` from street still, audio off, 1080p | $0.20/s | 8s x 3 takes | $4.80 |
| Shot 8 repair path | `google/gemini-omni-flash/edit` (token-billed, ~$0.13/s-class) | ~$1–2/edit | 0–2 | $0–4 |
| Shots 1,4,5,6,7,9,10 (7 x ~4s) | `fal-ai/veo3.1/fast/image-to-video`, audio off (shot 9 via `veo3.1/fast/reference-to-video`) | $0.10/s | ~28s + ~16s retakes | $4.40 |
| SFX x5 + room tone | `fal-ai/elevenlabs/sound-effects/v2` | quote-verified (~$0.10/gen class; API hides rate) | 6 + retakes | ~$1 |
| Pulse score (~60s) | `fal-ai/elevenlabs/music` | $0.80/output-min (rounds up) | 1–2 takes | $1.60 |
| **Total** | | | | **~$19–23** |

Cap $50 (ledger enforced); engine daily limit $65 backstops. Every
generation goes through the engine's estimate→quote→generate flow, so the
SFX rate gets exactly priced at quote time before any spend.

## Notes

- Veo 3.1 full and fast both bill 720p and 1080p at the same rate —
  always request 1080p.
- Audio off on every video request ($0.20 vs $0.40 full; $0.10 vs $0.15
  fast) — all native clip audio is muted in the edit.
- Shot 3 wants 5s; Veo durations are stepped, so generate 6s and trim.
- Alternates priced and rejected: Seedance 2.0 ref-to-video ($0.682/s @
  1080p — quality peer, 3.4x price), Kling v3 Pro i2v ($0.112/s audio off
  — cheaper than Veo full but weaker crowd-motion track record), Gemini
  Omni Flash ref-to-video ($0.13/s, 720p — kept as the shot-8 repair
  path and as B-cam if a Veo hero fails QC twice).
- The curated engine registry predates these endpoints; Task 2 adds
  registry entries for the four we use.
- Engine catalog has no audio categories; SFX/music prices came from
  fal's public model API (`pricingInfoOverride` for music) and are
  re-verified by the engine quote before generation.
