# Procreate Engineering — Research Brief

> **Provenance note**: Two web-research agents attempted to gather
> primary sources for this doc (WWDC talks, Savage Interactive
> engineering posts, conference presentations) and both timed out
> before citations could be assembled. What follows is compiled from
> well-established public knowledge and clearly-flagged inference.
> Before the interview, re-verify anything tagged **[verify]** via
> Savage's site, WWDC, and app-teardown posts. Everything tagged
> **[inference]** is Claude's reasoning from adjacent public facts,
> not a cited claim.

---

## TL;DR — five things to internalize

1. **Procreate is Savage Interactive**, bootstrapped from Hobart,
   Tasmania. iPad-only focus since 2011. Premium one-time purchase,
   no subscription, no VC. Unusual shape in tech.
2. **Custom Metal-based rendering engine** (internally referred to
   in older material as **Silica M**; newer materials reference
   **Valkyrie** / **ValkyrieM** for a rewrite) — replaced the
   original OpenGL-ES renderer when iPad Pro landed with Metal.
3. **Tile-based everything**: canvas, compositing, streaming-to-disk.
   Aligns with Apple GPUs' **TBDR** (Tile-Based Deferred Rendering)
   architecture. Exploiting this is free perf; fighting it is a
   slowdown.
4. **The pencil pipeline is the product**. Procreate's
   near-native Apple Pencil latency feel (target < 1 frame at 120Hz)
   is achieved via `PencilKit` signals + predictive touch + careful
   input-thread discipline.
5. **The `.procreate` file format is a zip** containing a SQLite DB
   plus per-layer PNG tiles — a legibility choice as much as a
   technical one.

---

## Company

**Savage Interactive Pty Ltd** — founded by brothers **James Cuda**
and **Alanna Cuda** in Hobart, Tasmania, Australia. **[verify]**

- First Procreate release: 2011 (iPad original). **[verify]**
- Procreate Pocket (iPhone): launched 2014. **[verify]**
- Procreate Dreams (animation app): launched 2023. **[verify]**
- Pricing: one-time purchase ($12.99 iPad, $4.99 Pocket, $19.99
  Dreams as of early 2025). **[verify — prices may have changed]**
- Team: reported as small-to-medium (under 100) relative to install
  base. Remote-friendly. **[verify]**
- Funding: bootstrapped. No external investors reported in public
  financials. **[verify]**
- Apple Design Award: won multiple times. 2013 ADA for Procreate,
  2014 for Procreate (design excellence), 2022 for Procreate (iPad
  App of the Year). **[verify specific years]**

### Shape of the company

Bootstrapped + Tasmania + iPad-only + no subscription is a
deliberately unusual combination. Engineering implications:
- Runway isn't tied to growth metrics — craft is a defensible
  economic position.
- Platform narrowness (iPad, iOS, visionOS adjacency) allows
  deeper per-device optimization than cross-platform competitors.
- No subscription = no continuous engagement pressure = features
  ship when ready.

These constraints produce the engineering culture. A candidate who
understands this will interview better.

---

## Products

### Procreate (iPad)

The flagship. **[verify current version]** — as of early 2026, the
generation was Procreate 5X with ongoing updates.

Core surface:
- Infinite brushes (user-creatable) on proprietary brush engine
- Layer-based compositing (up to ~16-32 layers depending on canvas
  size and device RAM)
- Animation Assist (frame-based animation inside the canvas app)
- 3D painting (GLB/OBJ models, UV painting)
- Color management (Display P3, ACES, ICC profiles)
- QuickMenu + gestures (two-finger tap, four-finger hold, etc.)

### Procreate Pocket (iPhone)

Subset of Procreate for phone. Different engine builds; shares asset
format but UI is reconceived for one-handed use.

### Procreate Dreams (animation)

Dedicated animation app. Timeline-based, not frame-by-frame-only.
Uses its own tooling but shares the underlying rendering engine
lineage. **[verify]**

---

## Rendering engine

### Silica M → Valkyrie [inference, naming]

- Early Procreate used a Metal-based engine generally referred to as
  **Silica M** in community and app-teardown material. **[verify]**
- Procreate 5 introduced "**Valkyrie**" in some internal and
  developer-facing references as an upgraded / rewritten core. The
  exact scope of rewrite vs. incremental update is not fully public.
  **[verify]**
- **ValkyrieM** appears in some references and may refer to the
  Metal-specific implementation layer. **[verify]**

### What's technically defensible to say

- **Metal-first**. Procreate stopped supporting iOS versions that
  predate Metal; the renderer is not OpenGL-ES anymore.
- **Tile-based rendering** aligned with Apple GPU TBDR. Canvas is
  decomposed into tiles (likely 256x256 or 512x512 — exact size not
  public; **[inference]** based on standard practice and Apple
  guidance).
- **Metal threadgroup memory exploited** for in-tile compositing —
  standard TBDR optimization, keeps fragment output in on-chip
  memory rather than spilling to main RAM.
- **Custom shaders** for brush stamping and compositing — not
  Core Image, not Metal Performance Shaders (MPS) alone. Performance
  demands in-house shader work.

### What's unverified / speculative

- Exact tile dimensions
- Exact layer limit formula (it's published per-canvas but
  device-RAM-dependent; I'd ask in the interview)
- Whether 3D painting runs on a separate render graph or an
  integrated one
- Any ML acceleration (e.g., for stroke smoothing) on the Neural
  Engine — unclear public status

---

## Brush system

### What's public

- Brushes are **procedural** with parameters exposed to users —
  shape, grain, pressure response, tilt response, jitter, streamline,
  spacing, opacity dynamics, wet mix (for watercolor), and dozens
  more.
- Brushes can be **imported/exported** as `.brushset` files
  (essentially bundles with shape textures + parameter JSON). The
  community trades brushsets — a significant cultural artifact.
- **StreamLine** is a user-facing smoothing parameter (name used in
  the app UI) that trades responsiveness for smoothness.
- **Pressure curve** editor exposed to the user, so pressure
  response is per-brush.

### Likely technical architecture [inference]

- **Stamp-based brushes**: a shape texture is blitted along the
  stroke at a configurable spacing. Fast, GPU-friendly. Most
  traditional brushes fall here.
- **Algorithmic brushes** (watercolor, ink, textured pencils):
  involve additional simulation — perhaps wet-edge propagation
  (shallow-water equations) for watercolor, particle-based bristle
  models for dry-media, fluid-like ink spread.
- **Blend modes**: user-selectable per-brush (normal, multiply,
  screen, etc.) — standard Porter-Duff compositing, likely with
  custom modes for the artistic ones.

### What's unverified

- Whether watercolor uses actual fluid simulation or a cheaper
  approximation
- Whether bristle brushes use real particle dynamics
- Whether any brushes run on the Neural Engine for ML-assisted
  behavior

---

## Apple Pencil pipeline

### The latency contract

- Apple's published target for Apple Pencil drawing latency is
  around **9 ms** on ProMotion iPads (Apple Pencil 2 / Apple Pencil
  Pro). **[verify — Apple's published numbers]**
- ProMotion = 120 Hz refresh, so one frame is **8.3 ms**.
- Procreate has been repeatedly cited as near-the-metal on this —
  the tool that makes Apple Pencil feel real-time.

### Techniques used [mostly inference from public Apple guidance]

- **`PencilKit` + `UIKit` integration** for native input. Some
  Procreate features likely use PencilKit primitives.
- **Predicted touches** (`UITouch.getPredictedEvents` / PencilKit
  equivalent) to hide input lag — draw a predicted segment while the
  real touch catches up.
- **Coalesced touches** for sub-pixel precision — each
  reported touch has sub-touches at the input hardware's sample
  rate (240Hz on newer iPads).
- **Input on the main thread, draw immediate**. No marshaling to a
  render queue — the goal is: input → GPU submit in the same run
  loop iteration.
- **No heap allocation on the input path**. Pool everything.

### Pressure, tilt, azimuth

- Apple Pencil reports normalized pressure (0-1 float), altitude
  angle (tilt), azimuth angle (direction). **[verify]**
- All three drive brush parameters per the user's pressure curve.
- Apple Pencil Pro adds barrel-roll and haptic feedback — Procreate
  reportedly supports these. **[verify current support]**

### Palm rejection

- Apple's `pointerType == .pencil` filter handles most cases — palm
  is reported as a separate touch source.
- Procreate may have additional heuristics for edge cases
  (pencil-tip grazing + palm) but specifics aren't public.

---

## Color science

- **Display P3** wide gamut support — iPad Pro displays are P3.
  Procreate works in a P3 working space.
- **sRGB color space** also supported for legacy files.
- **ACES** support for HDR/film workflows. **[verify]**
- **ICC profile-aware** export — correct conversion to destination
  profile (e.g., sRGB for web, AdobeRGB for print). **[verify
  current support]**
- **Linear blending** option for compositing — blending in linear
  light rather than gamma-encoded pixel space, producing more
  natural gradients and color mixing.
- **Color harmony** tools in the UI — complementary, analogous,
  triadic, etc.

Interview insight: color science is an area where Procreate is
likely ahead of industry peers. A candidate who understands
gamma-vs-linear, ICC conversion, and P3 will signal craft.

---

## Canvas & memory

### Limits (all **[verify]**)

- Maximum canvas size: 16,384 × 4,096 px (16K × 4K) on current-gen
  iPad Pros with ≥ 8GB RAM.
- Smaller canvases have more layers available (dynamic cap based on
  device RAM).
- Typical: A4 at 300 DPI ≈ 2480 × 3508 px, can support 50+ layers
  on mid-tier iPads.

### Architecture [inference + standard practice]

- **Tile-based storage**: each layer broken into tiles of some
  fixed size (256 or 512, possibly variable based on canvas size).
- **Active tiles in GPU texture memory**, inactive in CPU RAM, cold
  spilled to disk (document).
- **LRU eviction** when memory pressure hits.
- **Undo history** stored as tile-level deltas (only changed tiles
  are duplicated), making undo cheap for small edits.
- **Streaming during paint**: active stroke writes to tile(s)
  directly in GPU; compositing happens per tile at each refresh.

### `.procreate` file format

- **Zip archive** containing:
  - `Document.archive` (a **NSKeyedArchiver** plist — Apple's binary
    archive format) — contains document metadata, layer structure,
    history if preserved
  - Per-layer image data as **SQLite databases** containing chunked
    image data + tile positions
  - Embedded brush files used in the document
  - Video (time-lapse) files if the "Capture a time-lapse" setting
    was on
- **Reverse-engineered** by several community projects (easy, because
  it's standard containers). **[verify]**

---

## Animation (Procreate Dreams)

### What's public

- Timeline-based, not frame-by-frame-only.
- Onion skinning (past + future frames visible).
- Scene graph with layers that persist across frames.
- Keyframes and tweening.
- Playback at various frame rates (12, 24, 30, 60).

### Architecture [inference]

- Builds on the Procreate rendering engine — same tile system, same
  brush engine, same color management.
- Timeline state managed separately from raster data.
- Likely heavy use of instanced rendering for onion skins (same
  tiles, different timestamps).

---

## Performance

- **120Hz ProMotion awareness** — the render loop synchronizes to
  display refresh.
- **Tile-Based Deferred Rendering** exploitation — fragment output
  stays in tile-local memory, enormous bandwidth savings on big
  canvases.
- **Metal Performance Shaders** (MPS) possibly used for certain
  image processing (Gaussian blur, color conversion). **[verify]**
- **Neural Engine**: unclear if/how used. Speculation: possibly for
  stroke prediction or brush simulation acceleration. **[verify]**

---

## Public talks and interviews

As of this research attempt (2026-04), I couldn't assemble cited
primary sources in the time available. Suggested places to search
before the interview:

- **WWDC** video archive — search "Procreate" or "Savage Interactive"
- **Apple's "Designed by Apple" campaigns** — Procreate has been
  featured
- **The Talk Show (John Gruber podcast)** — James Cuda has appeared
  on it; archival episodes discuss engineering ethos **[verify]**
- **YouTube** — "How Procreate Works" / "Procreate Interview" —
  various indie creator content with dev interviews
- **Savage Interactive's own site** — blog posts, job descriptions
  (engineering job posts often reveal the stack)

---

## Open questions — fair to ask in the interview

These are the things I genuinely couldn't verify. Asking shows
engagement, not ignorance.

1. "Can you tell me about Valkyrie — is it a clean re-architecture
   of the rendering engine or an evolution of Silica M?"
2. "What's the tile size in practice? Does it vary by canvas size,
   or is it fixed?"
3. "How much of the brush engine is in shaders vs. Swift/Obj-C?"
4. "Do you use the Neural Engine for anything in the rendering
   path?"
5. "How do you think about the ceiling on layer count — is it RAM,
   GPU memory, or something else?"
6. "How does the compositing order get preserved when a layer gets
   streamed to disk?"
7. "What's the testing story for pixel-perfect reproducibility
   across iPad generations?"
8. "How do you think about cross-platform now — Pocket is iPhone,
   Dreams is iPad, is there a shared core?"
9. "Do you ever consider Vision Pro / visionOS? What's the
   engineering posture there?"
10. "What's your posture on the web as a creative platform — WebGPU
    is close enough to native that competitors will emerge. Is that
    something you're watching?"

---

## Interview talking points

Ten things a candidate should be able to reference:

1. **"Procreate's engineering ethos is platform-exploiting, not
   platform-abstracting."** Metal-native, TBDR-aware, Pencil-pipeline
   tuned. Transferable to any deep-platform product role.

2. **"The product is the feel."** Input-to-paint latency under
   8.3ms at 120Hz isn't a specification — it's the contract with
   the user's hand.

3. **"Tile-based thinking is a universal doctrine."** Applies to
   canvas, to audio tokens, to anything with a memory ceiling or a
   streaming requirement.

4. **"The file format is a legibility choice."** SQLite + PNG tiles
   in a zip is a statement: your work is yours, no proprietary
   container owns it.

5. **"Bootstrapped + single-platform enables craft."** The economic
   shape of Savage Interactive *causes* the engineering culture.
   Can't copy the culture without copying the shape.

6. **"Brushes are a platform within the product."** The brush engine
   is an API users consume — brushes are files, tradeable, importable.
   Product-as-platform thinking.

7. **"Procreate's pencil latency is a multi-system achievement."**
   Not just "we wrote fast code" — it's PencilKit integration,
   predicted touches, thread discipline, and Metal submit timing
   all working together.

8. **"Color management is where craft shows."** Linear blending,
   P3 working space, ICC conversion on export — the invisible work
   that separates pro from amateur.

9. **"Animation Assist is incremental innovation done right."**
   Added to the raster app without breaking it; became useful
   before it became a separate product (Dreams).

10. **"The web is catching up, and it matters."** WebGPU + wasm +
    PointerEvent with pressure narrows the gap. A principled
    Procreate engineer would be watching — not because web replaces
    native, but because the principles transfer.

---

## What you don't want to do in the interview

- **Pretend to know unverified specifics.** "I read that the tiles
  are 512×512" — if pressed, you're caught. Instead: "Standard
  practice for TBDR engines is tiles around 256-512; I'd guess you
  land in that range for reasons X and Y."
- **Oversell Procreate-on-web as a threat.** It's not. But
  signaling awareness of the competitive landscape is a plus.
- **Critique their not-having-subscriptions business model.** That's
  a decision, not a bug. Respect it.
- **Forget to express genuine admiration.** The team built one of
  the best engineered apps on iPad. Saying so — specifically, with
  details — lands.

---

## Sources (to gather before interview)

Since automated research didn't converge, allocate **30 minutes**
before the interview to:

1. Visit `procreate.com` — read their "Our Story," any engineering
   content, Dreams launch materials.
2. Apple Developer videos — search "Procreate" on
   `developer.apple.com/videos`.
3. YouTube search: "Procreate dev", "Savage Interactive", "Procreate
   engineering", "how procreate works".
4. Read 2-3 recent App Store reviews that critique technical
   aspects — good signal on where users feel seams.
5. Download Procreate if you haven't in a while. Use it. Notice the
   latency. Notice the brush feel. That's the product you're
   interviewing for.

Replace the **[verify]** and **[inference]** tags in this doc with
specific sources as you find them. A citations bar is worth more in
the interview than untethered confidence.

---

## Reflection

The most important thing this doc can't give you: **actual use of
the product**. Spend an hour drawing. Notice every latency wobble,
every brush feel, every moment the tool gets out of your way.
Procreate is a product where engineering excellence manifests in
sensation. Interviewers for a role there want to hire someone who
can feel it, not just describe it.
