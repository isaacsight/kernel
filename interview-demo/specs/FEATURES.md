# Features

Scoped in P0 / P1 / P2. P0 is the demo. P1 is "v2 if asked about
roadmap." P2 is "I'd love to build this one day."

Every feature has both a **functional** and **aesthetic** spec per the
[`docs/DESIGN_ENGINEERING.md`](../docs/DESIGN_ENGINEERING.md) doctrine.

---

## P0 — The demo (must-have)

### F1.1 — Sign in (passkey + magic link)

**Function**: Supabase Auth. Passkey primary, magic-link fallback.
Creates profile row on first sign-in.

**Aesthetic**: S1 Landing from [`../docs/UI_UX.md`](../docs/UI_UX.md).
Single centered card, warm background, display serif. No marketing.

**Done when**:
- User can sign in on mobile + desktop.
- First-time user has a profile row auto-created.
- Sign-out works and invalidates refresh token.

---

### F1.2 — Prompt → generated track

**Function**: `POST /generate` → Suno API → webhook → stored track.
See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) request
lifecycle.

**Aesthetic**: S2 Studio + S3 Generation Progress. Streaming waveform
fill. First-time success triggers the micro-celebration from
[`../docs/MOTION.md`](../docs/MOTION.md) C5.

**Done when**:
- Prompt up to 2000 chars → generation kicks off.
- WebSocket streams progress; UI fills waveform.
- First sound within 5s of generation start (CP2 budget).
- Cancel button works.
- Failure shows recovery UI with partial progress preserved.

---

### F1.3 — Track library

**Function**: User's generated tracks, paginated (cursor), searchable
by title/prompt.

**Aesthetic**: Left-rail navigation or grid view depending on density.
Row hover reveals actions.

**Done when**:
- 500+ tracks load smoothly (virtualized).
- Sort by created (desc/asc), duration, alphabetical.
- Filter by style tag.
- Search by title fuzzy-matches.

---

### F1.4 — Playback

**Function**: HTML5 `<audio>` element controlled by global store.
Waveform scrubbing, transport controls, keyboard shortcuts.

**Aesthetic**: WaveSurfer-based. Playhead follows audio. Pre-computed
peaks JSON for fast first paint.

**Done when**:
- Play, pause, seek work across all supported browsers.
- Space / ← → keyboard shortcuts.
- Waveform renders < 100ms after track selected.
- Gapless playback when queued (stretch: P1).

---

### F1.5 — Edit track metadata

**Function**: PATCH `/tracks/:id` — title, style tags, visibility.

**Aesthetic**: Inline edit on title. Tags are chip-input. Visibility
toggle.

**Done when**:
- Inline title edit works (click, edit, blur saves).
- Tags: type to add, click-x to remove.
- Visibility flip reflects within 100ms (optimistic).

---

### F1.6 — Playlists (create, add, reorder)

**Function**: CRUD for playlists. Add/remove tracks. Reorder via
float `position` column.

**Aesthetic**: S5 Playlist Detail. Drag-to-reorder with
FLIP animation. Cover gradient derived from tracks' spectral content.

**Done when**:
- Create, rename, delete playlists.
- Add tracks via "add to playlist" menu on track row.
- Drag-reorder works pointer + keyboard.
- Cover gradient renders within 50ms of playlist load.

---

### F1.7 — Share playlist (public link)

**Function**: Generate token, public GET endpoint, server-rendered
share view. Token revocation.

**Aesthetic**: S6 Public Share View. Works without JS (SSR for SEO +
speed). OG image auto-generated.

**Done when**:
- Share dialog creates token, copies URL.
- Anon user opens URL, sees playlist, can play.
- Revoke → URL returns 404 in <60s (cache purge).
- OG image shows correct title + cover.

---

### F1.8 — Responsive layout

**Function**: Works at 320px width and up. Touch-friendly on mobile.

**Aesthetic**: Breakpoints from [`../docs/UI_UX.md`](../docs/UI_UX.md).
Mobile: bottom tab rails, larger hit targets.

**Done when**:
- Playwright E2E passes on mobile-safari and mobile-chrome profiles.
- No horizontal scroll at 320px.
- All primary flows completable on touch.

---

### F1.9 — Accessibility baseline

**Function**: WCAG 2.2 AA on all P0 flows.

**Aesthetic**: Focus rings visible, color contrast 4.5:1, reduced-
motion respected.

**Done when**:
- Axe-playwright reports 0 violations on each E2E flow.
- Keyboard-only E2E passes.
- Screen reader completes CP1 (manual check).

---

## P1 — If asked about v2

### F2.1 — Regenerate segment

**Function**: Click-drag on waveform, choose time range, provide
new prompt → Suno generates that range, splice into existing track.

**Aesthetic**: Segment handles on waveform. Modal with prompt pre-
populated. New segment crossfades in at completion.

**Depends on**: Suno API supporting range regeneration (if it
doesn't, this is P2).

---

### F2.2 — Lyrics with alignment

**Function**: User-provided or auto-generated lyrics. Align to audio
via Whisper or Suno-native alignment.

**Aesthetic**: Lyrics scroll beneath waveform, highlighted word syncs
to playback. Click a word to seek.

---

### F2.3 — Export

**Function**: MP3, WAV, Opus exports. Server-side transcoding to
requested format.

**Aesthetic**: Export dialog with format selector + quality tier.
Progress indicator for larger files.

---

### F2.4 — `.setlist` file format

**Function**: Downloadable bundle of track + metadata + tokens (if
available from Suno) for portability / reproducibility.

**Aesthetic**: Download button in track detail. On upload, tracks
restore with full history.

**Ties to**: [`../docs/TOKENIZATION.md`](../docs/TOKENIZATION.md)
Part 4.4 — legible file format as a design value.

---

### F2.5 — Collaborative playlist

**Function**: Invite a friend to add tracks to a playlist. Live cursor
+ CRDT sync via Yjs.

**Aesthetic**: Co-editor avatars in top right. Live cursor + selection
in list. Presence indicator.

**Depends on**: real-time infrastructure already in place from F1.2.

---

### F2.6 — Mobile PWA

**Function**: Installable PWA with offline-first track library.
Background audio playback.

**Aesthetic**: App-like navigation. Swipe gestures for row actions.
Native-feeling transitions.

---

### F2.7 — Search across public playlists

**Function**: Full-text search on public playlists. Semantic search on
prompts via embeddings.

**Aesthetic**: Command palette dedicated mode. Results with preview
play-on-hover.

---

### F2.8 — Subscriptions & billing

**Function**: Stripe + webhook. Tier upgrades unlock more generations
/ longer durations / commercial licenses.

**Aesthetic**: Non-intrusive upgrade prompts when quota exhausted.
Billing page clear and honest.

---

## P2 — Moonshots

### F3.1 — Token visualization

**Function**: Per-token colored blocks below the waveform. As
generation streams in, blocks appear. Users can click a block to
regenerate from there.

**Why**: Makes the AI legible. Ties to
[`../docs/TOKENIZATION.md`](../docs/TOKENIZATION.md) Part 4.3.

---

### F3.2 — Version control for tracks

**Function**: Branch a track. Undo regenerations. Merge takes.

**Why**: "Git for songs." Requires the `.setlist` file format from
F2.4.

---

### F3.3 — AudioWorklet effects chain

**Function**: Per-track EQ, compressor, reverb, live-applied in the
browser via AudioWorklet.

**Why**: Studio-grade playback. Big engineering impress factor.

---

### F3.4 — In-browser stem separation

**Function**: Client-side Demucs-lite or similar via WebGPU. Pull
drums, bass, vocals out of a track.

**Why**: The Procreate-bold engineering bet — local, free, impressive.

---

### F3.5 — Live collaborative session ("Party Mode")

**Function**: Multi-user synced playback + reactions. Not a generation
tool; a playback tool.

**Why**: Social layer. WebRTC + presence.

---

### F3.6 — Desktop app via Tauri

**Function**: Native-ish desktop build. Deep OS integration (media
keys, now-playing).

**Why**: Reaches users who prefer native. Tauri over Electron for
10x smaller binary.

---

### F3.7 — Creator marketplace

**Function**: Sell prompts, style presets, finished tracks.
Revenue split.

**Why**: Turns the tool into a platform. Requires identity + trust +
payments — big scope.

---

## What's explicitly NOT in any tier

See [`NON_GOALS.md`](./NON_GOALS.md).

- Not a DAW. No MIDI, no piano roll, no track arrangement. Use
  Ableton.
- Not a streaming service. No radio, no algorithmic "for you"
  playlists for discovery.
- Not a social network. Share links exist, but no follow graph, no
  feed.
- Not a distributor. We don't push to Spotify, we don't handle rights
  clearance.
- Not a lyrics-only product. Music is the primary output.
- Not a voice cloning product. Refuses to clone specific voices.
- Not a real-time collab DAW. Collab happens at the *playlist*
  level, not the track level, for reasons of technical sanity.

---

## Prioritization heuristic

Score each feature on three axes:

1. **User pull** — would people cancel if this didn't exist? (1-10)
2. **Craft signal** — does building this well showcase engineering
   depth? (1-10)
3. **Scope confidence** — are we sure about the scope? (1-10)

Shippable = user pull × craft signal × scope confidence / 1000 ≥ 4.

P0 features all score ≥ 6. P1 features score ≥ 4. P2 features are
≥ 2 (interesting but risky).

This keeps us honest about what's "next" vs "someday."
