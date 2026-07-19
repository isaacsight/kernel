# WHAT WE MADE v3 — full remake runbook

Director's concept: **"The Little Machine"** — one continuous story instead of
twelve vignettes. A miniature nocturnal workshop-world; the cube machine is the
protagonist; the red circle/glow is the connective motif; scene 12 reframes
scene 1 (the whole world was one thought). Style: cinematic macro paper-craft
noir — volumetric light, deep shadow, shallow depth of field, one warm source.

Narrator: ALREADY RECORDED — ElevenLabs George (premium, direct API),
57.7s, at `output/audio/d15186d9-86da-4495-87ae-749fb7bcb139.mp3`.

## 0. Budget and caps

| Item | Booked (conservative) | Actual (fal bills 720p) |
|---|---|---|
| 12 keyframes, Nano Banana 2 | $0.96 | $0.96 |
| retakes allowance (frames) | ~$0.50 | ~$0.50 |
| 12 clips, Seedance 2.0 image-to-video 720p x 5s | $40.92 | ~$18.20 |
| clip retakes (2-3) | ~$10 | ~$4.50 |
| Palmier cut + type + export | $0 | $0 |
| **Total** | ~$52 booked | **~$24 actual** |

The spend tracker books the CONSERVATIVE price (1080p rate), so the server must
start with a raised daily cap:

```bash
kill $(lsof -ti :5412); cd "/Users/isaachernandez/blog design"
EK=$(textutil -convert txt -stdout "/Users/isaachernandez/Desktop/clAUDE_API/creative.rtf" | grep -oE "sk_[A-Za-z0-9]+" | head -1)
FAL_DAILY_SPEND_LIMIT=60 ELEVENLABS_API_KEY="$EK" node --env-file=.env tools/local-video-server.mjs
```

Every paid call follows the engine protocol: POST the exact body to the
estimate route, take `quoteToken`, resubmit the same body + token with
`Authorization: Bearer $(cat ~/.config/kernel/galley-engine-token)`.

## 1. Keyframes — the twelve shots

Endpoint `fal-ai/nano-banana-2`, `params: {"aspect_ratio":"16:9"}`, $0.08 each.
Prefix EVERY prompt with the style block:

> Cinematic macro photograph of a handcrafted paper-craft diorama. Deep
> ink-blue and ivory paper world lit like film noir: one dramatic warm light
> source, volumetric light beams, deep soft shadows, shallow depth of field
> with soft foreground paper bokeh. Red accent elements glow warmly. Torn
> paper texture with visible fibers, anamorphic 16:9 composition, moody,
> premium, arresting. No text, no lettering, no words.

Scene prompts (append as `Scene: ...`):

1. hundreds of small glowing red paper thought-bubbles suspended on threads like lanterns above a sleeping paper town at night, rooftops in silhouette below
2. beneath a night sky, one warmly lit workshop window in a dark paper building: inside, a small boxy cube machine with a glowing window face waits at a workbench like a patient shopkeeper
3. a human paper silhouette leans into frame whispering into a large paper gramophone horn; a thin glowing red thread of words travels down the horn's tube toward a small machine below
4. interior of a tiny machine: a miniature paper director figure at a glowing light table, sharpening a red pencil with curling shavings, storyboard cards pinned in the surrounding darkness
5. a paper workshop wall swung open revealing an infinite backstage of paper film cameras on scaffolding towers receding into darkness, spotlights waking up one by one down the line
6. total darkness on a stage: one theatrical spotlight cone through haze, a small paper ticket descending on a glowing red thread into the light, silhouetted cameras waiting all around
7. macro of a human paper hand gently pulling a large red lever downward; behind it rows of spotlights dimming softly to darkness, calm and consequence-free
8. a glowing red chute delivering a small silver film canister into two open cupped paper hands, warm light on the hands, dark workshop behind
9. the small cube machine facing the camera directly, holding up a paper megaphone; a glowing red ribbon shaped like a soundwave spirals out of the megaphone toward the viewer
10. the human paper figure and the small cube machine sitting side by side on a workshop step at night: a wrapped sandwich beside the human, a tiny glowing red spark beside the machine, a film canister between them
11. wide shot with long warm shadows: the human figure pointing toward a distant paper horizon while the small cube machine marches ahead carrying a film canister strapped to its back, red arrow glow on the floor
12. an entire miniature paper workshop-city folding inward into one glowing red thought-bubble drifting down toward a person asleep at a desk, the bubble the only light, wide pull-back framing

REVIEW GATE: look at all 12 before animating. Retake for: machine character
consistency (cube + glowing window + red dot, scenes 2/9/10/11), one clear red
focal point per frame, no accidental text. Frames are cheap; clips are not.

## 2. Motion — twelve clips

Endpoint `bytedance/seedance-2.0/image-to-video`, `imageUrl` = each keyframe's
`sourceUrl` (the fal-hosted copy from the job status), `durationSeconds: 5`,
`params: {"resolution":"720p","duration":5}`. Warm the catalog first
(`GET /v1/catalog?category=image-to-video`) or estimates return null.

Motion directions — minimal, anti-warble; append to every prompt:
"Flat paper stop-motion aesthetic, keep every shape crisp and unchanged."

1. lantern-bubbles sway gently on their threads at different phases; slow drift upward through them
2. the machine's window glows brighter once like a breath; slow push toward the workshop window
3. the red thread of words flows down the horn in one continuous motion; figure holds still
4. pencil shavings curl and fall; the light table flickers softly; slow push-in
5. spotlights wake one by one down the receding line; slow lateral dolly
6. the ticket descends slowly on its thread into the light and settles; haze drifts in the beam
7. the lever pulls down in one smooth motion; the spotlights fade in sequence; then stillness
8. the canister rolls down the chute into the hands, which close gently around it
9. the red soundwave ribbon spirals outward toward the camera, growing; machine steady
10. the machine's spark pulses softly; the human unwraps the sandwich slightly; companionable stillness
11. the machine marches forward with small steps, canister on its back; the pointing figure holds
12. the city folds inward petal by petal into the bubble; the bubble drifts down; slow pull-back

Poll `/v1/videos/jobs/:id` until done; MP4s land in `output/videos/`.
The two known transient fal errors resubmit cleanly — retry once before
diagnosing.

## 3. The cut — Palmier Pro (MCP on 127.0.0.1:19789/mcp)

Open Palmier; session-bind first: `manage_project {action:'open', name:'what-we-made'}`
(or `create` a fresh project `what-we-made-v3`, quality 720p, fps 30).

1. `import_media {source:{path}}` — 12 clips + the George MP3.
2. `add_clips` — George at frame 0 on audio.
3. `get_transcript {granularity:'segments'}` scoped by `clipId` to the NEW
   VO clip — cut map in project frames. Use `granularity:'words'` where a cut
   should land mid-line (the v2 cut split on the word "onto").
4. Place scenes with varied lead-ins: Act I 16 frames before each line,
   Act II 8, Act III 12. Fit long lines with `set_clip_properties`
   speed = 151/targetFrames then `durationFrames` exact.
5. GOTCHAS (all learned the hard way):
   - keyframes are CLIP-RELATIVE frames, rows `[frame,value]` for opacity,
     `[frame,sx,sy]` for scale
   - never `remove_clips` on an embedded-audio partner (link group deletes the
     video) — silence with `set_clip_properties {volume: 0}`
   - `apply_color` `temperature` has an undocumented scale — use only
     documented ranges: contrast 0.5-1.5, blacks -1..1, exposure EV
   - full-length ivory matte (`import_media {source:{matte:{hex:'#FAF9F6'}}}`)
     on the bottom track = every fade breathes to paper, not black.
     For THIS noir cut consider `#1F1E1D` ink instead — fades to darkness
     match the night-world.
   - check the scene track for 1-frame gaps before export
6. Kinetic type (`add_texts`, animations: popIn / wordReveal / typewriter):
   - `WHAT WE MADE` typewriter inside the first 2s (the social hook)
   - `$0.35` popIn on "Thirty-five cents, it says"
   - `SAY NO.` wordPop on line 7, `YOURS.` popIn on the closer
   - colophon card: `twelve shots · one voice · rendered for ~$50 — owned outright`
   - EB Garamond for editorial lines, Courier Prime for numbers; ink #1F1E1D
     on light, ivory #FAF9F6 on dark
7. Camera: 3% scale pushes on the stillest scenes, pull-back on 12 —
   clip-relative scale keyframes.
8. `export_project {mode:'video', outputPath:'.../output/what-we-made-v3.mp4'}` —
   verify with ffprobe + extract 4-5 QC frames before calling it done.

## 4. Director builds out Palmier (the "build-out" track)

Palmier is scriptable enough to grow a reusable house toolkit — each of these
is a saved script/skill the canvas or any agent can call:

- **auto-cut-to-VO**: the transcript→lead-in→speed-fit algorithm from step 3/4
  as one function (it is already proven; it cut v2 in one pass)
- **house grade presets**: safe-range `apply_color` recipes (paper-noir, ivory
  editorial) applied per act
- **type kit**: `add_texts` presets for hook title / price pop / colophon in
  house fonts
- **QC pass**: gap check + duration check + frame extraction, run before every
  export
- Palmier's own `generate_*`/`upscale_media` tools bill the Palmier
  subscription (`canGenerate: true`) — decide deliberately per use; fal remains
  the default renderer.

## 5. Ship

ffprobe duration ≈ 60s, spot-check frames, then deliver + append the ledger to
SCRATCHPAD.md and commit. Optional: 9:16 vertical recut for social — same
media, `set_project_settings {aspectRatio:'9:16'}` on a duplicated timeline,
reframe with `set_clip_properties transform`.
