# kbot-control

**One Max for Live device. One TCP socket. Full control of Ableton Live over JSON-RPC 2.0.**

```ts
import { kc } from '@kernel.chat/kbot-control'

await kc('song.tempo', { value: 120 })
await kc('view.focus_track', { index: 2 })
await kc('clip.fire', { track: 0, slot: 0 })

// Real-time listener — same socket, streamed as JSON-RPC notifications
const client = KbotControlClient.get()
await client.subscribe('song.is_playing', v => console.log('play:', v))
```

That is the whole surface. Drag one `.amxd` onto a track and every program on your machine can drive Ableton through a clean newline-delimited JSON-RPC API on `127.0.0.1:9000` — no Remote Scripts, no Python bridges, no OSC mapping, no UI automation. Zero npm dependencies on the client (uses `node:net`).

> **TODO:** 30-second screencast — drag .amxd onto track, run smoke test, watch tempo change and track focus scroll. Place GIF here.

This is the infrastructure layer [kbot](https://npmjs.com/package/@kernel.chat/kbot) sits on top of. We use it in production; we're open-sourcing it so you can too.

## Install

```bash
npm install @kernel.chat/kbot-control
```

Install the M4L device into Ableton:

```bash
cp node_modules/@kernel.chat/kbot-control/kbot-control.amxd \
   ~/Music/Ableton/User\ Library/Presets/Audio\ Effects/Max\ Audio\ Effect/

# Companion JS files — Max looks for them next to the device
cp node_modules/@kernel.chat/kbot-control/kbot-control.js \
   node_modules/@kernel.chat/kbot-control/kbot-control-server.js \
   ~/Music/Ableton/User\ Library/Presets/Audio\ Effects/Max\ Audio\ Effect/
```

In Ableton: Browser → Audio Effects → Max Audio Effect → drag `kbot-control` onto any track. The device listens on `127.0.0.1:9000` the moment it loads.

**Requirements:** Ableton Live 11+ with Max for Live, Node.js 20+.

## JSON-RPC examples

Transport: TCP `127.0.0.1:9000`, one JSON message per line (`\n` delimited), JSON-RPC 2.0.

```jsonc
// -> song.tempo get
{ "jsonrpc": "2.0", "id": 1, "method": "song.tempo" }
// <- { "jsonrpc": "2.0", "id": 1, "result": { "value": 128.0 } }

// -> song.tempo set
{ "jsonrpc": "2.0", "id": 2, "method": "song.tempo", "params": { "value": 120 } }

// -> view.focus_track (selects AND scrolls the UI)
{ "jsonrpc": "2.0", "id": 4, "method": "view.focus_track", "params": { "index": 2 } }

// -> listen.subscribe (streamed notifications follow)
{ "jsonrpc": "2.0", "id": 5, "method": "listen.subscribe", "params": { "path": "song.is_playing" } }
// <- push notification (no id):
// { "jsonrpc": "2.0", "method": "notify", "params": { "path": "song.is_playing", "value": true } }
```

See [PROTOCOL.md](./PROTOCOL.md) for the full method list (song, track, clip, scene, device, browser, view, arrangement, listen, midi, kbot).

## How it compares

| | AbletonOSC | AbletonBridge | kbot-bridge | **kbot-control** |
|---|---|---|---|---|
| Install | Remote Script folder | Python env + script | Node daemon | One `.amxd` drag-in |
| Transport | UDP 11000 | TCP 9001 | TCP 9999 | **TCP 9000 (JSON-RPC 2.0)** |
| Transport + device control | Yes | Partial | Yes | **Yes** |
| Browser API (search/load) | No | Yes (353 tools) | No | **Yes** |
| Listeners / streaming state | No | Partial | No | **Yes (same socket)** |
| `view.focus_track` scrolls UI | No (known bug) | No | Workaround | **Yes (native LOM)** |
| Device load reliability | Flaky | OK | Partial | **Reliable (URI + fuzzy)** |
| Live 12.4b15 browser regression | Unhandled | Unhandled | Unhandled | **Fallback path** |
| Client deps | OSC library | Python + deps | Node deps | **Zero (`node:net`)** |

kbot-control replaces all four with one device that exposes the full Live Object Model, ships listeners natively, drives the UI through LOM (not screenshots), and is a single `.amxd`.

## What this is NOT

- **Not a MIDI bridge.** MIDI already has transports. This is a control/query layer for the DAW itself — transport, tracks, clips, devices, browser, view, arrangement.
- **Not an audio plugin.** It's a Max for Live audio effect only as a hosting vehicle. It does not process audio.
- **Not a DAW replacement.** Ableton is still doing everything it always did. This just gives external programs a clean way to ask it questions and tell it things.
- **Not a UI automation layer.** No screenshotting, no keystroke sending, no pixel-clicking. Everything goes through the Live Object Model.
- **Not a remote control protocol.** It binds to `127.0.0.1` by design. If you need network access, put your own auth in front of it.

## Live 12.4b15 gotcha

Live 12.4b15 removed the JS `browser` object on `LiveAPI.get_control_surface(...)`. On that beta line, `browser.*` methods fall back to walking `Live.Application.view.browser` directly. Non-beta Live 11 and Live 12 stable behave normally. If you see `Method not found: browser.list` or silent hangs on browser calls, update to the latest device build and file an issue with your Live version.

## FAQ

**Q: Why TCP and not WebSocket?**
Because the client is meant to be a 10-line `node:net` connection with zero dependencies, and every language on earth has a TCP client in stdlib. A WebSocket layer would require framing, HTTP upgrade handling, and a dependency we don't need. If you want WebSockets, wrap the TCP socket in 30 lines — we'll link community wrappers in the repo.

**Q: Does it work with Live 11?**
Yes. Live 11 and Live 12 (stable) are both supported. Only the 12.4 *beta* line has the `browser` object regression, and there's a documented fallback for that too.

**Q: Can I use it without kbot?**
Yes. That's the point. kbot-control is a standalone package — drag the `.amxd` in, talk to `127.0.0.1:9000` from anything. Python, Node, Rust, a shell one-liner with `nc`. kbot is one user; we want more.

**Q: What happens if multiple clients connect at once?**
Every connected TCP client receives every `notify` broadcast from `listen.subscribe`. Request/response is per-client (your `id` gets your `result`). There is no per-client auth — localhost only.

**Q: What's the overhead vs. native LOM?**
Each call is one JSON encode + TCP round-trip + LOM call. On a local socket the round-trip is <1ms in practice. For parameter sweeps or automation, subscribe to the listener path instead of polling.

## Files

- `kbot-control.amxd` — the drag-in M4L device
- `kbot-control.maxpat` — the Max patch source
- `kbot-control.js` — LOM dispatcher (runs inside Max's JS engine)
- `kbot-control-server.js` — Node for Max TCP server
- `manifest.json` — device metadata
- `PROTOCOL.md` — JSON-RPC method reference
- `src/client.ts` — TypeScript client (compiled to `dist/client.js`)
- `examples/basic.mjs` — 30-line smoke test
- `build.mjs` — rebuild the `.amxd` from the `.maxpat` source

## License

MIT. See [LICENSE](./LICENSE).

## Who built this

[kernel.chat](https://kernel.chat) — the team behind [kbot](https://npmjs.com/package/@kernel.chat/kbot), an open-source terminal AI agent. kbot-control is how kbot drives Ableton. We pulled it out so anyone building music tools, agents, controllers, or visualizers can stand on the same surface.
