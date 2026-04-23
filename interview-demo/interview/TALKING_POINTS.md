# Talking Points — One Pager

The twelve things to have internalized before you walk in. If you can
say each of these cleanly in 20 seconds or less, you're ready.

---

## The big three — memorize verbatim

### 1. What you built and why

> "I built Setlist — a small end-to-end music-generation product, to
> show how I'd approach this problem space. Text prompt, streaming
> generation, waveform feedback, playlists, public share links. The
> whole thing hits a 5-second contract from prompt to first sound and
> ships deliberate tradeoffs I'm happy to defend."

### 2. The engineering thesis

> "Procreate's engineering ethos — tile-based, deterministic, legible
> file formats, platform-exploiting — applies directly to AI music
> tooling. Audio tokens are the atoms; temporal segments are the
> tiles; a `.setlist` file should be a zip of tokens and decoded audio
> and edit history, the way a `.procreate` file is. The product wins
> when the substrate is legible to engineers and to users."

### 3. The parallel-tracks principle

> "I treat aesthetic and function as one track, not two. Every feature
> ships with its visual primitive, motion spec, empty state, error
> state, and keyboard shortcut — reviewed in the same PR. A design
> system is a typed contract, not a Figma file. Motion carries
> meaning; latency is an aesthetic budget; silence is a feature."

---

## The middle six — know the shape, improvise the words

### 4. Stack judgment

> "Pragmatic 2026 pick: React 19, Vite, Hono on Workers, Supabase,
> WaveSurfer. 2027 forward: add React Compiler, Drizzle over
> supabase-js for edge queries, Passkeys, Workflows for generation
> pipelines, OTel to Axiom. Migrate when the upgrade changes the
> product, not just the code."

### 5. Realtime architecture

> "WebSocket over a Durable Object for per-session state. Postgres
> `NOTIFY` for fanout up to ~1000 listeners. WebTransport is the
> 2027 migration — unreliable datagrams are the right shape for
> stale-okay progress updates. Everything reconnects; nothing assumes
> the socket stays up."

### 6. Data model

> "Postgres with RLS on every user-owned row. Shares are tokenized
> with revocation + expiry. Positions are floats so reorders don't
> renumber. Soft deletes with a 30-day window. Migrations are
> forward-only and backward-compatible — expand, backfill, contract."

### 7. Performance

> "Bundle budget, network budget, perceptual budget. 80KB initial JS,
> 100ms TTFB, LCP under 1.8s, 55fps on animations, 5s to first sound.
> Enforced in CI via size-limit + Lighthouse CI + Playwright FPS
> probes. A PR that breaks a budget doesn't merge."

### 8. Security

> "Defense in depth. RLS in Postgres + ownership checks in the edge
> API. Passkeys primary, no passwords. Share tokens hashed in DB, so
> a DB leak doesn't expose URLs. CSP enforcing. Secrets in CF
> secrets, never in the bundle. Audit logs on every auth + webhook
> event."

### 9. Accessibility

> "WCAG 2.2 AA minimum. Axe runs on every E2E. Keyboard-only flow
> passes CI. `prefers-reduced-motion` disables decorative motion but
> preserves essential feedback like generation progress. Tested with
> VoiceOver + Safari iOS quarterly."

---

## The last three — frame the story

### 10. What you'd cut

> "If I had half the time: cut playlists. Tracks plus sharing is 80%
> of the emotional hook with 40% of the build. What I'd never cut:
> streaming waveform, accessibility baseline, empty and error states,
> the first-generation micro-celebration."

### 11. What's next

> "Three things I'd build next, in order. Segment regeneration —
> drag a range on the waveform, replace it with a new prompt. A
> `.setlist` file format for portability and version control. Token
> visualization so users can see the model thinking. Each is a 1-3
> day build; each expands the product thesis, not just the surface."

### 12. Why this role

> "Specific to the company: [customize per interview].
>
> - **Suno**: you're making the thing I use when I can't play an
>   instrument but I hear a song in my head. I want to work on the
>   layer between the model and the user, where an engineering
>   decision becomes a felt experience.
> - **Procreate**: you've shown — across 15+ years — that deep,
>   platform-native craft beats cross-platform approximation. I want
>   to work in a place where 'good enough' is a failure mode and
>   where every latency frame is a contract with the user's hand."

---

## Micro-talking-points (bite-sized, for mid-conversation)

Keep these in your back pocket.

- **"Tokens are the connective tissue of modern systems."** Use when
  asked about tokenization, design tokens, auth, or billing.
- **"Latency is an aesthetic budget."** Use when asked about perf,
  UX, or feel.
- **"Motion carries meaning."** Use when asked about animations or
  design.
- **"Defense in depth is cheap."** Use when asked about security
  layering.
- **"Boring deploys."** Use when asked about CI/CD philosophy.
- **"Ship on Fridays."** Use when asked about release cadence —
  paradoxical, memorable, and true.
- **"Strong opinions, weakly held."** Use when asked about your
  decision-making process.
- **"Build for the reader, not the writer."** Use when asked about
  code quality or documentation.
- **"Test behaviors, not implementations."** Use when asked about
  tests.
- **"Break the system for moments that deserve it."** Use when asked
  about design system discipline.

---

## Questions you want them to ask

If the interview doesn't surface these, steer toward them:

1. "How does the streaming generation work?" → audio tokenization
   talk, then temporal-tile doctrine.
2. "What's your design system approach?" → parallel-tracks
   principle, tokens as contract.
3. "How would you scale this?" → per-user rate limit, queue, Suno
   quota as real constraint.
4. "What's the biggest risk?" → Suno API coupling; interface it
   and plan a fallback.
5. "What would you build next?" → the three-thing answer from #11.

---

## Things NOT to say

- "I think..." — too weak. "I'd..." or "I do..."
- "It depends..." without immediately following with the tradeoff.
  Always: "It depends on [specific thing]; if [X] I'd [Y], if [Z] I'd
  [W]."
- "I just..." — minimizing. Drop it.
- "I tried to..." — past-tense uncertainty. Use "I built" or "I
  shipped."
- "Hopefully..." — hope is not a strategy.
- "Obviously..." — nothing is obvious to the interviewer.
- "Trust me..." — makes it sound like something to doubt.
- "Let me be honest with you..." — makes it sound like you weren't
  being honest before.

---

## Things to say

- "Here's what I'd pick, and here's what would change my mind."
- "I built this because..."
- "That's a real tradeoff — here's the one I made."
- "I cut X because Y; if we had time I'd revisit."
- "I haven't measured that — here's what I'd measure."
- "I don't know, but here's how I'd figure it out."
- "Let me show you."

---

## On "I don't know"

If you don't know something, say so. Then show the shape of the
answer you *would* investigate.

Example:

> **Q**: "How does Suno handle long-form generation beyond their
> context window?"
>
> **A**: "I don't know the specifics. The pattern in public research
> is a hierarchical approach — an outer model that plans structure
> (verse, chorus) and an inner model that generates tokens within
> each segment. I'd look at MusicGen's paper and AudioLM's for
> reference architectures. If I were building it, I'd start with
> fixed-length chunks and overlap-add to avoid seams."

That's a 9/10 answer. A 10/10 is knowing. A 0/10 is bluffing.
Bluffing is the only wrong answer.

---

## State of mind

You're not begging for a job. You built something. They're evaluating
if they're good enough to hire you. That's the frame that gets the
job.

Confidence without arrogance:
- Acknowledge what you don't know.
- Own every decision with a tradeoff.
- Ask questions that show you've thought about their product.

If the interview ends and you haven't asked about *their* stack and
*their* hard problems, you've left value on the table. See
[`QUESTIONS_FOR_COMPANY.md`](./QUESTIONS_FOR_COMPANY.md).
