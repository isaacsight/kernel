# Procreate-Aligned Demo Angle

> **Only relevant if the interview is with Procreate, not Suno.** See
> [`../PIVOT_NOTE.md`](../PIVOT_NOTE.md).

If the target is Procreate, the domain shifts from audio generation to
**drawing/illustration**, but the stack pillars (React, edge API, realtime,
storage, testing, deploy) stay identical. What changes is the *canvas
pipeline*, the *input pipeline*, and what the demo *is*.

## Product concept: "Studio"

A browser-based drawing app that demonstrates the same engineering
concerns Procreate solves on native iPad:

1. **Pressure-sensitive drawing** — Apple Pencil (via PointerEvent) on
   Safari iPad, with pressure + tilt + azimuth.
2. **GPU-accelerated canvas** — WebGPU for stroke rendering + compositing,
   WebGL2 fallback.
3. **Layer-based compositing** — up to 32 layers on mid-tier devices,
   streamed-to-storage beyond.
4. **Physics-based brushes** — bristle dynamics, ink spread, simple fluid
   sim for watercolor.
5. **Color-managed** — Display P3 native, convert to sRGB for export.
6. **Realtime collaborative** — two cursors, shared canvas state via CRDT.
7. **Persistent + shareable** — `.studio` file format (zip: SQLite + tile
   images), public share links.
8. **Performance floor** — 120Hz on ProMotion iPad, <16ms input-to-paint
   latency.

This is not trying to compete with Procreate. It's a demo that shows you
*understand* what Procreate solves and could contribute to that codebase.

## What this demo demonstrates

| Skill | Shown via |
|---|---|
| GPU programming | WebGPU compute + render pipelines for brushes |
| Low-latency input | PointerEvent pipeline, prediction, ProMotion tuning |
| Color science | Display P3 working space, ICC conversion on export |
| Binary file formats | `.studio` bundle (zip + SQLite + tile images) |
| Memory architecture | Tile-based layer storage, streaming eviction |
| Physics simulation | Bristle / ink-flow brush simulation in a compute shader |
| Realtime collaboration | CRDT (Yjs) over WebSocket/WebTransport |
| Cross-platform | Works on web, PWA-installable, adapts to touch/mouse/pen |
| Accessibility | Keyboard-only drawing mode, ARIA canvas semantics |
| Full-stack glue | Auth, storage, sharing, CI/CD, tests |

## Stack deltas vs the Suno scaffold

### What stays the same

- React 19, Vite 6, TypeScript strict.
- Hono on Cloudflare Workers for the edge API.
- Supabase for auth + Postgres + Storage.
- Testing: Vitest + Playwright.
- Deploy: Cloudflare Pages + Workers.
- Observability: OTel → Axiom.
- Security model (JWTs, RLS, rate limits).

### What changes

| Domain | Suno (Setlist) | Procreate (Studio) |
|---|---|---|
| Core primitive | Track (audio file) | Canvas (layered image) |
| Generator | Suno API | User input (pen/mouse/touch) |
| Realtime | Generation progress WS | CRDT sync of canvas ops |
| Heavy compute | None client-side | WebGPU brush rendering |
| File format | MP3 / Opus in HLS | `.studio` (SQLite + tile PNGs in zip) |
| Unique tech | WaveSurfer, AudioWorklet | WebGPU, PointerEvent, ICC.js |
| Scale ceiling | Track length (5min) | Canvas resolution × layers |

## Canvas pipeline (detailed)

```
PointerEvent (120Hz if ProMotion)
  ↓
input sampling (dedupe, smooth, predict)
  ↓
stroke builder (Catmull-Rom interpolation)
  ↓
brush simulation (WebGPU compute)
  ├→ stamp-based: texture atlas + transform-feedback
  └→ algorithmic: compute shader (ink flow, bristle)
  ↓
tile renderer (WebGPU render pass)
  ├→ active layer tiles (GPU-resident)
  └→ inactive layers (composited from storage)
  ↓
display composite (premultiplied alpha, P3 color space)
  ↓
present (ProMotion-aware, vsync)
```

### Tile storage

- Layers subdivided into 512x512 tiles.
- Active tiles live in GPU memory (texture array).
- Inactive tiles serialize to IndexedDB (for browser) or `.studio` file
  (for persistence).
- LRU eviction when GPU memory pressure hits.

### Input latency target

- **Input → display**: <16ms p95 on ProMotion iPad.
- Achieved via: touch prediction (CoreMotion-style extrapolation), no
  round-trip through a renderer thread (WebGPU submit on input thread),
  minimal state between PointerEvent and GPU submit.

## Brush physics (detailed)

### Stamp brushes (the simple case)

Shape texture + spacing + rotation + jitter. Convolve along stroke. Fast.
WebGL2 sufficient. Same approach Photoshop has used for 20 years.

### Algorithmic brushes (the interesting case)

#### Bristle brush

Simulate N bristles as particles. Each bristle has position, velocity,
ink level. On stroke:

```
for each bristle:
  target_pos = stroke_point + offset_in_brush_space
  velocity += spring * (target_pos - bristle.pos) - damping * velocity
  bristle.pos += velocity * dt
  ink_deposited = f(bristle.ink, pressure, tilt)
  bristle.ink -= ink_deposited
  deposit(bristle.pos, ink_deposited)
```

Runs as a WebGPU compute shader, 256 bristles × 120Hz = trivial for
modern GPUs.

#### Watercolor

Shallow-water equations on the canvas (height field + velocity field).
Wet edges diffuse, pigment transports with velocity. Expensive but
beautiful. Can run at lower resolution (128x128 per tile) and upsample.

#### Ink / fountain pen

Velocity-responsive width (fast strokes = thin, slow = thick — "ink
pooling"). Azimuth-responsive oval shape for chisel pens.

## Apple Pencil pipeline (web)

```js
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'pen') return;
  strokeStart({
    x: e.clientX, y: e.clientY,
    pressure: e.pressure,      // 0..1
    tiltX: e.tiltX,            // -90..90
    tiltY: e.tiltY,
    twist: e.twist,            // 0..359 (azimuth)
    time: e.timeStamp,
    coalesced: e.getCoalescedEvents(),
    predicted: e.getPredictedEvents(),
  });
});
```

### Key observations

- `getPredictedEvents()` gives forward-looking samples for latency hiding.
- `getCoalescedEvents()` gives interpolated samples at native sampling
  rate (240Hz on iPad Pro) even though PointerEvent fires at 60-120Hz.
- `e.pressure === 0` means "pen not touching" — don't treat as a stroke.
- Palm rejection: on Safari iOS, `pointerType === 'pen'` already excludes
  palm. On desktop with drawing tablets, add finger-reject mode.

## Color science

### Working space

Display P3 all the way through. Canvas element uses:

```js
canvas.getContext('webgpu', { colorSpace: 'display-p3' });
```

Storage: tiles saved as 16-bit-per-channel in `.studio`, 8-bit P3 PNG for
share links.

### Export

- **Copy to clipboard**: system determines color space.
- **Export to sRGB**: ICC convert P3 → sRGB via `colorjs.io` for correct
  gamut compression.
- **Export to PNG 16-bit P3**: when the receiving app supports it.

### Blending

- User operations in linear light (not gamma-corrected pixel space).
- Display compositing uses perceptual OKLab mixing for smooth gradients,
  not naive sRGB.
- Reference: Photoshop 2022+ finally added "linear blending" — we ship
  with it as default.

## Realtime collaboration

Yjs + y-webrtc (peer-to-peer) or y-websocket (server-relayed).

- Canvas ops (`strokeStart`, `strokeAppend`, `strokeEnd`, `layerAdd`) are
  a typed log.
- Each op has `user_id`, `timestamp`, `op_id` (for idempotency).
- Remote ops paint to the shared canvas; local ops are optimistic.
- Awareness channel carries cursor positions + pen state for "see your
  collaborator drawing" UX.

The CRDT-ness matters for: concurrent layer reorders, concurrent layer
name edits, concurrent stroke list appends. Stroke pixel data is
commutative (paint commutes) so no merge needed beyond "apply in order
of op_id".

## `.studio` file format

Proposed:

```
myfile.studio/              (zip archive)
├── manifest.json           { version, canvas_width, canvas_height, ... }
├── thumbnail.png
├── timeline.db             (SQLite — ops log)
├── layers/
│   ├── 0001/
│   │   ├── meta.json       { name, opacity, blend_mode, ... }
│   │   └── tiles/
│   │       ├── 0000_0000.png
│   │       ├── 0000_0001.png
│   │       └── ...
│   └── 0002/
└── assets/
    └── brushes/            (custom brushes embedded)
```

Same model as `.procreate`: SQLite for structured data, image tiles
on disk. This is not a coincidence.

## Performance budget

| Metric | Target | Stretch |
|---|---|---|
| Input → paint latency | 16ms p95 | 8ms p95 |
| Cold start (app → canvas ready) | 800ms | 400ms |
| Layer switch | 100ms | 33ms |
| Save to IndexedDB | 500ms async | 200ms async |
| Export to PNG (2k canvas) | 2s | 600ms |
| Memory ceiling (20-layer 4k canvas) | 1.8 GB | 800 MB (tile streaming) |

## What this demo does NOT try to replicate

- **All of Procreate's brushes** — we ship ~6 well-tuned ones.
- **Animation / Procreate Dreams** — out of scope.
- **3D painting** — out of scope (massive).
- **Reference companion** — out of scope.
- **QuickMenu / gesture system** — out of scope, keyboard shortcuts only.

## Interview narrative

The walk-through:

> "When you open Studio, you see a blank canvas. Tap with an Apple
> Pencil — notice the stroke lags zero frames. That's because we're
> running the brush simulation on the GPU, we consume
> `getPredictedEvents()` to hide the ~16ms input lag, and the WebGPU
> submit happens on the input event thread, not the render thread.
>
> The stroke you're drawing is a compute shader. 256 bristle particles
> per brush, each with position, velocity, and ink. They settle toward
> the pen tip with a spring damping model, so fast strokes show
> scatter. Pigment deposits into a shallow-water height field — that's
> why you see the ink pool and dry.
>
> Under the hood, the canvas is 512x512 tiles. Active tiles are GPU-
> resident; inactive ones stream to IndexedDB. The file format is a
> SQLite DB plus PNG tiles in a zip, same shape as `.procreate`.
>
> Now here's my collaborator joining from another window. We're synced
> through a Yjs CRDT — stroke ops are idempotent and commute, so we
> can draw on top of each other without a merge step. The awareness
> channel gives us their cursor in real time.
>
> The piece I'm proudest of: color management. Canvas is Display P3
> linear-light. Blending happens in OKLab. When you copy to the
> clipboard, the system converts correctly based on the receiver's
> capabilities. On an iPad with a wide-gamut display, you see the
> real colors. On an 8-bit sRGB monitor, we gamut-compress."

Then a minute on tradeoffs and what I'd do with more time.

## What you should be able to answer

- Why WebGPU over WebGL2? (Compute shaders, explicit command buffers,
  better multi-pass pipelines.)
- Why Yjs over a bespoke sync layer? (Battle-tested CRDT, awareness
  protocol included, fits the ops-log shape of drawing.)
- Why not Flutter / native? (Web demo reaches more reviewers; WebGPU
  closes most of the native perf gap on modern devices; the engineering
  rigor transfers to any platform.)
- How would you add 3D? (glTF loader, per-UV painting, baking to
  texture atlases — big scope, reference only.)
- How does Procreate actually do X? (See
  [`../interview/PROCREATE_RESEARCH.md`](../interview/PROCREATE_RESEARCH.md)
  for what's public.)
