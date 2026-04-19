# kbot-control

**One Max-for-Live device that supersedes AbletonOSC, AbletonBridge, kbot-bridge, and the computer-use Ableton fallback.**

Drag one `.amxd` into any track. That's the entire install.

## Why this exists

kbot's Ableton control was fragmented across four layers:

| Layer | Port | Surface | Gaps |
|---|---|---|---|
| AbletonOSC | UDP 11000 | Transport, track, clip, scene, device params | No browser ops, no listeners, selected_track doesn't scroll UI, device load unreliable |
| AbletonBridge | TCP 9001 | 353-tool browser API | Separate install, not wired to most tools |
| kbot-bridge | TCP 9997 | kbot-specific LOM helpers | Duplicated code, partial coverage |
| Claude computer-use | — | UI fallback | Fragile, slow, breaks on layout changes |

Each gap was being papered over by falling through to the next layer. The right answer is one layer that has full LOM access from the start.

## What it does

Runs inside Ableton Live with direct access to the Live Object Model. Exposes a single JSON-RPC 2.0 API over plain TCP on `127.0.0.1:9000`, newline-delimited. Zero npm dependencies — only `node:net`.

Every operation AbletonOSC does, plus:

- **Proper device loading** — uses `Live.Application.view.browser` to navigate categories, then `load_item()` on the correct track. No visibility/focus race.
- **Track focus that actually focuses** — selects the track AND scrolls the session/arrangement view so it's visible AND highlights the header. Equivalent to clicking the track.
- **Listeners** — subscribe to `song.is_playing`, `track.output_meter_left`, `clip.playing_position`, `device.parameter_values`. Native LOM listeners, streamed over WebSocket.
- **Browser navigation** — full access to categories (Sounds, Instruments, Drums, Audio Effects, MIDI Effects, Max for Live, Plug-Ins, Clips, Samples, User Library), subfolders, search across the entire library.
- **Arrangement view control** — full access to `arrangement_clips`, clip placement on timeline, arrangement recording.
- **Clip envelopes** — get/set automation points for any clip parameter.
- **Send track routing** — create/delete return tracks, full routing matrix.
- **VST3/AU wrapper control** — direct parameter access without UI automation.
- **MIDI learn / MIDI mapping** — attach any OSC or WebSocket message to any parameter.
- **Custom responses** — streaming partial results for long operations (analyzing a 10-minute audio clip, scanning a Pack).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  kbot CLI                                                    │
│  ├─ src/integrations/kbot-control-client.ts (singleton)     │
│  └─ src/tools/ableton.ts (all 21+ tools route here)         │
└────────────────────────────┬────────────────────────────────┘
                             │ WebSocket (ws://127.0.0.1:9000)
                             │ JSON-RPC 2.0
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Ableton Live                                                │
│  └─ kbot-control.amxd (dragged into any track)              │
│     ├─ Node for Max WebSocket server                         │
│     ├─ LOM dispatcher (maps RPC → Live API calls)           │
│     ├─ Listener registry (forward LOM events → WS clients)  │
│     └─ Browser navigator (categories + search)              │
└─────────────────────────────────────────────────────────────┘
```

## Files

- `kbot-control.maxpat` — Max patch wrapping the JS and the Node for Max bridge
- `kbot-control.js` — the dispatcher that runs inside Max
- `kbot-control-server.js` — Node for Max script running the WebSocket server
- `manifest.json` — M4L device manifest
- `PROTOCOL.md` — JSON-RPC method reference
- `../../src/integrations/kbot-control-client.ts` — the kbot-side client

## Migration

Existing `ableton_*` tools keep their interface. They route through the new client instead of OSC. AbletonOSC stays supported as a fallback until kbot-control hits parity.

## Install

```bash
# From the kbot repo:
cp m4l/kbot-control/kbot-control.amxd ~/Music/Ableton/User\ Library/Presets/Audio\ Effects/Max\ Audio\ Effect/
# Then in Ableton: drag onto any track. Once loaded, kbot finds it automatically.
```

## Status

Scaffold in progress. See PROTOCOL.md for the full method list, `kbot-control.js` for the implementation.
