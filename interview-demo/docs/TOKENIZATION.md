# The Science of Software Engineering — Procreate Rigor × Suno Tokenization

> The thesis: Procreate's engineering ethos (tile-based, deterministic,
> custom down to the metal) applied to Suno's problem space (audio
> tokenization, streaming generation, generative music UX) is a real and
> defensible engineering stance. This doc spells out what that means
> concretely, so you can talk about it in the interview the way a
> research engineer would.

> Caveat: where this doc describes *internal* implementations of Suno or
> Procreate that aren't publicly documented, it's marked **[inference]**.
> The science is public; the exact production specifics are often not.

---

## Part 1 — What audio tokenization actually is

Modern AI music generation (Suno, Udio, MusicGen, AudioLM, MusicLM) is
built on the same core idea that made GPT work for text: **turn a
continuous signal into discrete tokens, then train a transformer to
predict the next one.**

For text, the tokenizer is BPE (byte-pair encoding). For audio, the
tokenizer is a **neural audio codec** — a small autoencoder trained to
compress audio into discrete codes and reconstruct it faithfully.

### The three codecs that matter

| Codec | Lab | Year | Typical use |
|---|---|---|---|
| **SoundStream** | Google | 2021 | AudioLM, MusicLM |
| **EnCodec** | Meta | 2022 | MusicGen, Bark |
| **DAC** (Descript Audio Codec) | Descript | 2023 | high-fidelity research |

All three use the same core shape:

```
  audio (48 kHz, float32)
       │
       ▼
  ┌─────────────────────┐
  │  encoder (CNN)      │  ~500x downsample
  └─────────┬───────────┘
            ▼
  ┌─────────────────────┐
  │  RVQ                │  Residual Vector Quantization
  │  (N codebooks,      │  N = 4–32, codebook size 1024
  │  1024 codes each)   │
  └─────────┬───────────┘
            ▼
     discrete tokens
     (~50–75 Hz, N codes per frame)
            │
            ▼
  ┌─────────────────────┐
  │  decoder (CNN)      │
  └─────────┬───────────┘
            ▼
      reconstructed audio
```

**Residual Vector Quantization** is the clever bit. Instead of one
giant codebook, you stack N smaller codebooks where codebook k learns
the residual error from codebook k-1. Cheaper training, graceful
quality scaling, streaming-friendly.

### Why this matters

For one second of 48 kHz audio:
- **Raw samples**: 48,000 floats = 192 KB.
- **MP3 at 128kbps**: 16 KB.
- **EnCodec tokens at ~75 Hz × 4 codebooks × 10 bits**: ~375 bytes.
- **…as a transformer sequence**: 75 × 4 = 300 "tokens" per second.

A 2-minute song is ~36,000 tokens — well within a modern transformer's
context window. **That's why Suno exists in 2026 and not 2019.**

---

## Part 2 — How Suno (likely) works [inference]

Suno hasn't published a paper as of this writing. What follows is
inference from the public artifacts (model names like "Bark",
"Chirp" in leaked/deprecated APIs, researcher backgrounds) and from
known music-generation architectures.

### Likely stack

```
  text prompt + lyrics + style tags
         │
         ▼
  ┌──────────────────────────────────┐
  │ Text encoder (T5 or equivalent)  │
  └────────────┬─────────────────────┘
               ▼
  ┌──────────────────────────────────┐
  │ Coarse model (transformer)       │   Predicts "semantic"
  │ → coarse audio tokens            │   tokens: melody, rhythm,
  │   (every ~50 Hz, 2 codebooks)    │   structure
  └────────────┬─────────────────────┘
               ▼
  ┌──────────────────────────────────┐
  │ Fine model (transformer)         │   Predicts remaining
  │ → fine audio tokens              │   codebooks: timbre,
  │   (remaining N–2 codebooks)      │   details, vocals
  └────────────┬─────────────────────┘
               ▼
  ┌──────────────────────────────────┐
  │ Codec decoder (CNN)              │   Tokens → waveform
  └────────────┬─────────────────────┘
               ▼
         generated audio
```

This two-stage (**coarse-then-fine**) approach is the AudioLM /
MusicGen pattern — efficient because the coarse model runs
autoregressively on a small vocabulary, and the fine model can run in
parallel across coarse tokens.

### Streaming generation

Because audio tokens arrive left-to-right, **the first second of
audio can start playing before the last second has generated**. That's
the streaming UX win:

- Generation starts: user hears nothing.
- ~3-5 seconds later: first audio starts streaming. Waveform begins
  drawing.
- Generation continues while playback plays.
- Total time to last sample ≈ 30-60 seconds for a 2-minute track.
- **Time to first sound is what the user feels, not total time.**

The engineering question — "how do you pipeline token generation →
decode → stream → play?" — is the question a Suno interview cares
about.

---

## Part 3 — Procreate's engineering science (what rigor looks like)

Procreate is the native-app counterpoint. Single-platform, no
cross-platform compromise, deeply optimized for one device family. The
engineering doctrine is worth spelling out because it's transferable.

### Doctrine 1: Tile-based everything

The canvas is not one big bitmap. It's a grid of 256×256 or 512×512
tiles. Every operation — stroke rendering, layer compositing,
undo — operates tile-by-tile.

Why it matters:
- **Memory ceiling**: 16K × 16K canvas × 20 layers = way more than
  iPad RAM. Tiles swap to disk; only active tiles live in GPU memory.
- **Dirty-rect updates**: only re-render tiles touched by the stroke.
  Rest of the screen doesn't redraw.
- **Parallelism**: each tile is independent — render them on different
  GPU threads, composite in one pass.

### Doctrine 2: Exploit the GPU architecture literally

Apple GPUs are **TBDR** — Tile-Based Deferred Rendering. They process
the screen in tiles natively. Procreate's tile size maps to the GPU's
tile size. Every fragment shader invocation stays in threadgroup
memory; nothing bleeds to main memory. This is free perf if you design
for it, and a 3× slowdown if you fight it.

### Doctrine 3: Latency is not a budget, it's a contract

**Input-to-paint latency** is the pen-on-paper feel. Target: one frame
at ProMotion (120 Hz) = 8.3 ms. That's a contract with the user's
hand. Every system call, every memory allocation on the input thread,
every Obj-C message pass matters.

How that looks:
- No allocations on the stroke thread (pool everything).
- Pre-computed brush stamps.
- `getPredictedEvents()` from PencilKit to hide input lag.
- Direct Metal submit on the input thread, not marshaled through a
  render queue.

### Doctrine 4: The file format is the source of truth

`.procreate` = zip archive containing a SQLite DB + PNG tile files.
It's just files on disk in known formats. No proprietary binary
container. Anyone can open and verify.

This is a design ethic, not just an implementation detail. **The
persistent state is legible.** Bugs are reproducible because the
file captures everything.

### Doctrine 5: Determinism as a feature

Open a `.procreate` file on iPad 3rd gen and iPad Pro M4 — same image
appears, pixel for pixel. That requires:
- Floating-point reproducibility (Metal guarantees this within GPU
  architectures).
- Deterministic stroke evaluation (spline evaluation order matters).
- Versioned algorithms (brush behavior is tagged to engine version).

Reproducibility is UX — the user trusts that their work will render
the same tomorrow as today.

---

## Part 4 — The synthesis: Procreate rigor applied to Suno

This is the interview thesis. How would you build a Suno-like product
if you brought Procreate's doctrine?

### Synthesis 1: Audio as tiles

Audio tokens arrive in a linear sequence, but for UX they're better
thought of as **temporal tiles**:

```
  Token sequence:   [t0] [t1] [t2] [t3] [t4] ... [t7500]
  Temporal tiles:   ────segment 0────  ─segment 1─ ...
                     (~500ms)           (~500ms)
```

Each segment:
- Generated as a contiguous range of tokens.
- Decoded into ~500ms of audio.
- Rendered into a waveform tile for the UI.
- Persisted to storage independently.

The benefits mirror Procreate's tile doctrine:
- **Dirty-segment updates**: regenerate just the chorus, not the whole
  track.
- **Parallel decode**: each segment decodes independently.
- **Persistent state**: each segment is a file. Restore any mid-state.
- **Editing**: "delete segment 4, regenerate with this new prompt" is
  a surgical operation, not a full re-gen.

Suno's existing "Extend", "Replace section", and "Cover" features
are basically segment-level operations. The architecture is the same.

### Synthesis 2: Token streaming with a latency contract

Procreate's input-to-paint contract ≈ 8ms. Suno's equivalent is
**prompt-to-first-sound**. That's the felt tempo of the product.

Target: **< 5 seconds** from pressing Generate to hearing the first
note.

How you'd engineer to that:
1. Token generation runs on GPU with speculative decoding (generate
   multiple tokens per forward pass, verify, commit).
2. Decoder starts as soon as enough tokens exist for one segment
   (~75 tokens ≈ 1 second at EnCodec rates).
3. Audio streaming starts once the first decoded segment is in
   storage; subsequent segments join the stream as they arrive.
4. Client buffers 2-3 segments ahead for jitter resilience.

Every part of that pipeline has a budget, measurable in milliseconds.
A Suno interview would probe this.

### Synthesis 3: Visualize the tokens, not just the audio

Procreate visualizes every stroke as it's laid down — the user sees
the material being made. Suno has an opportunity here that hasn't
been fully taken: **visualize the token stream**.

Concrete: a second view alongside the waveform that shows a colored
block per coarse token, with color encoding the codebook code. As
generation streams in, blocks appear one at a time. The user sees
the music being thought.

This is:
- Technically free (tokens are already in flight).
- Aesthetically meaningful (makes the AI legible).
- An interview talking point ("I'd expose the model's state to the
  user as a first-class surface").

### Synthesis 4: `.setlist` as a legible file format

A Suno "session" should be a file, in the Procreate sense:

```
my_song.setlist/                (zip archive)
├── manifest.json               version, duration, model_id, seed
├── prompt.txt                  full prompt text
├── lyrics.txt                  aligned lyrics with timestamps
├── tokens/                     one file per segment
│   ├── 0000_coarse.bin         coarse tokens for segment 0
│   ├── 0000_fine.bin
│   ├── 0001_coarse.bin
│   └── ...
├── audio/                      decoded waveforms per segment
│   ├── 0000.opus
│   ├── 0001.opus
│   └── ...
├── waveforms/                  pre-rendered peaks JSON
│   └── 0000.peaks.json
└── history.db                  SQLite: edit history, regens
```

Why this matters:
- **Reproducibility**: same tokens + same decoder version = same
  audio.
- **Editability**: client apps can show per-segment regen UI without
  server roundtrip.
- **Privacy / portability**: user owns their `.setlist` file.
- **Debuggability**: a bad generation is a file you can inspect.
- **Model versioning**: manifest records which model produced which
  segments — critical when the model updates.

This is a genuinely ambitious engineering statement. In the interview,
you can sketch it in 60 seconds and the interviewer will remember it.

### Synthesis 5: Determinism as commercial value

If generations are deterministic given (model_id, seed, prompt,
tokens), then:

- **Share link determinism**: the same `.setlist` URL always plays
  the same song, even if the user's account is deleted, even if the
  model is deprecated (archive the model version).
- **Version control for music**: branch a song, undo a regeneration,
  merge two takes. Git-for-songs isn't a stretch once tokens are the
  atom.
- **Cheap re-render**: if the decoder improves, re-decode existing
  token files at higher quality without regenerating.

---

## Part 5 — Tokens at every layer of the stack

"Tokenization" isn't one thing. A 2027 full-stack engineer thinks
about tokens at every layer:

| Layer | Token | What it represents |
|---|---|---|
| AI model (core) | Audio tokens | Compressed discrete audio (EnCodec etc) |
| AI model (input) | Text tokens | Prompt, lyrics (BPE / SentencePiece) |
| AI model (output) | Logit tokens | Pre-sampling distribution |
| Agent | Tool-call tokens | Structured function invocations |
| Billing | Usage tokens | Unit of cost (per-token pricing) |
| Auth | JWT | Signed identity + claims |
| Auth | Passkey assertion | WebAuthn signed challenge |
| URL | Share token | Opaque random bearer credential |
| Design | Design tokens | Named style primitives |
| Feature flags | Split tokens | Assignment decision per user/session |
| Caching | Cache tags | Invalidation targets |
| Rate limit | Request tokens | Bucket credits |
| CSRF | CSRF token | Same-origin guarantee |
| OAuth | Access / refresh tokens | Delegated access |

The science of tokenization across these layers is the same:
**take a continuous problem, find the right atomic unit, make it
discrete, make it countable, make it composable.**

Interview-answerable: "How do you think about tokenization?" →
"It's the practice of finding the right atom for a problem — audio
frames, UI styles, user identities, cost units — so the system can
reason about it compositionally. Audio tokenization is the same idea
as design tokens: make the continuous legible."

---

## Part 6 — What the "science" actually is

Software engineering as *science* means:

1. **Measure before optimizing.** Latency budgets are numbers, not
   vibes. "Fast enough" is a histogram with a p95 line.
2. **Small atoms, compose everything.** Tokens, tiles, frames —
   pick the primitive; the architecture follows.
3. **Determinism is a choice.** Build for reproducibility when it's
   cheap (seeds, versioning); accept non-determinism when it's
   commercially necessary (temperature in sampling).
4. **Persistence in legible formats.** Files you can open with
   existing tools beat proprietary containers.
5. **Visualize state.** If the user can see the system thinking, the
   system is trustworthy. Procreate shows every stroke; Suno should
   show every token.
6. **Budget in the physical world.** 8ms at 120Hz, 16ms at 60Hz,
   100ms for "instant", 3s for "broken". These aren't opinions,
   they're perceptual facts.
7. **Exploit the platform.** Apple's TBDR GPU wants tiled rendering.
   Modern CPUs want cache-friendly data. Ignore the physical
   machine and you leave 3-10× on the table.
8. **Own the codec.** If the thing you're shipping depends on a
   format (audio, image, file), understand it end-to-end. Don't
   black-box the most important artifact.

---

## Part 7 — Interview talking points

Ten sentences you should be able to say cleanly:

1. "Audio tokenization is the trick that made Suno possible — it turns
   a 48 kHz waveform into ~300 tokens per second, which fits in a
   transformer's context."
2. "The two-stage coarse-fine model is efficient because the coarse
   stage does the hard sequential work at low vocabulary; the fine
   stage parallelizes over time."
3. "Streaming generation is an engineering-layer problem, not a
   model-layer problem — the model generates left-to-right, and the
   decoder can run on partial token sequences."
4. "I'd treat audio like Procreate treats canvas — tile-based, with
   each tile (temporal segment here) independently decodable,
   regeneratable, and storable."
5. "A `.setlist` file should be a zip archive of token files + decoded
   audio + SQLite history — the format Procreate uses, same
   legibility win."
6. "Determinism given (model, seed, prompt, tokens) is a commercial
   asset — it enables share-link reproducibility, versioned edits,
   and cheap quality upgrades."
7. "Token visualization is an underexploited UX frontier — Procreate
   shows every stroke, Suno could show every token."
8. "The latency contract for this product is prompt-to-first-sound,
   and I'd target under 5 seconds as a hard budget."
9. "Tokens are the connective tissue of modern systems — audio, text,
   auth, cost, design — and the discipline is the same: find the
   right atom, make it countable."
10. "Procreate's rigor — tile-based, deterministic, legible files,
    platform-exploiting — is a transferable engineering ethos. It
    belongs in AI music tooling."

---

## Part 8 — What to read (if you have time before the interview)

### Audio tokenization papers
- **SoundStream** (Zeghidour et al., 2021) — foundational neural codec
- **EnCodec** (Défossez et al., 2022) — Meta's open-source codec
- **MusicLM** (Google, 2023) — text-to-music architecture
- **MusicGen** (Meta, 2023) — simpler single-stage version
- **AudioLM** (Google, 2022) — the coarse-fine pattern
- **DAC** (Kumar et al., 2023) — highest-fidelity public codec

### Procreate engineering
- See [`../interview/PROCREATE_RESEARCH.md`](../interview/PROCREATE_RESEARCH.md)
  for what's publicly known (sourced separately).

### Systems background
- **Linear types and capability tokens** (Wadler, 1990) — the
  theoretical backbone of why tokens-as-atoms works.
- **TBDR rendering** (Apple's Metal Best Practices guide) — the GPU
  architecture both Procreate and any WebGPU port should target.

---

## Part 9 — The landing

The interviewer wants to know: **do you see the product past its
surface?**

Suno's surface is a text box and a play button. Beneath it is a
transformer, a neural codec, and an audio pipeline. Procreate's
surface is a canvas and a pen. Beneath it is Metal, a tile engine,
and a file format.

The candidate who can talk about both layers — the product and the
substrate — is the one who gets hired. This doc is the substrate
tour. The demo (Setlist / Studio) is the product tour. Together
they're the answer.
