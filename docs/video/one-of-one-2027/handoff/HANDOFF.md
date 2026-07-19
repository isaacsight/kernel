# HANDOFF — "One of One" (Spring 2027) fashion short

Written 2026-07-19 ~13:00 by the outgoing session. Everything below is
verified state, not aspiration. Read `../greenlight.md` (approved prompts
+ spend ledger), `routing.md`, and the plan at
`docs/superpowers/plans/2026-07-19-one-of-one-2027.md`.

## Final state — completed 2026-07-19

- The film is complete. Corrected Kling v3 Turbo renders filled shot 2
  (frames 120–240) and shot 3 (frames 240–390). The earlier eight jobs did
  not remain queued: provider responses showed four likeness-policy failures,
  two invalid inputs, and two Kling requests with the wrong image field. The
  successful retries passed the approved restaged frame as top-level
  `imageUrl`, which the engine converts to fal's `image_url`.
- Final Palmier timeline is contiguous across all ten shots, 0–1260 frames,
  1080x1920 at 30fps. Generated native audio for shots 2 and 3 is muted.
- Premaster: `output/one-of-one-2027-premaster.mp4`. Delivery master:
  `output/one-of-one-2027.mp4` — 42.0s picture / 42.1s container, 1260 video
  frames, H.264 + AAC. Measured master: -16.01 LUFS, -1.43 dBTP.
- Delivery copy is in `../delivery.md`; nothing was uploaded or published.

## Prior handoff state

- **8 of 10 shots accepted and cut** into
  `~/Documents/Palmier Pro/one-of-one-2027.palmier` (1080x1920, 30fps,
  42s / 1260 frames). Full sound design is in: A1 = muted native model
  audio, A2 = room-tone/street beds with 6-frame volume-keyframe fades,
  A3 = spot FX, A4 = pulse score hard-stopping at frame 750 (the door
  cut). Texts on V2: phone banner (frames 25–115) and "SPRING 2027"
  dateline (1170–1260). Composites verified at frames 40 and 1210.
- **Missing: shots 2 and 3.** Reserved timeline gaps: shot 2 = frames
  120–240 (4s, mirror scan), shot 3 = frames 240–390 (5s, garment
  assembly). EIGHT alternate takes were racing on fal when this session
  ended — see watchlist.json (jobId → output file). Whichever arrives
  first and passes QC wins; extras are alternates.
- QC criteria for the two slots: character matches
  `media/reference.png` (face, dark cropped hair, sage coat), scan-light
  reads (shot 2) / threads visibly weave into the coat (shot 3), no
  clone-doubles (Omni's known failure — a "reflection" that moves
  independently), no morphed hands.

## Local engine (all paid generation goes through it)

- Start: `cd "blog design" && FAL_DAILY_SPEND_LIMIT=50 npm run video-server`
  (port 5412; loads FAL_KEY from .env via node --env-file. Without the
  env var the limit defaults to $10 and blocks the remaining work.)
- **After any restart, warm the catalog cache** (quotes return usd:null
  otherwise): GET `/v1/catalog?category=image-to-video` (+ text-to-image,
  image-to-image as needed).
- Flow per generation: POST `/v1/{videos|images|audio/sfx}/estimate` →
  returns signed quoteToken → POST the generate route with the SAME body
  + quoteToken + (videos only) `durationSeconds` echoed from the
  estimate's `seconds` field, Authorization: Bearer
  `$(cat ~/.config/kernel/galley-engine-token)`. `gen.mjs` in this
  folder does all of it: `node gen.mjs video <out> '<jsonBody>'`.
- Poll `/v1/videos/jobs/<id>`; artifacts download from the returned
  localhost URL. `watch-all.mjs watchlist.json` polls every unresolved
  take and saves arrivals into `../media/` — RE-RUN IT FIRST THING; the
  outgoing session's watcher dies with the session.

## Endpoint gotchas learned the hard way

- Veo 3.1 full via fal: **dead queue** (90+ min, never started). $1.60
  sunk on job 019f7ba3-0a64-78b2-8d86-9d7b32a09395; if it ever completes
  it's a free alternate for shot 2. Avoid Google full-tier on weekends.
- Veo/Omni duration: fal wants `"4s"` (Veo, string) or integer seconds
  (Omni). Engine quotes parse both since commit 1541d20ac.
- Reference params: Veo/Omni/Seedance ref-to-video use `image_urls`
  (array); Kling i2v uses `start_image_url`. Arrays pass through
  cleanParams since commit "Allow short string arrays".
- Reference images must be fal-hosted URLs — use the `sourceUrl` of the
  stills' jobs (in `watchlist.json`'s sibling jobs or `get_media`):
  character `.../FL7EP5Tj8kODsjYg9NpVo_xceKmPEf.png`, street
  `.../rNobHHw1eu6lfzbido3f0_iGIdPINz.png`.
- ELEVENLABS_API_KEY is NOT in the server env — direct providers 402;
  the fal-hosted `elevenlabs-sfx` / `elevenlabs-music` providers were
  used instead (all 7 cues already delivered in `../audio/`).
- Sources are 720p/24fps (Omni, Kling frame rates vary); the Palmier
  project upconforms. Keep project at 1080x1920/30 — adding clips can
  silently re-match project resolution; re-run set_project_settings
  quality 1080p if it drifts.

## Remaining work, in order

1. Re-run the watcher; as shot-02*/shot-03* files land, QC (frame strips
   via ffmpeg) and pick winners. If nothing lands in ~30 min, check
   job statuses; last resort documented in plan: Kling start-frame
   two-stage (frames-02/03 already generated and QC'd in `../media/`,
   Kling turbo jobs for both already queued — see kling entries in
   watchlist).
2. Import winners into the Palmier project (folder `Shots/`), add_clips
   into the reserved gaps (shot 2: startFrame 120 source [0,4]; shot 3:
   startFrame 240 source [0,5]).
3. inspect_timeline spot frames (e.g. 150, 300), then export draft
   (`export_project` mode video) → **show Isaac for picture lock**.
4. Premaster export → two-pass ffmpeg loudnorm to -16 LUFS / -1.5 dBTP
   (chain in plan Task 9; repo scripts `npm run video:palmier:master`
   and `:qc` exist from the v3 film).
5. Write `../delivery.md` (caption copy is in plan Task 10 verbatim).
   Uploads are Isaac's manual step — never post.
6. Update the ledger actuals in `../greenlight.md` (spend was ~$21 of
   $50 at handoff; engine /health shows the tracker's number) and
   SCRATCHPAD.md.

## Standing rules that bound this work

- $50 hard cap, engine-enforced; every generation quote-gated.
- No publishing/uploading without Isaac.
- Magazine vocabulary in user-visible copy; no emojis; hard cuts only,
  no kinetic type.
- Verify pasted cross-agent claims against the repo before trusting
  (a parallel session's "10/10 tests pass" was false until the runner
  import was fixed — commit e21573ab4).
