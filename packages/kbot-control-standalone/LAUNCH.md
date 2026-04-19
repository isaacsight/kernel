# kbot-control — Launch Copy

Target launch: Tuesday, 10:15 AM PT / 1:15 PM ET (post-coffee window, pre-lunch EU tail).

---

## 1. Hacker News

**Title:**

> Show HN: kbot-control – one Max for Live device, JSON-RPC, replaces three Ableton bridges

**Submission text (3–4 paragraphs):**

To control Ableton Live from code today you stitch together three projects and pray: AbletonOSC (UDP 11000, no browser API, no listeners, device load is flaky), AbletonBridge (TCP 9001, separate Python install, 353 tools but brittle startup), and usually a private "bridge" per project to fill the gaps. When even that fails people fall back to screenshotting the Live window and clicking pixels. This is the shape of the problem: one DAW, four control surfaces, and the UI-scroll bug in `selected_track` still isn't fixed.

kbot-control is one `.amxd` you drag onto a track. It opens `127.0.0.1:9000`, speaks JSON-RPC 2.0 newline-delimited, and exposes the whole Live Object Model — song, track, clip, scene, device, browser, view, arrangement, listeners, MIDI mapping — through a single dispatcher running inside Max's JS engine. The Node client is ~300 lines with zero npm dependencies (uses `node:net`). Listeners stream back as JSON-RPC notifications over the same socket, broadcast to every connected client. `view.focus_track` actually selects *and* scrolls *and* highlights, which sounds trivial until you've spent an afternoon fighting `Live.Application.view`.

One authenticity note: Live 12.4b15 quietly removed the JS `browser` object from `LiveAPI.get_control_surface(...)`. If you build against the beta line your browser calls silently hang. The dispatcher falls back to walking `Live.Application.view.browser` directly — Live 11 and Live 12 stable are unaffected. The fallback path is labelled `// b15 workaround` in the source and it exists because we found it the same way you would.

We built this because kbot (our open-source terminal AI agent) needed it. We're publishing it because the Ableton tooling layer shouldn't be four half-finished bridges. MIT, single file, zero Python, zero daemons. Protocol reference and a 30-line smoke test are in the repo.

Link: https://github.com/isaacsight/kernel/tree/main/packages/kbot-control-standalone

---

## 2. X / Twitter thread (7 tweets, no emojis)

**1 / hook**

> Controlling Ableton Live from code used to mean running three bridges: AbletonOSC on UDP 11000, AbletonBridge on TCP 9001, and a custom one for whatever the first two missed. We replaced all of it with one Max for Live device. Open-sourcing it today. MIT.

**2 / the protocol**

> One .amxd, one TCP socket on 127.0.0.1:9000, one wire format: JSON-RPC 2.0, newline-delimited.
>
> ```
> { "jsonrpc":"2.0","id":1,"method":"song.tempo","params":{"value":120} }
> ```
>
> That is the whole API. Every namespace (song, track, clip, scene, device, browser, view) reads the same.

**3 / the client**

> Node client is zero-dependency. Uses node:net. ~300 lines.
>
> ```ts
> import { kc } from '@kernel.chat/kbot-control'
> await kc('song.tempo', { value: 120 })
> await kc('view.focus_track', { index: 2 })
> ```

**4 / listeners**

> Real-time subscriptions over the same socket. No second port, no polling.
>
> ```ts
> await client.subscribe('song.is_playing', v => console.log(v))
> await client.subscribe('tracks[0].output_meter_left', v => meter(v))
> ```
>
> Notifications are pushed as JSON-RPC messages with no id. Every connected client receives every notify.

**5 / the view bug**

> AbletonOSC's `selected_track` selects a track but doesn't scroll the UI to it. If it's off-screen you can't see what you just selected.
>
> `view.focus_track(index)` selects, scrolls, and highlights. Because it drives the Live Object Model, not a keystroke.

**6 / Live 12.4b15 gotcha**

> Live 12.4b15 removed the JS `browser` object from `LiveAPI.get_control_surface`. Every Ableton automation project built against the beta line is silently broken on `browser.*` calls.
>
> Dispatcher falls back to `Live.Application.view.browser`. Stable Live 11 and 12 are fine.

**7 / links**

> Repo + protocol + 30-line smoke test:
> https://github.com/isaacsight/kernel/tree/main/packages/kbot-control-standalone
>
> npm: `npm i @kernel.chat/kbot-control`
>
> This is the infrastructure layer kbot (our terminal AI agent) sits on. Pulled it out so anyone building music tools, agents, or visualizers can use the same surface.

---

## 3. Reddit variants

### r/ableton

**Title:** One Max for Live device that replaces AbletonOSC, AbletonBridge, and the "Python wrapper" approach

If you've ever wired up AbletonOSC for live coding, a Python bridge for device loading, and then written a custom script for whatever fell between them — this collapses all of it into a single `.amxd` you drag onto a track.

- TCP on `127.0.0.1:9000`, JSON-RPC 2.0, one JSON per line
- Full LOM surface: song, track, clip, scene, device, browser, view, arrangement
- `view.focus_track` actually scrolls the UI (AbletonOSC's `selected_track` famously doesn't)
- Real-time listeners stream over the same socket — no second port
- Live 12.4b15 workaround baked in for the removed `browser` JS object
- MIT, zero Python, zero daemons, zero npm dependencies on the client side

Not a MIDI bridge, not a replacement for your DAW — just a clean control surface for anyone writing external tools. If you're doing generative sessions, custom controllers, visualizers, or agent-driven production this is the layer you were probably building by hand.

Link in comments.

---

### r/LiveMusicians

**Title:** Free tool: control Ableton from any program over a single TCP socket

Posting this for anyone running hybrid / custom-controller rigs. kbot-control is one Max for Live device that exposes Ableton over TCP so you can drive it from Python, Node, Rust, a shell script, or a second laptop without OSC mapping or keystroke automation.

Practical stuff it unlocks:

- Backing-track rig that reacts to what you just played (listeners stream track state in real time)
- External click/tempo sync without MIDI clock jitter
- Custom foot controllers over Wi-Fi that call `clip.fire` / `scene.fire` directly
- In-ear monitor automation tied to scene changes
- A "safety" second computer that can stop all clips if the main rig panics

MIT, no subscription, no cloud. Works with Live 11 and Live 12 (there's a known Live 12.4 *beta* edge case, documented in the README).

---

### r/IndieDev

**Title:** Open-sourced the JSON-RPC control surface our AI agent uses to drive Ableton

We build kbot, an open-source terminal AI agent. It does music production work in Ableton. To do that reliably we had to solve a problem that turns out to be a general one: Ableton's control story is four tools in a trenchcoat (AbletonOSC, AbletonBridge, your own bridge, and clicking pixels as a last resort).

kbot-control is the single-device solution. One `.amxd`, one TCP port, JSON-RPC 2.0. We've extracted it into its own repo under MIT so anyone building music-adjacent indie tools — loop sequencers, generative plugins, live coding environments, stream overlays that react to the DAW — can skip the bridge-juggling phase.

Zero npm dependencies in the client. The whole protocol fits on one page.

---

## 4. Discord / Ableton Forum

**Title:** [OSS] kbot-control 0.1.0 — single .amxd, JSON-RPC 2.0 over TCP, full LOM surface

Hey — releasing something we built for ourselves that's probably useful to anyone writing Live automation.

**What it is:** a Max for Live audio-effect device that opens a TCP server on `127.0.0.1:9000` and exposes the Live Object Model as JSON-RPC 2.0, newline-delimited.

**What's in the protocol:**

- `song.*` — transport, tempo, time sig, cue points, tap tempo, capture MIDI
- `track.*` — create/delete/duplicate/rename/color, volume/pan/send, routing, monitoring, freeze/flatten
- `clip.*` — fire/stop, create/delete/duplicate, notes get/set, envelopes, warp markers
- `scene.*` — fire, create/delete/duplicate, per-scene tempo and time sig
- `device.*` — params, set by name or ID, enable/disable, load by URI or fuzzy name, move between tracks
- `browser.*` — search, list, preview, load (bypasses the UI)
- `view.*` — focus track / clip / device / scene with correct scrolling (fixes the `selected_track` UI-scroll bug)
- `arrangement.*` — arrangement clips, locators, placement
- `listen.*` — subscribe to any LOM property path, notifications stream back over the same socket
- `midi.*` — learn, map, unmap, list mappings

**What's in it for you:**

- One install path instead of three. Drag the `.amxd` on a track, done.
- No Python, no separate daemon, no Remote Scripts folder surgery.
- Listeners are first-class. You get play state, meters, clip playhead position, device parameter changes — all streamed.
- Browser API works reliably. Device load by name isn't a coin flip anymore.
- Live 12.4b15 browser-API regression is handled with a documented fallback.

MIT. Repo + protocol reference + smoke test linked below. If you break something please file an issue with your Live version — that fallback path above is how we know we'll need more of them.

---

## 5. Suggested Launch Sequence

Post order matters. HN first, then everything else chases the HN thread.

| # | Time (PT) | Time (ET) | Platform | Why this slot |
|---|---|---|---|---|
| 1 | **Tue 08:45 AM** | 11:45 AM | HN submit | Morning US + post-lunch EU, beats the 9am flood |
| 2 | Tue 09:15 AM | 12:15 PM | X thread | 30 min after HN so the tweet can link to a warm thread |
| 3 | Tue 09:30 AM | 12:30 PM | Discord (kernel + Ableton forums) | Technical audience, low-risk warmup |
| 4 | Tue 11:00 AM | 2:00 PM | r/ableton | After HN momentum check; heavy-moderation sub, want it clean |
| 5 | Tue 12:30 PM | 3:30 PM | r/LiveMusicians | Practitioner audience, different framing |
| 6 | Tue 3:00 PM | 6:00 PM | r/IndieDev | Evening builder browsing window |
| 7 | Wed 09:00 AM | 12:00 PM | LinkedIn + Mastodon + Bluesky | Slower-burn platforms, next-day when HN is still visible |

Rules of engagement:

- Do not cross-link platforms inside the posts (HN guidelines, Reddit self-promo rules).
- Answer every HN comment within 20 min for the first 2 hours. That is what keeps it on the front page.
- If HN doesn't land, do not repost same day. Try Thursday same time with a different title angle.
- Have the GIF/screencast ready as a reply asset, not in the main post.
