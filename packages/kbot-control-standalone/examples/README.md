# kbot-control examples

Six runnable demos that show kbot-control driving Ableton Live over
JSON-RPC. Each file is self-contained — no bundler, no framework.

## Install

From the package root:

```bash
npm install
npm run build        # compiles src/client.ts -> dist/client.js
```

Then in Ableton Live (11 or 12):

1. Open any Live set.
2. Drag `kbot-control.amxd` onto a track (MIDI or audio — either works).
3. Wait for the Max window to say `kbot-control vX.Y.Z ready`.
4. Confirm TCP is listening: `nc -z 127.0.0.1 9000 && echo ok`.

## Run

```bash
node examples/01-transport-control.mjs
```

Replace the filename to run any other example. If Ableton isn't
running or the `.amxd` isn't loaded, every example prints setup
instructions and exits with code 2.

## The six examples

| # | File | What it shows |
|---|---|---|
| 1 | `01-transport-control.mjs` | tempo, play/stop, tap, metronome, state read — the basic loop |
| 2 | `02-build-session.mjs`     | create audio/MIDI/return tracks, rename, recolor, set volume |
| 3 | `03-write-midi.mjs`        | create a clip, write a 4-chord Cm progression, fire it |
| 4 | `04-listen-live.mjs`       | subscribe to real-time song state for 30 seconds |
| 5 | `05-mixer-snapshot.mjs`    | introspect every track, print a console mixer table |
| 6 | `06-custom-rpc.mjs`        | escape hatch: call any protocol method via `kc(...)` |

## Try it in order

01 → 02 → 03 → 05 builds a satisfying arc: you start with transport,
spin up tracks, write notes, then print the mixer you just built. Keep
04 running in a second terminal during 01/03 to watch events stream in.
06 is the reference for "how do I call anything in PROTOCOL.md?" — come
back to it any time you hit a method the TS client doesn't wrap yet.

## Full protocol

See `../PROTOCOL.md` for every namespace and method.
