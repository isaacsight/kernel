---
name: ableton-session-build
description: Use when the user wants to build a track, beat, or arrangement in Ableton Live. kbot drives Ableton via OSC — you don't type notes, you describe the idea.
version: 1.0.0
author: kbot
license: MIT
platforms: [darwin]
metadata:
  kbot:
    tags: [ableton, music, osc, m4l, production]
    related_skills: [serum2-preset-craft, dj-set-builder]
---

# Ableton Session Build

kbot has 14 Ableton tools, 9 M4L devices, and a full OSC bridge. You describe a beat; kbot lays it down in a live session.

## Iron Law

```
VERIFY THE OSC BRIDGE FIRST. EVERY TIME.
```

Without a live bridge, every tool call silently fails. Check before you plan.

## Preflight (2 commands)

1. `ableton_session_info` — if this returns tempo + tracks, you're connected.
2. If it times out: remind the user to start Live and enable the AbletonOSC remote script (`Link/Tempo/MIDI → Control Surface → AbletonOSC`).

## Production Flow

1. **Set the frame**: `ableton_transport` to set tempo, key hint via scene naming, time signature.
2. **Create tracks**: one `ableton_create_track` per role (drums, bass, pad, lead, FX).
3. **Load sounds**: `ableton_load_sample` for one-shots; `ableton_load_plugin` for Serum/synths; `ableton_load_preset` for factory patches.
4. **Write patterns**: `ableton_midi` with note arrays. Use `generate_drum_pattern` / `generate_melody_pattern` as starting points.
5. **Arrange**: `ableton_scene` to build verse/chorus/drop scenes; `ableton_clip` to fire them.
6. **Mix**: `ableton_mixer` for levels/pan; `ableton_effect_chain` for returns; `ableton_device` for insert FX.
7. **Capture**: render via transport record, or have the user bounce the arrangement.

## Specialist Escalations

- Preset design needed? Use `serum2-preset-craft`.
- Full DJ set needed? Use `dj-set-builder`.
- Sound too generic? Route to `aesthete` specialist with the current session_info for creative direction.

## Anti-Patterns

- Writing MIDI before verifying the bridge responds. Silent failures waste the whole session.
- Loading plugins without checking the user has them installed. Use `ableton_browse` first.
- Generating 32-bar patterns in one call. Work in 4- and 8-bar loops; iterate.

## Known Fragility

- AbletonOSC's `set/notes` endpoint quirks — if clip writes fail, fall back to setting notes via `ableton_clip.write_notes` with explicit velocity + duration.
- Sample loading can 404 if the browser index is stale. `ableton_browse --refresh` fixes it.
- Clip firing during a running session can drop the first beat. Fire on scene boundary, not mid-bar.

## What Emerges

The user stops thinking in Live's UI and starts describing ideas. "Make it darker" becomes a legitimate prompt because kbot knows darker = minor key + sub-bass boost + reverb tail + plate on the snare. This is the skill paying off over sessions.
