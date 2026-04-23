# Non-Goals

What Setlist is deliberately **not**. Written down so scope creep has
something to bounce off in reviews.

Rule: if a feature request contradicts this doc, either the feature
needs re-framing or the doc needs updating. Never silently ignore.

---

## 1. Setlist is not a DAW

- No MIDI sequencing.
- No piano roll.
- No multi-track arrangement.
- No automation curves on arbitrary parameters.
- No plugin hosting (VST, AU).

**Why**: DAWs are Ableton, Logic, FL Studio. Setlist is a
*generation* product. Bolting DAW features on dilutes the thesis
and bloats the surface.

**What we do instead**: segment regeneration (P1) is the closest
we get. "Replace these 10 seconds with a new prompt" is not DAW
editing; it's editing at the generation layer.

---

## 2. Setlist is not a music streaming service

- No curated radio.
- No algorithmic "for you" recommendations across users' content.
- No paid subscription to listen to others' music.
- No artist pages beyond share-link attribution.

**Why**: Spotify / Apple Music / SoundCloud already exist. Their
value is catalog + recommendation; ours is creation + private
library + simple sharing.

**What we do instead**: share links are manual, creator-initiated,
revocable. Public playlists (if any) are personal artifacts, not
feed content.

---

## 3. Setlist is not a social network

- No follow graph.
- No feed.
- No likes, comments, or reactions in the app.
- No user discovery.
- No in-app messaging.

**Why**: Building a social layer is its own company. Adding "lite"
social features makes a confused product.

**What we do instead**: share links work everywhere users *already
are* social (Discord, Twitter, iMessage). We don't reinvent those
tools.

---

## 4. Setlist is not a distributor

- No Spotify/Apple Music upload pipeline.
- No royalty collection.
- No rights clearance.
- No ISRC assignment.
- No PRO registration.

**Why**: DistroKid, CD Baby, TuneCore exist. Music distribution is
a legal and operational problem distinct from music creation.

**What we do instead**: export (P1) gives the user the file; what
they do with it is up to them. We keep the file format legible
(`.setlist`, WAV, MP3) so it works with any distributor.

---

## 5. Setlist is not a voice cloning tool

- No uploading voice samples to generate in someone's voice.
- No "sounds like [artist]" prompts (Suno's own policy; we enforce
  it at our layer too).
- No speaker-conditioning APIs.

**Why**: The ethical minefield is real, the legal minefield is
realer, and the creative upside of voice cloning is mostly
unlocked by ethical alternatives.

**What we do instead**: our content moderation pipeline pre-screens
prompts for voice-clone intent. Violating prompts are rejected with
a neutral error (no "cannot clone voice" signal that enables
iteration toward evasion).

---

## 6. Setlist is not a mobile-first product (v1)

- Touch-adapted, responsive — yes. See
  [`../docs/UI_UX.md`](../docs/UI_UX.md).
- Native iOS / Android app — no, not in v1.
- Installable PWA — P1 stretch.

**Why**: Desktop web is faster to build, faster to iterate, lets us
showcase the full stack without store review delays. PWA gets us
80% of "native" for 20% of the work if/when we want it.

**What we do instead**: responsive web that works at 320px, with
touch-sized hit targets, swipe gestures on row actions, full
keyboard parity between desktop and external iPad keyboards.

---

## 7. Setlist is not multi-tenant / enterprise

- No team accounts in v1.
- No role-based access control beyond owner.
- No SSO (SAML, Okta).
- No audit logs visible to customers.

**Why**: Enterprise features are a different buyer, different sale
cycle, different support burden.

**What we do instead**: solid individual product. Team features are
a P2 moonshot once we have scale.

---

## 8. Setlist is not a content marketplace

- No selling prompts.
- No selling finished tracks.
- No revenue share.

**Why**: Creator marketplace is a platform play. Different design
requirements (escrow, disputes, moderation, payments), different
legal exposure, different unit economics.

**What we do instead**: keep the product focused on creation and
light sharing. A marketplace could be a P2 or a separate product.

---

## 9. Setlist is not a lyrics-only product

- No "write me a song" without audio.
- No pure text output.

**Why**: The value is the *sound*. Text is a commodity.

**What we do instead**: lyrics are a *parameter* of generation (P1
feature), visible + editable alongside the audio. First-class,
never standalone.

---

## 10. Setlist is not a real-time jam product

- No live multi-user performance.
- No WebRTC audio streaming.
- No shared playhead for listen-parties in v1.

**Why**: Real-time audio collaboration is a whole product surface
(see: Endlesss, Listen Together in Apple Music, SharePlay). Big
scope, distinct thesis.

**What we do instead**: collaborative *playlists* (P1) give the
social-creation feel at the right scope. Real-time playback is a
P2 moonshot.

---

## 11. Setlist does not train on user content

- Our product doesn't train any model.
- User-generated tracks stay in their account.
- Suno's own training policies are Suno's to disclose; we pass
  through what they disclose, we don't add anything.

**Why**: Trust is product. Users should know their prompts and
generations aren't leaking into future models.

**What we do instead**: privacy policy says this plainly. Export
tool (P1) gives users their data on demand.

---

## 12. Setlist does not optimize for engagement metrics

- No "you haven't created anything in 3 days!" push notifications.
- No streaks, no gamification.
- No retention-baiting flows.

**Why**: Creative tools should disappear when not in use.
Gamification is antithetical to that.

**What we do instead**: email you when a generation finishes (if
you've enabled it). Nothing else.

---

## 13. Setlist does not ship a chatbot UI

- No "Hi, I'm the Setlist Assistant, how can I help?"
- No conversational prompt refinement ("what style of music did you
  mean?").

**Why**: A text box *is* the interface. Wrapping it in a chat
persona adds friction and fakes helpfulness.

**What we do instead**: well-chosen placeholder, suggested prompts
for cold starts, learned suggestions from history. No persona.

---

## 14. Setlist does not support every audio format natively

- In v1: MP3 playback only.
- WAV on export.
- FLAC, AIFF, OGG — no.

**Why**: Each format is a codec support burden. Users who need
FLAC are also users who have desktop tools to convert.

**What we do instead**: document the formats we support, export MP3
and WAV, point to ffmpeg for the rest.

---

## 15. Setlist is not a generative music *research tool*

- No exposed model parameters (temperature, top-p, CFG scale).
- No prompt-embedding manipulation.
- No direct token-level editing.

**Why**: The audience is creators, not researchers. Research tooling
is a separate product shape (HuggingFace Spaces, ComfyUI for music).

**What we do instead**: expose the parameters that map to *creative*
controls (style, BPM, duration, structure). Hide the rest.

---

## The re-evaluate triggers

Non-goals are not permanent. They're re-evaluated when:

1. **The product changes** (we pivot to enterprise → team features
   move from non-goal to roadmap).
2. **A user segment demands it** (persistent feedback from 30%+ of
   users → re-examine the thesis).
3. **The cost of the alternative changes** (Opus is cheap to support
   in 2027 → add FLAC too maybe).
4. **A competitor moves the floor** (every peer ships social → we
   either commit to our non-goal or concede).

Re-evaluation goes through the same pair-spec process as any other
feature. No silent creep.
