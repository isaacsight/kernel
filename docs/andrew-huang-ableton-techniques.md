# Andrew Huang — Ableton Production Techniques
## Knowledge Reference (from video transcripts)

**Creator:** Andrew Huang — Toronto-based musician/producer, one of the largest
music educators on YouTube (300M+ views, 2,000+ released songs)
**Channel:** https://www.youtube.com/@andrewhuang
**Channel Focus:** Sound design, sampling, experimental production, genre
challenges ("Four Producers Flip the Same Sample"), full song walkthroughs, gear,
modular, music theory. Broad — not a pure Ableton-tutorial channel.
**Tools of his own:** *Flip* (sampler app), Monthly production course
(learnmonthly.com/andrew).

> Sections below were captured from actual video transcripts (pulled via `yt-dlp`,
> `en-orig` caption track — see [[reference_youtube_transcripts]] / the Side Brain
> doc footer for the method). This supersedes the earlier SEED version of this doc.

---

## 1. 10 Uncommon Production Techniques

**Video:** https://www.youtube.com/watch?v=FasXmoUm8gc
**Source album:** *Ganglia* (most techniques demoed from this record)

### Key Techniques
- **Pitch quantization / melodic randomization** — Instead of quantizing *time*,
  quantize *pitch*. Two ways: (a) Ableton's **Scale** MIDI effect — remap incoming
  notes (x-axis) to chosen output notes (y-axis), e.g. force everything to C except
  B→D; great with an arpeggiator. (b) Ableton's **Random** MIDI device — set chance,
  number of choices, and a (numbered) scale, then jam by ear until something clicks.
  He fed a clip of just C's through Random into Phase Plant and got a diminished
  flavor.
- **Capture the random performance** — Once you like the random output, make a new
  MIDI track, set its **input to the previous MIDI track**, and record to bake the
  actual note data. *Bonus:* crank BPM to max to record the pass instantly. Then
  hand-edit notes to turn happy accidents into deliberate phrases. (His "no theory
  needed / theory players get out of their habits" pitch.)
- **Heavily-modulated drum FX layer** — Run drums through Erosion (stock) + biome
  (Unfiltered Audio, has built-in modulators) + bitspeek (Sonic Charge), with most
  params modulated hard by the **Max for Live LFO**. Layer this glitchy version on
  top of normal, consistent drums to keep things alive.
- **"Wire skip" — keep time with a modulated FX chain on a send** — For a sparse
  section with no timekeeper, send a bell melody into a long, hand-automated effects
  chain to generate rhythmic pulse: Transient Master (attack) → Auto Filter
  (freq+res drawn by hand, then **Simplify Envelope**) → bit reduction → EQ → Delay
  (16ths) → second Auto Filter (different modulation) + Auto Pan (chop to 16ths) →
  OTT (lift detail) → Auto Pan (swirl) → Valhalla Delay → vintage verb.
- **Quantize "random"/recorded audio (warp quantize)** — Record a rhythmic
  performance (he used an autoharp tuned to an open chord, struck rhythmically),
  then warp it: highlight all → **Cmd+Shift+U** (quantize menu) → 1/16, then nudge
  individual transients. Explore warp modes + clip loop playback modes (loop fwd,
  fwd/back, play-once) and the decay number — "a whole world to explore."
- **Many sends, each a different time-based effect, each used for one moment** — Set
  up several return tracks with different delays/reverbs (or the same plugin at very
  different settings): stock Reverb, Grain Delay (+chain), Waves H-Delay, Valhalla
  Delay, Echo. **Automate each send to appear for only one or two moments** in the
  song. Modern DAWs let an effect do one thing for one moment.
- **Drums as triggers (audio → MIDI accents)** — Accent drum hits with sampled
  snippets (he sampled TED Talks). Ctrl-click a drum track → **Convert Drums to New
  MIDI Track** (generates kick/snare/hat MIDI from the audio), keep the hits you
  want, point them at slices of the sample, and run a **Random** device so different
  slices fire in time with the drums.
- **Follow Actions + master-tempo automation for generative form** — Slice a chord
  sample and a drum loop into clips, select them, set Launch → **Follow Actions →
  "Any"** so clips jump around randomly. Then **hand-automate the master tempo**
  (start at max, bring down) so the piece evolves from a buzzy tone into something
  musical.
- **Odd-length sequence + randomized trigger rhythm** _(modular; has in-box version)_
  — A fixed odd-step sequence (Moog Mother-32, 13/17 steps) triggered by a *random*
  rhythm so it advances one step per trigger and never repeats. **In Ableton:** run
  an odd-numbered (5/6/9-step) arpeggio/sequence at a constant rate over 4/4 so it
  phases in and out, creating syncopation under the chords.
- **Modulated rhythm timing + pitch drift** _(modular; Pamela's New Workout)_ — CV
  modulates the *timing* of hat/percussion rhythms while another signal modulates
  *sample pitch* randomly, so they drift on/off grid as a textural fill between
  grid-anchored kick/snare. Trigger rhythm *changes* on a regular interval (e.g.
  every quarter note) — "just the right amount of crazy and random."

### Ableton Workflows
- Scale / Random MIDI devices → route track-to-track → record to bake note data
- Max for Live LFO modulating multiple FX params; Simplify Envelope on hand-drawn automation
- Warp + Cmd+Shift+U quantize on recorded audio; warp playback modes
- Per-moment send automation across many differentiated return tracks
- Convert Drums to New MIDI Track → Random → sample-slice triggering
- Follow Actions "Any" + master-tempo automation for generative pieces

### Tools & Devices
- Stock: Scale, Random, Auto Filter, Auto Pan, Grain Delay, Echo, Reverb, Erosion,
  Convert Drums to New MIDI Track, Follow Actions, Warp
- Max for Live: LFO
- 3rd-party: biome (Unfiltered Audio), bitspeek (Sonic Charge), OTT, Valhalla Delay,
  Waves H-Delay, Phase Plant
- Hardware (optional): Moog Mother-32, Pamela's New Workout

### Relevance to kbot / beat production
**High.** "Drums as triggers," "quantize random audio," per-moment send automation,
and the Scale/Random→capture loop all map onto kbot's clip/automation/MIDI tooling
and are strong candidates for extension commands.

---

## 2. Sampling Techniques (343 Labs masterclass clip)

**Video:** https://www.youtube.com/watch?v=C8TLhq7VFvY
*(Short posted clip — the full philosophy in ~500 words.)*

### Key Techniques
- **Basic toolset, big results** — Most of his sampling is just cutting & pasting,
  a couple of ways to handle volume, pitch shifting, then standard compression /
  reverb / EQ, with occasional "spicier" extras. The craft is in selection, not
  exotic processing.
- **"Make a lot out of a little" / subtract don't add** — Think about the whole
  frequency spectrum and take *away* what you don't need. He'll use half a second of
  a 30-second recording, or keep only the treble of a noisy source.
- **Found-sound soundtrack (Banff trip)** — Built a banging track from helicopter,
  sled dogs, and skiing recordings + some stock Ableton drums.
- **Dog-breath hi-hats** — Chop dog breaths into tiny pieces and **remove the low
  end**; a short, choppy, pitch-less treble sound *is* a hi-hat. Reframe any sound
  by the role/frequency band it needs to fill.
- **Helicopter-as-cymbal** — Propeller noise, treble only, reads as a drum-machine
  cymbal. Same principle: keep the band that does the job.
- **Volume handling via fades** — Heavy use of Ableton's clip fades for shaping.

### Ableton Workflows
- Cut/paste editing + clip fades for volume; pitch shifting via warp/transpose
- EQ to isolate a frequency band so a found sound takes a drum role
- Stock drums layered under found-sound material

### Tools & Devices
- Ableton clip editing, fades, Warp/transpose, EQ Eight, compression/reverb
- (See his channel for "drum sounds from everyday objects" videos)

### Relevance to kbot / beat production
**Very High** — sampling is the core of kbot's Ableton tool surface
(`ableton_load_sample`, drum-rack building, Splice search). The "reframe any sound
by its frequency role" heuristic is directly encodable.

---

## Cross-cutting themes
- **Controlled randomness** is his throughline: Random device, Follow Actions "Any",
  modulated FX, odd-step sequences. The repeated lesson — *reinforce* random events
  (accent on grid hits, change on regular intervals) so chaos reads as intentional.
- **Capture & commit**: jam with randomness, then record/route it to fixed MIDI or
  audio and hand-edit. Don't leave it live.
- **Subtractive sampling**: most moves are taking away (a slice, a frequency band),
  not adding.

## Still worth transcribing (high kbot value)
- A "Four Producers Flip the Same Sample" episode — arrangement/sound-design divergence
- His "drum sounds from everyday objects" videos (referenced in §2)
- Full 343 Labs masterclass if a complete upload exists (this was a clip)

---

## Sources
- 10 Uncommon Production Techniques (transcript): https://www.youtube.com/watch?v=FasXmoUm8gc
- 343 Labs Sampling clip (transcript): https://www.youtube.com/watch?v=C8TLhq7VFvY
- Ableton blog — Experimental Production Techniques: https://www.ableton.com/en/blog/andrew-huang-experimental-production-techniques/
- Sampleface — 10 Uncommon Production Techniques: https://sampleface.co.uk/andrew-huang-uncommon-production-techniques/

*Captured 2026-06-07 from video transcripts (yt-dlp). Promoted from the earlier SEED version.*
