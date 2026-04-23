# Demo Script — Live Walkthrough

5-minute narrative for the technical interview. Rehearse 3x. Have a
screen recording as backup in case live demo fails.

---

## Pre-flight checklist (30 min before)

- [ ] `setlist.app` loads on phone + laptop
- [ ] Demo account signed in on both
- [ ] Prompts memorized (below)
- [ ] Network: hotspot backup ready
- [ ] Screen recording of happy path saved locally as `/demo-backup.mp4`
- [ ] Code editor open to ARCHITECTURE.md + TOKENIZATION.md for Q&A
- [ ] Water, laptop charger, timer visible

---

## The script

### 0:00 — Setup (15 seconds)

> "I built a small end-to-end product to show how I think about this
> problem space. It's called **Setlist**. It takes a text prompt and
> generates music, streams it live, and lets you organize and share
> tracks. Let me walk you through the happy path, then I'll show you
> what's interesting under the hood."

Open the tab. Studio page is pre-loaded, empty state visible.

### 0:15 — First generation (60 seconds)

> "New user — empty studio. The prompt input is the hero. I'll give
> it something."

Type in the prompt input:

```
lo-fi piano, 72 BPM, rain on the window, ambient pads, 90 seconds
```

Hit Generate. Pause to let the transition happen visibly.

> "A few things happening at once. The prompt slid up — it's now a
> label. The waveform canvas appeared. Under the hood, I POST'd to
> `/generate`, which returns a `generation_id` within 200ms. Then I
> opened a WebSocket and subscribed to that ID."

Waveform begins filling.

> "The fill you're seeing is real. Each segment is ~500ms of audio,
> decoded and pushed over the WS as it's ready. The server broadcasts
> progress via Postgres `NOTIFY`, the WS handler fans it out to my
> session, and here we are."

At ~5s in, audio should start playing. Let it play.

> "That's the contract I set — prompt to first sound under 5 seconds.
> You can hear it playing while the rest of the track is still
> generating."

### 1:15 — Track interactions (45 seconds)

Once the track completes (~30s total), scrub to mid-track.

> "Scrubbing works on mobile or with a keyboard — space for play/pause,
> arrows for seek. The waveform is WaveSurfer driven by a peaks JSON
> I pre-compute server-side, so the waveform draws in under 100ms
> even for long tracks."

Click inline title edit, rename to "rainy window demo."

> "Inline title edit. This is an optimistic update — the server round
> trip finishes later, but the UI is instant. If the server rejects,
> we roll back with a shimmer so the user sees the rollback."

### 2:00 — Playlist + share (60 seconds)

Click "Add to playlist" → "+ New playlist" → name "demo."

Open playlist view. Add 2 more tracks (pre-seeded in account).

> "Playlist. Cover gradient is generated from the tracks' averaged
> spectral signature — it's pretty, but it's also informative. Jazzy
> playlists go blue-warm, drum-heavy ones stamp amber."

Drag to reorder.

> "Reorder uses FLIP animation. The rows part with a spring; the
> dragged row carries a shadow. Keyboard-accessible — space to pick
> up, arrows to move."

Click Share → choose "Discord" label, no expiration, copy URL.

Open URL in incognito window on phone.

> "This is the public view. Server-rendered, no auth, no JavaScript
> required. OG image rendered server-side so it looks right when
> pasted in Discord or Slack. The token is 22 chars — 128 bits of
> entropy, unguessable. Rate-limited on the edge to prevent
> enumeration."

Hit play on the anon view. Audio plays.

### 3:00 — Under the hood (90 seconds)

Switch to a browser tab or slide deck with the architecture diagram.

> "Let me show you the architecture. Two apps: React 19 SPA on
> Cloudflare Pages, Hono edge API on Cloudflare Workers. Postgres +
> Auth on Supabase. Audio on R2. The interesting pieces:

> First — **streaming generation**. Suno's API gives us a job ID and
> fires a webhook when it's done. I didn't want users staring at a
> spinner, so I broke the audio into temporal tiles, decode as they
> arrive, and stream them to the client. It's the same doctrine as
> Procreate's tile-based canvas — atomic, regeneratable, streamable.

> Second — **WebSocket at the edge**. Cloudflare Durable Objects give
> me per-session state without running Redis. Each session is a
> single-writer, so message ordering is guaranteed.

> Third — **design tokens as contract**. Every color, space, and
> motion value lives in a typed tokens package. ESLint forbids raw
> hex in components. Motion has a vocabulary — appear, slide,
> crossfade — so the feel is consistent without per-component
> guesswork."

### 4:30 — Tradeoffs (30 seconds)

> "What I'd change. I shipped CSR; for the public share view I'd
> move to RSC — we'd get better SEO and faster TTFB for viral paths.
> I shipped with WebSocket; for a 2027 stack I'd switch to
> WebTransport — unreliable datagrams for stale-okay progress updates
> and better mobile network handoff.

> What I'd cut if I had half the time: playlists. Just tracks and
> shares is 80% of the emotional hook with 40% of the build."

### 5:00 — Handoff (15 seconds)

> "Code's on GitHub. Happy to walk through any part in depth —
> tokenization, the generation pipeline, the design system,
> security model, whatever's most relevant for the role."

Stop talking. Let them drive.

---

## Timing reality check

| Segment | Target | Real world |
|---|---|---|
| Setup | 0:15 | 0:20 if network is slow |
| First generation | 1:00 | 1:15 if Suno is slow that day |
| Track interactions | 0:45 | as scripted |
| Playlist + share | 1:00 | 1:10 if incognito is janky |
| Under the hood | 1:30 | flexible |
| Tradeoffs | 0:30 | as scripted |
| Handoff | 0:15 | as scripted |
| **Total** | **5:15** | **5:30-6:00** |

Budget 6 minutes. If you're at 5:00 on "Under the hood," cut the
Tradeoffs into Q&A.

---

## Prompts to have ready

Pick one based on the room.

- **Safe** — "lo-fi piano, 72 BPM, rain on the window"
- **Suno-flavored** — "90s Atlanta soul, Rhodes stage piano, chopped
  drums, warm bass, 82 BPM"
- **Procreate-flavored** (if audio demo)— "a brush stroke on paper:
  gentle ambient textures, ink-dripping feel, 60 BPM"
- **Novelty** — "the sound of this interview going well"

Avoid anything that might:
- Trigger content moderation
- Sound like a celebrity voice (even indirectly)
- Require lyrics (multiplies risk)

---

## Backup plan — if live demo fails

If the API is down or the generation stalls:

1. Stay calm. Say: "Looks like we've caught Suno on a slow minute —
   let me pivot to a pre-recorded walkthrough."
2. Open `/demo-backup.mp4` (local file, no network needed).
3. Narrate over it the same way you'd narrate live.
4. Transition to architecture talk *earlier*.

The backup isn't a failure — it's a *signal* that you plan for
failure. Mention that you have it, before you need it:

> "I've got a pre-recorded version if the network gets weird — that
> kind of resilience is part of the product story."

---

## Technical rabbit holes (if they dig)

### "How does streaming generation work?"

Point to [`../docs/TOKENIZATION.md`](../docs/TOKENIZATION.md) +
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) sections 1-2.
Key points:
- Suno generates tokens left-to-right.
- Each ~75 tokens = 1 second of audio.
- Decoder runs on partial sequences.
- WebSocket fans out progress; client buffers 2-3 segments ahead.
- Cancel propagates via `POST /cancel` → Suno cancellation.

### "Why Cloudflare?"

Point to [`../docs/TECH_STACK.md`](../docs/TECH_STACK.md) row 2 of
the backend table, and [`../interview/STACK_QA.md`](./STACK_QA.md) Q2.
Key points:
- Global edge = low TTFB everywhere.
- Workers cold-start ≈ 0.
- Durable Objects give stateful WS.
- R2 free egress.
- Vercel/Lambda cold starts hurt realtime.

### "How would this scale to 100k concurrent generations?"

Point to [`STACK_QA.md`](./STACK_QA.md) Q20.
Key points:
- Rate limit per user at the edge.
- Queue (Cloudflare Queues / Workflows) decouples request from Suno.
- Suno's own quota is the real limit — commercial negotiation.
- UX shows "#324 in line, ETA 2 minutes" — honest.

### "What's your design system approach?"

Point to [`../docs/DESIGN_ENGINEERING.md`](../docs/DESIGN_ENGINEERING.md).
Key points:
- Tokens as a typed contract.
- Aesthetic + function in parallel, reviewed in the same PR.
- Motion vocabulary.
- PR template with 10 aesthetic questions before merge.

### "Accessibility?"

Point to [`../docs/UI_UX.md`](../docs/UI_UX.md) accessibility section.
Key points:
- WCAG 2.2 AA minimum.
- axe-playwright on every E2E.
- Keyboard-only spec.
- Screen reader quarterly manual pass.
- `prefers-reduced-motion` respected, but essential feedback stays.

---

## Vibes to maintain

- Speak like a colleague presenting to colleagues. Not pitching.
- Use first-person plural ("we" when talking about the product, "I"
  when talking about decisions).
- Own the tradeoffs. Never hide a weakness.
- If something doesn't work: "huh, that's new" + move on. Don't
  apologize.
- End with a question or invitation, never a flat statement.

---

## If they ask for the "director's cut"

Extended 15-minute version adds:

- Show the code: `packages/tokens/`, `apps/edge/src/routes/generate.ts`,
  the WebSocket handler, the migration file.
- Show Storybook with all component states.
- Show the tests running locally.
- Show the perf dashboard (Axiom).
- Walk through one PR's review checklist.

Have this prepared. Don't give it unless invited.
