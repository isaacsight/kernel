# Elevator Pitches

Three versions of the same story. Pick by the time slot you're given.

---

## 30 seconds — "Tell me what you built"

> "Setlist. End-to-end music generation product. Type a prompt, watch
> the waveform fill live, hear the first second of audio under five
> seconds later. Organize tracks into playlists, share via public
> links. Built on React 19, Hono on Cloudflare Workers, Supabase, and
> a streaming WebSocket layer. The interesting part is under the
> hood — I treat audio like Procreate treats canvas: tile-based,
> deterministic, and stored in a legible file format."

Delivery: one breath per sentence. ~85 words.

---

## 2 minutes — "Walk me through it"

> "I built Setlist, a small end-to-end product to show how I approach
> this problem space.
>
> The surface: you sign in with a passkey, type a prompt like 'lo-fi
> piano, 72 BPM, rain on the window.' You hit generate. Within five
> seconds, a waveform starts filling in and the first second of
> audio plays. The rest of the track streams in while you're
> listening. You can scrub, rename, add to a playlist, and share it
> with a public link.
>
> The stack: React 19 with Vite, Hono on Cloudflare Workers, Supabase
> for Postgres + auth + storage, R2 for the audio files. WebSocket
> over a Durable Object handles real-time progress. All typed
> end-to-end with Zod schemas shared between client and server.
>
> The interesting engineering is the generation pipeline. Suno's API
> returns a job ID immediately and fires a webhook when done. But
> that's a cliff — the user stares at a spinner. So I break the audio
> into temporal segments, decode them as they arrive from Suno, and
> stream them to the browser. Each segment is independently stored,
> playable, and regeneratable — same doctrine as Procreate's
> tile-based canvas.
>
> The design system is typed tokens, not Figma screenshots. Every
> feature PR includes both a functional spec and an aesthetic spec —
> they're reviewed together. Motion is a vocabulary, not decoration.
> Latency is an aesthetic budget, not a performance metric.
>
> What I'd change: move the public share view to React Server
> Components for better SEO and TTFB. Switch from WebSocket to
> WebTransport when Cloudflare's server support stabilizes — the
> unreliable-datagram semantics are a better shape for stale-okay
> progress updates.
>
> What I'd build next: segment regeneration, a `.setlist` portable
> file format, and token visualization."

Delivery: ~2 min at conversational pace. Pause between paragraphs.
~290 words.

---

## 5 minutes — "Show me" (live demo)

See [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) — the full choreographed
version with tech rabbit-hole routes.

---

## Alternate framings

For different interviewer types, same content, different emphasis.

### For a product-focused interviewer

> "Setlist is a product thesis, not a technical exercise. I believe
> AI music tools get stuck when they treat generation as a black
> box. I made the black box legible — the user sees the waveform
> filling, the user can regenerate segments, the user owns their
> file format. The engineering choices are downstream of that
> product thesis: streaming architecture, tile-based storage,
> deterministic from seeds. That's the 2-minute summary."

### For a design-focused interviewer

> "I don't believe in the handoff model where engineering builds it
> and design approves it. On this project, the design system is a
> typed contract — every color, space, and motion value lives in
> a tokens package with ESLint enforcement. Every feature PR includes
> an aesthetic spec answering ten questions: what does it look like
> when it's loading, when it fails, when there's nothing, how does
> it move, where's the keyboard shortcut. Those are review gates,
> not nice-to-haves. The result: feature work is 20% slower upfront
> and 40% faster in iteration."

### For a systems/backend-focused interviewer

> "Setlist's backend is Hono on Cloudflare Workers with a Durable
> Object per session for WebSocket state. Postgres via Supabase with
> RLS on every user-owned row — defense in depth alongside edge-
> level ownership checks. The generation pipeline is the hard part:
> Suno's webhook-based API works great for completion notification
> but not for streaming. So the edge API runs a small decode layer
> that pulls audio segments as they're ready and broadcasts via
> Postgres NOTIFY to connected WebSockets. The whole thing targets
> a 5-second prompt-to-first-sound contract, enforced via synthetic
> probes in CI."

### For a research/ML-focused interviewer

> "The thing I find genuinely interesting about Suno and the audio-
> generation space is that tokenization unlocked it. SoundStream,
> EnCodec, DAC — residual vector quantization turns 48kHz audio
> into 300 tokens a second, which makes transformer prediction
> tractable. That same shape — discrete atoms from a continuous
> signal — recurs at every layer of a modern stack: prompt tokens,
> audio tokens, design tokens, auth tokens. I tried to honor that
> in the product architecture. Each generated track is structured
> as temporal segments with manifest metadata, model version, seed.
> So regenerations are reproducible, partial re-decodes are free when
> the decoder improves, and a `.setlist` file is a portable, legible
> research artifact as well as a user asset."

---

## The close — "What would you want to work on?"

Have a clean answer:

> "Three things I'd go deep on at [company]. First, the generation
> UX layer — the bridge between the model and the user where
> engineering becomes felt experience. Second, the reliability and
> cost of the generation pipeline — everything downstream of the
> model call, queueing, retries, observability. Third, the file
> format and portability story — what a user takes away from the
> product and how it persists over model-version churn."

Adapt per company. For Procreate replace with: engine / input /
color / file format. For Suno: generation UX / reliability /
tokenization / portability.

---

## The pause (powerful)

After any pitch, stop talking. Resist filling silence.

The interviewer will either:
- Ask a question (good — you've landed something to discuss).
- Ask for more depth (good — they're engaged).
- Move to the next topic (fine — you delivered efficiently).

Silence after the pitch is the interviewer's processing time. Let
them have it.

---

## If asked "tell me about yourself" (the opener)

Don't give the pitch immediately. Give a ~45-second bio first:

> "I'm a full-stack engineer. Most of my work is in the space where
> design decisions become engineering decisions and vice versa —
> typed design systems, streaming UX, edge architectures. Most
> recently I've been working on [adapt], and in preparation for
> this conversation I built a small end-to-end music-generation
> product to give us something concrete to talk about. Want me to
> walk through that, or should we start somewhere else?"

The *"want me to walk through that"* is the hook. Let them choose
whether to take the demo or redirect.
