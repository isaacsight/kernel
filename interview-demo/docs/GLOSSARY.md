# Glossary

Terms used across this docset. Alphabetical.

---

**AudioWorklet** — Web Audio API feature that runs audio processing
on a dedicated audio thread. Used for low-latency real-time effects
chains (EQ, compressor, reverb).

**BYOK** — Bring Your Own Key. Pattern where users supply their own
API keys rather than the product billing them per-use.

**CDN** — Content Delivery Network. Geographically distributed
caching of static content; Cloudflare in our case.

**CLS** — Cumulative Layout Shift. Web Vital measuring visual
instability during page load. Target < 0.1.

**Coarse tokens** — In audio generation, the lower-codebook tokens
that encode the "semantic" content of music (melody, rhythm)
before fine timbre details.

**Codec** — Encoder/decoder. Neural audio codecs (EnCodec, DAC,
SoundStream) compress audio into discrete tokens for language-model
prediction.

**CRDT** — Conflict-free Replicated Data Type. Data structures that
merge deterministically, enabling multi-writer systems without
centralized coordination. Used in collab features via Yjs.

**CSP** — Content Security Policy. HTTP header restricting what
resources a page can load. Kills most XSS exploit chains.

**CSR** — Client-Side Rendering. Browser downloads JS, renders HTML
in-browser. Our studio app is CSR.

**Durable Object** — Cloudflare primitive. A stateful object with
single-writer semantics, used for WebSocket session state.

**Edge** — Code running on CDN-adjacent servers (Cloudflare Workers,
Vercel Edge Functions). Low-latency from all geographies.

**EnCodec** — Meta's open-source neural audio codec. Basis for
MusicGen and similar models.

**FCP** — First Contentful Paint. Web Vital measuring when first
content appears. Target < 1s.

**Fine tokens** — In audio generation, the higher-codebook tokens
that encode timbre and detail, typically generated after coarse
tokens.

**FLIP** — First, Last, Invert, Play. Animation technique for
smooth layout transitions by computing visual deltas.

**Hono** — Lightweight web framework optimized for edge runtimes
(Workers, Deno, Bun). Used for our edge API.

**HMAC** — Hash-based Message Authentication Code. Used to verify
webhook authenticity.

**INP** — Interaction to Next Paint. Web Vital measuring input
responsiveness. Target < 200ms.

**JWT** — JSON Web Token. Signed claims-bearing token used for
session auth.

**LCP** — Largest Contentful Paint. Web Vital measuring perceived
load speed. Target < 1.8s.

**LOM** — Live Object Model. Ableton Live's API for scripting.
Unrelated to Procreate but appears in parent codebase.

**Metal** — Apple's low-level graphics API. Procreate's renderer
is Metal-based.

**OKLab / OKLCH** — Perceptually-uniform color spaces. Better for
gradients and color mixing than sRGB.

**OpenTelemetry (OTel)** — Vendor-neutral observability standard
for traces, metrics, logs.

**Opus** — Open audio codec. Better quality-per-byte than MP3,
gapless, low-latency.

**P3 (Display P3)** — Wide-gamut color space. iPad Pro displays
are P3; Procreate works in P3.

**Passkey** — WebAuthn credential. Phishing-resistant, device-
bound authentication method replacing passwords.

**Peaks JSON** — Pre-computed waveform min/max data for rendering
audio visualization without decoding the full audio file in-
browser.

**PencilKit** — Apple framework for handling Apple Pencil input.

**ProMotion** — Apple's 120Hz variable-refresh display technology.
iPad Pro, iPhone Pro.

**RLS** — Row-Level Security. Postgres feature for per-row
authorization policies.

**RSC** — React Server Components. React 19 feature allowing
components to render server-side and stream to client.

**RTT** — Round-Trip Time. Network latency for a packet to go
and return.

**RUM** — Real User Monitoring. Performance metrics from actual
browser sessions, not synthetic tests.

**RVQ** — Residual Vector Quantization. Audio codec technique
using stacked codebooks where each learns residual error from
the previous.

**SBOM** — Software Bill of Materials. Manifest of all dependencies
used for supply-chain security.

**SoundStream** — Google's neural audio codec. Foundational work
for audio tokenization.

**SSE** — Server-Sent Events. One-way server→client streaming over
HTTP.

**Suno** — AI music generation company/product. The upstream
generation service in the Setlist demo (or the interview target,
depending on Part 1 interpretation).

**Temporal tile** — Our term for a ~500ms segment of audio
generated/decoded/stored as an independent unit. Analogous to
Procreate's canvas tiles.

**TBDR** — Tile-Based Deferred Rendering. GPU architecture used by
Apple Silicon. Keeps fragment output in on-chip tile memory until
tile is complete.

**TTFB** — Time To First Byte. Latency from request to first byte
of response.

**Valkyrie / ValkyrieM** — Reported internal name for Procreate's
modernized rendering engine, following Silica M.

**View Transitions API** — Browser API for animated transitions
between DOM states or page navigations.

**Waku** — React framework with RSC support, non-Next alternative.

**WCAG** — Web Content Accessibility Guidelines. Standards for
accessible web content. AA is our baseline.

**Web Vitals** — Set of key performance metrics (LCP, CLS, INP,
TTFB, FCP) measuring perceived quality of a web experience.

**WebAuthn** — Web Authentication standard. Basis for passkeys.

**WebGPU** — Modern browser GPU API. Replaces WebGL for
compute-heavy + modern-pipeline use cases.

**WebTransport** — Modern browser transport API built on HTTP/3.
Supports bidirectional streams + unreliable datagrams. WS successor.

**Worker (Cloudflare)** — Serverless function running on Cloudflare's
edge. V8 isolate, no cold-start.

**Wrangler** — Cloudflare's CLI for Workers development +
deployment.

**Yjs** — JS library for CRDT-based collaborative editing.

**Zod / Valibot** — TypeScript schema validation libraries. Zod is
mature; Valibot is smaller/tree-shakeable.
