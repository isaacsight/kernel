# User Stories

Who uses Setlist, what they're trying to do, and why. One user story
per persona per core action. Format: *As X, I want Y so I can Z.*

---

## Personas

### P1 — The Hobbyist

Name the pattern, not the person: someone who plays a little guitar
but never finished a song. Uses GarageBand occasionally. Has 200
voice memos of half-ideas. Wants to hear the song in their head
without spending 80 hours becoming a producer.

**Tech**: MacBook Air, iPhone 13, intermediate digital comfort.
**Time budget**: 20-30 minutes per session, maybe 3 sessions a week.
**Success feeling**: "That's the song I heard in my head."

### P2 — The Prompt Crafter

Spent 2023-2025 on Midjourney and ChatGPT. Has strong prompt intuition.
Treats AI tools as an instrument. Wants fine-grained control and
iteration speed.

**Tech**: 4K monitor, mechanical keyboard, uses keyboard shortcuts
for everything. Power user.
**Time budget**: 2-hour sessions, 5 days a week.
**Success feeling**: "I got it to do exactly what I wanted on the
7th try."

### P3 — The Content Creator

Makes TikToks, podcasts, or YouTube videos. Needs background music
that's original (no copyright strikes), on-brand, and fast to
produce. Music is a means to an end.

**Tech**: iPhone 15 Pro primarily, laptop secondarily. Videos are
mobile-shot-mobile-edited.
**Time budget**: 10 minutes in a content sprint.
**Success feeling**: "I have a track that fits, I can export it, I'm
back to editing."

### P4 — The Kid in the Back of the Class

14 years old, hasn't bought an instrument. Uses Setlist during
lunch break. Shares links in Discord with friends. Has no money,
uses the free tier.

**Tech**: iPad (possibly school-issued), iPhone, sometimes shared
family Mac.
**Time budget**: 10 minutes between other things.
**Success feeling**: "My friends thought this was real."

### P5 — The Musician-As-Prototyper

Actual musician, has a DAW, knows music theory. Uses Setlist to
quickly prototype ideas before committing to production, or to
generate reference tracks for collaborators.

**Tech**: Studio-grade monitors, a DAW, a controller keyboard.
Setlist is one tool among many.
**Time budget**: 15-minute bursts during other work.
**Success feeling**: "I can send this to my drummer and say 'like
this but faster.'"

---

## Core stories

### First-time generation

- **P1** — "As a hobbyist, I want to type 'slow R&B, sad but not
  lonely, with an electric piano' and get a listenable track, so I
  can finally hear a song I've been carrying in my head for years."
- **P2** — "As a prompt crafter, I want to submit a long detailed
  prompt with BPM, key, instrumentation, and structure tags, and
  iterate quickly on small prompt changes, so I can dial in a
  specific sound."
- **P3** — "As a content creator, I want to generate a 30-second
  loopable track from a prompt like 'travel vlog opener, uplifting,
  no vocals,' so I can drop it into my edit in under 5 minutes."
- **P4** — "As a kid, I want to generate something ridiculous and
  share it in Discord before the bell rings."
- **P5** — "As a musician, I want to generate a reference track I
  can point at and say 'this vibe, but with a shuffle feel,' so I
  can brief my collaborator in 30 seconds."

### Streaming playback during generation

- **P1** — "I want to hear the song *while* it's generating, not
  after 45 seconds of waiting, so I know early if I should cancel."
- **P2** — "I want to know the generation is making progress, not
  stuck, so I don't bail when it's actually working."
- **P3** — "I want to be able to do other work during generation
  without babysitting a spinner."

### Cancelling a generation

- **P2** — "As a prompt crafter, I want to cancel a bad generation
  at 15% and try a different prompt, so I don't waste another 30
  seconds."
- **P3** — "I want to cancel if I realize the prompt was wrong, so
  my quota doesn't get burned."

### Editing a track title / tags

- **P1** — "I want to rename my tracks something I'll recognize
  later, so my library isn't a wall of 'Untitled.'"
- **P5** — "I want to tag tracks by intended use ('for the bridge,'
  'rejected, bass too loud'), so I can find them in context."

### Playlists

- **P1** — "I want to group related tracks, so I can hear my
  'sad songs that don't quite work yet' together."
- **P3** — "I want to organize tracks by client or by video, so I
  don't reuse them across projects."
- **P5** — "I want a playlist per project, so I can share a
  reference set with a collaborator."

### Share link

- **P1** — "I want to send a link in iMessage so my partner can
  hear what I made, without them having to sign up for an account."
- **P4** — "I want to drop a link in Discord and see what my friends
  think in the next 10 minutes."
- **P3** — "I want to share a track with a client for approval
  before I use it, so I don't redo the edit if they veto."
- **P5** — "I want to share a draft with a collaborator, timestamp-
  coded, with the prompt visible, so they understand my intent."

### Revoke share link

- **P3** — "After the client approves and I've used the track, I
  want to revoke the link so it's not floating around."
- **P1** — "I want to revoke a link I sent by mistake, so an old
  draft doesn't embarrass me."

### Regenerate a section (P1 feature)

- **P2** — "I want to pick 15 seconds of the track and regenerate
  just that, with a new prompt, so I can fix the boring bridge
  without losing the good chorus."
- **P5** — "I want to swap out the chorus for something more
  energetic, while keeping the verse I like."

### Library navigation at scale

- **P2** — "After 200 generations, I want to find the one from last
  Tuesday with 'Rhodes piano' in the prompt, so I can pick up where
  I left off."
- **P5** — "I want to filter by BPM, so I can find tracks that fit
  a specific tempo I'm working in."

### Offline / reconnect

- **P4** — "When the school wifi flakes out, I want my in-progress
  work to still be there when it comes back, so I don't lose my
  session."
- **P1** — "When I close my laptop mid-generation and reopen
  later, I want the generation to still be there (or have finished),
  so I don't have to remember what I was doing."

### Error recovery

- **P3** — "If generation fails, I want to know *why* (did Suno
  reject my prompt? did my internet drop?) so I know whether to try
  again or fix something."
- **P1** — "If a generation fails, I want a one-click retry without
  re-typing my prompt."

### Keyboard shortcuts

- **P2** — "I want every action to have a keyboard shortcut, so I
  can work at speed without touching the mouse."

### Accessibility (screen reader)

- **Persona not covered above** — a user who is blind. "As a blind
  user, I want to know my generation progress via live region
  announcements, so I know when my track is ready without having to
  refresh."

### Mobile flow

- **P3** — "I want to generate on my phone at the coffee shop and
  have the track sync to my laptop when I get back to the studio,
  so I don't break my flow."
- **P4** — "I want to use the product on my phone in bed, because
  that's where I think of song ideas."

---

## Anti-stories (who we're explicitly not building for in v1)

- **The commercial producer with a release schedule** — needs DAW,
  stems, mix/master, distribution. We don't serve them; they have
  better tools.
- **The academic researcher** — wants model internals, parameter
  exposure, reproducibility tooling beyond what we plan. Different
  product.
- **The enterprise soundtrack licensor** — wants team accounts,
  SSO, audit logs, legal indemnification. Different sale.
- **The bad actor** — wants to clone voices, generate copyrighted
  content, flood the system with spam generations. We actively
  design against them.

---

## What makes this list useful

Every feature in [`FEATURES.md`](./FEATURES.md) should map to at
least one story above. If a feature doesn't have a user story, it's
either:

- Missing a user story (we should write one, or)
- Not actually wanted by anyone (we should cut it)

Every user story should be discoverable in the product surface. A
story we can't realize because of UX gaps is a feature gap.

A user story without a persona is an engineering request in
disguise. Push back.
