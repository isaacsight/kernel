# kbot Max for Live Device Suite -- Architecture Specification

## Why Replace AbletonOSC

The current stack is: kbot (Node.js) --> UDP/OSC --> AbletonOSC (Python MIDI Remote Script) --> Live Object Model.

Problems:
1. **OSC is lossy.** UDP drops packets under load. No delivery guarantee, no backpressure.
2. **AbletonOSC is read-mostly.** It exposes getters well but many write operations are missing or broken.
3. **kbot_bridge.py is fragile.** Injected into AbletonOSC's directory inside the Ableton .app bundle. Disappears on Ableton updates.
4. **Boolean decoding bug.** OSC 'T'/'F' types were silently dropped (now fixed, but symptomatic of protocol mismatch).
5. **Sample-into-drum-pad loading is impossible.** `browser.hotswap_target` is read-only. `browser.load_item()` targets tracks, not pads. The current view-focusing hack is unreliable.
6. **No Node for Max.** M4L devices can run full Node.js inside Ableton via the `node.script` object. This gives us `net`, `ws`, `fs`, and the entire npm ecosystem -- directly inside Ableton.

## The Replacement: 5 Max for Live Devices

```
m4l/
  kbot-bridge/           # 1. Core bridge -- replaces AbletonOSC + kbot_bridge.py
    kbot-bridge.js           Node for Max: WebSocket server + LOM command router
    kbot-bridge.maxpat        Max patcher JSON (node.script + live.path + js)
    manifest.json             Device metadata
  kbot-auto-mixer/       # 2. Auto mix engine -- frequency analysis + LUFS
    kbot-auto-mixer.js        Node for Max: analysis + mix decisions
    kbot-auto-mixer-dsp.js    Max js: per-track FFT analysis via live.observer
    kbot-auto-mixer.maxpat    Max patcher JSON
  kbot-drum-loader/      # 3. Smart drum pad loader -- solves the sample loading bug
    kbot-drum-loader.js       Max js: direct LOM sample injection into SimplerDevice
    kbot-drum-loader.maxpat   Max patcher JSON
  kbot-preset-browser/   # 4. Plugin preset control
    kbot-preset-browser.js    Max js: preset enumeration + load via LOM
    kbot-preset-browser.maxpat Max patcher JSON
  kbot-melody-gen/       # 5. AI melody generator
    kbot-melody-gen.js        Max js: scale-aware MIDI generation
    kbot-melody-gen.maxpat    Max patcher JSON
  install.sh                  Copies devices to Ableton User Library
  ARCHITECTURE.md             This file
```

## Communication Protocol

### Transport: WebSocket (replaces UDP/OSC)

- **Server:** `kbot-bridge.js` runs inside Ableton via Node for Max, listening on `ws://localhost:9999`
- **Client:** kbot's new `ableton-ws.ts` connects as a WebSocket client
- **Format:** JSON over WebSocket (replaces binary OSC)
- **Reliability:** TCP-backed, bidirectional, supports request/response with message IDs

### Message Format

```
-- Request (kbot --> Ableton) --
{
  "id": "msg_001",          // Unique message ID for response correlation
  "action": "load_plugin",  // Command name
  "params": {               // Action-specific parameters
    "track": 0,
    "name": "TR-808",
    "manufacturer": "Roland Cloud"
  }
}

-- Response (Ableton --> kbot) --
{
  "id": "msg_001",          // Matches request ID
  "status": "ok",           // "ok" | "error"
  "result": {               // Action-specific result
    "device": "TR-808",
    "track": 0,
    "device_id": 42
  }
}

-- Event (Ableton --> kbot, unsolicited) --
{
  "event": "transport_changed",
  "data": {
    "is_playing": true,
    "tempo": 140,
    "current_beat": 4.0
  }
}
```

### Supported Actions (kbot-bridge)

| Category | Action | Params | Notes |
|----------|--------|--------|-------|
| **Transport** | `get_transport` | -- | Returns tempo, is_playing, position, time_sig |
| | `set_transport` | `{tempo?, is_playing?, position?}` | |
| | `start_playing` | -- | |
| | `stop_playing` | -- | |
| | `continue_playing` | -- | Resume from current position |
| **Tracks** | `list_tracks` | -- | All track names, types, states |
| | `create_track` | `{type, name, index?}` | midi or audio |
| | `delete_track` | `{track}` | |
| | `set_track` | `{track, volume?, pan?, mute?, solo?, arm?, name?, color?}` | |
| | `get_track` | `{track}` | Full track state |
| **Clips** | `create_clip` | `{track, slot, length}` | |
| | `delete_clip` | `{track, slot}` | |
| | `fire_clip` | `{track, slot, quantization?}` | Immediate by default |
| | `stop_clip` | `{track, slot}` | |
| | `get_clip_info` | `{track, slot}` | |
| | `duplicate_clip` | `{track, slot}` | |
| **MIDI** | `add_notes` | `{track, slot, notes: [{pitch, start, duration, velocity, mute?}]}` | Batch note writing |
| | `get_notes` | `{track, slot, start?, length?}` | |
| | `remove_notes` | `{track, slot, start?, length?, pitch?}` | |
| | `replace_notes` | `{track, slot, notes}` | remove_all + add |
| **Devices** | `load_plugin` | `{track, name, manufacturer?}` | Browser search + load |
| | `list_devices` | `{track}` | |
| | `get_device_params` | `{track, device}` | ALL params inc. VST internals |
| | `set_device_param` | `{track, device, param, value}` | By name or index |
| | `enable_device` | `{track, device, enabled}` | |
| | `browse_presets` | `{track, device}` | List available presets |
| | `load_preset` | `{track, device, preset}` | By name or index |
| **Drum Rack** | `load_drum_sample` | `{track, device, pad, path}` | THE FIX for sample loading |
| | `list_drum_pads` | `{track, device}` | Pad contents |
| | `swap_drum_sample` | `{track, device, pad, path}` | Hot-swap |
| | `set_pad_params` | `{track, device, pad, volume?, pan?, tune?}` | Per-pad mixer |
| **Automation** | `create_envelope` | `{track, device, param, points: [{time, value}]}` | Breakpoint automation |
| | `clear_envelope` | `{track, device, param}` | |
| **Scenes** | `fire_scene` | `{scene}` | |
| | `list_scenes` | -- | |
| | `create_scene` | `{name?}` | |
| **Mix** | `get_mix_snapshot` | -- | All track levels, pans, sends |
| | `set_sends` | `{track, sends: [{return, level}]}` | |
| | `get_master` | -- | Master track state |
| | `set_master` | `{volume?, pan?}` | |
| **Returns** | `list_returns` | -- | |
| | `create_return` | `{name?}` | |
| | `set_return` | `{return, volume?, pan?, name?}` | |
| **Groove** | `list_grooves` | -- | Available groove templates |
| | `apply_groove` | `{track, slot, groove, amount?}` | |
| **Session** | `get_session_info` | -- | Full state dump |
| | `undo` | -- | |
| | `redo` | -- | |
| **Stems** | `stem_separate` | `{track, slot}` | Triggers stem separation (Live 12+) |
| **Arrangement** | `create_arrangement_clip` | `{track, start, length}` | |
| | `move_arrangement_clip` | `{track, clip_id, start}` | |
| **Subscription** | `subscribe` | `{events: [...]}` | Register for real-time events |
| | `unsubscribe` | `{events: [...]}` | |

### Events (push notifications from Ableton to kbot)

| Event | Data | When |
|-------|------|------|
| `transport_changed` | `{is_playing, tempo, position}` | Play/stop/tempo change |
| `track_added` | `{track, name, type}` | New track created |
| `track_removed` | `{track}` | Track deleted |
| `clip_fired` | `{track, slot}` | Clip starts playing |
| `clip_stopped` | `{track, slot}` | Clip stops |
| `device_param_changed` | `{track, device, param, value}` | Any param automation |
| `meter_update` | `{track, peak_l, peak_r, rms}` | Level metering (opt-in) |

---

## Device 1: kbot-bridge.amxd -- The Core Bridge

### Purpose
Replaces AbletonOSC + kbot_bridge.py entirely. A single M4L Audio Effect dropped on any track (typically Master) that gives kbot full LOM access over WebSocket.

### Max Patcher Structure
```
[node.script kbot-bridge.js @autostart 1]     -- Node for Max: WebSocket server
     |
[js kbot-bridge-lom.js]                       -- Max JavaScript: LOM operations
     |
[live.path]  [live.object]  [live.observer]   -- LOM access objects
     |
[plugout~]                                     -- Audio passthrough (Audio Effect requirement)
```

### Why Two JS Engines

Max for Live has two JavaScript environments:
1. **`js` object** (Max JS / jsui): Runs in Max's main thread. Has direct access to `LiveAPI`, `live.path`, `live.object`. Can manipulate the LOM synchronously. No npm, no `require`, no Node APIs.
2. **`node.script` object** (Node for Max): Runs a full Node.js process. Has `net`, `ws`, `fs`, `require`, npm. Communicates with Max via `maxApi.outlet()` / `maxApi.addHandler()`. Cannot access LOM directly.

Architecture:
- `kbot-bridge.js` (Node for Max) handles networking: WebSocket server, JSON parsing, request routing, response correlation.
- `kbot-bridge-lom.js` (Max JS) handles LOM: receives commands from node.script via Max messages, executes LOM operations, sends results back.

### Node for Max: kbot-bridge.js

See `kbot-bridge/kbot-bridge.js` for full implementation.

Key responsibilities:
- Start WebSocket server on port 9999
- Parse incoming JSON commands
- Route to LOM handler via `maxApi.outlet()`
- Receive LOM results via `maxApi.addHandler()`
- Correlate responses and send back over WebSocket
- Manage event subscriptions and push notifications
- Heartbeat/keepalive for connection health

### Max JS: kbot-bridge-lom.js

See `kbot-bridge/kbot-bridge-lom.js` for full implementation.

Key responsibilities:
- Receive routed commands as Max messages
- Execute LOM operations using `LiveAPI`
- Handle all 40+ actions listed in the protocol table
- Return results as Max messages to node.script
- Set up `live.observer` callbacks for subscribed events

### LOM Paths Used

```javascript
// Song-level
"live_set"                                    // Song object
"live_set tempo"                              // BPM
"live_set is_playing"                         // Transport state
"live_set current_song_time"                  // Playhead position
"live_set clip_trigger_quantization"          // Quantization setting
"live_set tracks N"                           // Track by index
"live_set return_tracks N"                    // Return track by index
"live_set master_track"                       // Master track
"live_set scenes N"                           // Scene by index

// Track-level
"live_set tracks N mixer_device"              // Track mixer
"live_set tracks N mixer_device volume"       // Volume DeviceParameter
"live_set tracks N mixer_device panning"      // Pan DeviceParameter
"live_set tracks N mixer_device sends N"      // Send DeviceParameter
"live_set tracks N devices N"                 // Device on track
"live_set tracks N clip_slots N"              // Clip slot
"live_set tracks N clip_slots N clip"         // Clip in slot
"live_set tracks N mute"                      // Mute state
"live_set tracks N solo"                      // Solo state
"live_set tracks N arm"                       // Arm state
"live_set tracks N name"                      // Track name
"live_set tracks N color_index"               // Track color

// Clip-level
"live_set tracks N clip_slots N clip notes"   // Note access (Live 12+)
"live_set tracks N clip_slots N clip length"  // Clip length
"live_set tracks N clip_slots N clip name"    // Clip name

// Device-level
"live_set tracks N devices N parameters M"    // Device parameter
"live_set tracks N devices N class_name"      // Device type
"live_set tracks N devices N name"            // Device name
"live_set tracks N devices N is_active"       // Enabled state

// Drum Rack specific
"live_set tracks N devices N drum_pads M"     // Drum pad (by note number)
"live_set tracks N devices N drum_pads M chains 0 devices 0"  // Simpler inside pad
"live_set tracks N devices N visible_drum_pads"  // Currently visible pads

// Browser
"live_app browser"                            // Browser access
```

### Error Handling

Every action is wrapped in try/catch. Errors return:
```json
{
  "id": "msg_001",
  "status": "error",
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "No device at index 2 on track 0",
    "action": "get_device_params"
  }
}
```

Error codes:
- `TRACK_NOT_FOUND` -- track index out of range
- `CLIP_NOT_FOUND` -- no clip in slot
- `DEVICE_NOT_FOUND` -- device index out of range
- `PARAM_NOT_FOUND` -- parameter name/index invalid
- `PLUGIN_NOT_FOUND` -- browser search found nothing
- `PAD_NOT_FOUND` -- drum pad note number invalid
- `INVALID_ACTION` -- unknown action name
- `LOM_ERROR` -- generic LOM failure
- `TIMEOUT` -- operation took too long
- `CONNECTION_ERROR` -- WebSocket issue

### Installation

1. Open Ableton Live
2. Drag `kbot-bridge.amxd` onto the Master track
3. The device auto-starts the WebSocket server on port 9999
4. kbot connects automatically when any Ableton tool is invoked

---

## Device 2: kbot-auto-mixer.amxd -- Auto Mix Engine

### Purpose
Sits on the Master track. Continuously analyzes frequency content of all tracks, detects collisions (kick/bass overlap, harsh resonances), and either auto-fixes or reports recommendations to kbot.

### Max Patcher Structure
```
[node.script kbot-auto-mixer.js @autostart 1]
     |
[js kbot-auto-mixer-dsp.js]
     |
[live.observer]  [live.object]     -- Observe track count, device params
     |
[multislider] (optional: visual EQ display)
     |
[plugin~ "Spectrum"] (per-track analysis, internal)
     |
[plugout~]
```

### Architecture

The auto-mixer operates in two modes:

**Passive mode (default):** Monitors and reports mix state to kbot. Does not change anything without permission.

**Active mode:** kbot sends `{"action": "auto_mix", "mode": "active"}` and the device autonomously adjusts EQ, volume, and sidechain.

### Analysis Pipeline

1. **Per-track frequency snapshot.** Uses `live.observer` to watch track meter values. For deeper analysis, reads peak/RMS per frequency band from the track's analyzer device (if present) or requests kbot to insert an EQ Eight for analysis.

2. **Collision detection.** Compares frequency profiles:
   - Kick vs Bass: overlap in 40-120 Hz range -> suggest sidechain or HP bass at kick fundamental
   - Vocals vs instruments: 200-4000 Hz masking -> suggest frequency carving
   - Harsh resonances: peaks > 6dB above neighbors in 2-5 kHz

3. **LUFS monitoring.** Reads master track meter. Targets -14 LUFS (streaming) or -6 LUFS (club). Reports if limiter needs adjustment.

4. **Auto-EQ decisions:**
   - HP filter on every non-bass/kick track at 80-120 Hz
   - Low-mid carving at 200-400 Hz on guitars/keys
   - Presence boost at 2-5 kHz on vocals/leads
   - Air shelf at 10-16 kHz on cymbals/pads

### Communication with kbot

Uses the same WebSocket connection as kbot-bridge (port 9999). Commands are namespaced:

```json
{"id": "m_001", "action": "mixer.analyze", "params": {}}
{"id": "m_002", "action": "mixer.auto_mix", "params": {"mode": "active", "target_lufs": -14}}
{"id": "m_003", "action": "mixer.get_status", "params": {}}
{"id": "m_004", "action": "mixer.suggest_sidechain", "params": {"source": 0, "target": 1}}
```

Response:
```json
{
  "id": "m_001",
  "status": "ok",
  "result": {
    "tracks": [
      {"name": "DRUMS", "peak_freq": 100, "rms": -12.3, "issues": []},
      {"name": "808 BASS", "peak_freq": 55, "rms": -8.1, "issues": ["collision_with_kick_40-120Hz"]},
      {"name": "MELODY", "peak_freq": 880, "rms": -18.2, "issues": ["needs_hp_filter"]},
      {"name": "PAD", "peak_freq": 440, "rms": -22.0, "issues": []}
    ],
    "master_lufs": -11.2,
    "master_peak": -1.8,
    "recommendations": [
      "Sidechain 808 BASS to DRUMS kick (40-120 Hz collision)",
      "Add HP filter at 100 Hz on MELODY",
      "Master is 2.8 dB over -14 LUFS target -- reduce master volume or add limiter"
    ]
  }
}
```

### LOM Paths

```javascript
"live_set tracks N mixer_device volume"              // Read/write volume
"live_set tracks N mixer_device panning"             // Read/write pan
"live_set tracks N devices N parameters M"           // EQ Eight params
"live_set master_track mixer_device volume"           // Master volume
"live_set master_track output_meter_left"             // Master meter L
"live_set master_track output_meter_right"            // Master meter R
"live_set tracks N output_meter_left"                // Track meter L
"live_set tracks N output_meter_right"               // Track meter R
```

---

## Device 3: kbot-drum-loader.amxd -- Smart Drum Rack Loader

### Purpose
Solves the #1 bug: loading samples into specific Drum Rack pads programmatically.

This is a **MIDI Effect** that goes INSIDE a Drum Rack chain. It uses the LOM to directly set `SimplerDevice.sample_file_path` on the Simpler that lives inside each drum pad chain, bypassing `browser.load_item()` entirely.

### The Fix

The core insight from our debugging sessions:

```
browser.load_item()  --> targets the selected TRACK, not the pad  [BROKEN]
browser.hotswap_target  --> read-only, cannot be set              [BROKEN]
SimplerDevice.sample_file_path  --> DIRECTLY sets the sample      [WORKS]
```

Every Drum Rack pad contains a chain, and the default chain contains a Simpler device. We can:
1. Navigate to the pad by note number: `drum_pads N`
2. Access its chain: `chains 0`
3. Access the Simpler: `devices 0`
4. Set `sample_file_path` to an absolute file path

If the pad has no chain yet, we use `insert_chain()` (Live 12.3+) to create one with a Simpler, then set the sample path.

### Max Patcher Structure
```
[js kbot-drum-loader.js]          -- Max JS with LiveAPI access
     |
[live.path "live_set tracks N devices M"]   -- Reference to parent Drum Rack
     |
[midiout]                         -- MIDI passthrough (MIDI Effect requirement)
```

### How It Works

The Max JS `kbot-drum-loader.js` exposes functions callable from the kbot-bridge:

```javascript
// Called by kbot-bridge-lom.js when it receives a drum_loader action
function load_sample(rack_path, pad_note, file_path) {
    // 1. Navigate to the drum rack
    var rack = new LiveAPI(rack_path);

    // 2. Get the specific drum pad by MIDI note
    var pad = new LiveAPI(rack_path + " drum_pads " + pad_note);

    // 3. Check if pad has chains
    var chains = pad.get("chains");
    if (chains.length === 0) {
        // Create a new chain with a Simpler
        // Live 12.3+: rack.call("insert_chain", pad_note);
        // Fallback: pad chains are auto-created when sample is loaded
    }

    // 4. Navigate to the Simpler device inside the pad's chain
    var simpler_path = rack_path + " drum_pads " + pad_note + " chains 0 devices 0";
    var simpler = new LiveAPI(simpler_path);

    // 5. Set the sample file path directly
    simpler.set("sample_file_path", file_path);

    // 6. Verify
    var loaded = simpler.get("sample_file_path");
    return loaded;
}
```

### Communication

Routed through kbot-bridge WebSocket:

```json
{"id": "d_001", "action": "drum.load_sample", "params": {"track": 0, "device": 0, "pad": 36, "path": "/Users/isaac/Music/Ableton/User Library/Samples/kbot-trap-2026/DS_OT_drum_kick_basic.wav"}}
{"id": "d_002", "action": "drum.list_pads", "params": {"track": 0, "device": 0}}
{"id": "d_003", "action": "drum.swap_sample", "params": {"track": 0, "device": 0, "pad": 42, "path": "/path/to/new_hihat.wav"}}
{"id": "d_004", "action": "drum.set_pad_params", "params": {"track": 0, "device": 0, "pad": 36, "volume": 0.8, "pan": 0.0, "tune": -2}}
```

### LOM Paths

```javascript
"live_set tracks N devices M"                              // Drum Rack
"live_set tracks N devices M drum_pads P"                  // Specific pad (P = MIDI note)
"live_set tracks N devices M drum_pads P chains"           // Chains in pad
"live_set tracks N devices M drum_pads P chains 0"         // First chain
"live_set tracks N devices M drum_pads P chains 0 devices" // Devices in chain
"live_set tracks N devices M drum_pads P chains 0 devices 0"                    // Simpler
"live_set tracks N devices M drum_pads P chains 0 devices 0 sample_file_path"   // THE KEY PROPERTY
"live_set tracks N devices M drum_pads P chains 0 mixer_device volume"          // Pad volume
"live_set tracks N devices M drum_pads P chains 0 mixer_device panning"         // Pad pan
"live_set tracks N devices M visible_drum_pads"            // Currently visible pads
```

### Error Handling

- If `sample_file_path` is not a valid property (device is not a Simpler), tries to find any Simpler in the chain's device list
- If path does not exist on disk, returns `FILE_NOT_FOUND` error
- If pad has no chain and `insert_chain` is unavailable, returns `CHAIN_CREATE_FAILED` with instructions to manually add a Simpler to the pad
- Validates MIDI note range (0-127, typical drum pads 36-84)

---

## Device 4: kbot-preset-browser.amxd -- Plugin Preset Control

### Purpose
Lists, loads, and saves presets for any device on the same track. Works with native Ableton devices (which use `.adv` presets in User Library) and VST/AU plugins (which use their own preset format via `presets` property or `store_chosen_preset_by_name()`).

### Max Patcher Structure
```
[js kbot-preset-browser.js]          -- Max JS with LiveAPI
     |
[live.path]  [live.object]
     |
[plugout~]                           -- Audio passthrough
```

### How It Works

**Native Ableton devices:** Use the browser to find presets in the device's category folder, then `browser.load_item()` to load them. Since we're loading onto a device (not a pad), the standard load path works.

**VST/AU plugins:** Use `Device.presets` property (available in Live 12+) which returns a list of preset names. Load via `Device.store_chosen_preset_by_name(name)` or by index via `Device.selected_preset_index`.

```javascript
function list_presets(track_idx, device_idx) {
    var device_path = "live_set tracks " + track_idx + " devices " + device_idx;
    var device = new LiveAPI(device_path);

    var class_name = device.get("class_name").toString();

    // For native devices, presets are files in the browser
    // For VST/AU, check the presets property
    var presets = device.get("presets");
    if (presets && presets.length > 0) {
        return presets;
    }

    // Fallback: check if device has a can_have_chains property (it's a rack)
    // and enumerate presets from browser
    return browse_device_presets(device);
}

function load_preset(track_idx, device_idx, preset_name_or_index) {
    var device_path = "live_set tracks " + track_idx + " devices " + device_idx;
    var device = new LiveAPI(device_path);

    if (typeof preset_name_or_index === "number") {
        device.set("selected_preset_index", preset_name_or_index);
    } else {
        device.call("store_chosen_preset_by_name", preset_name_or_index);
    }
}
```

### Communication

```json
{"id": "p_001", "action": "preset.list", "params": {"track": 0, "device": 0}}
{"id": "p_002", "action": "preset.load", "params": {"track": 0, "device": 0, "preset": "Init Preset"}}
{"id": "p_003", "action": "preset.load", "params": {"track": 0, "device": 0, "preset": 3}}
{"id": "p_004", "action": "preset.save", "params": {"track": 0, "device": 0, "name": "kbot-trap-808"}}
```

### LOM Paths

```javascript
"live_set tracks N devices M"                        // Target device
"live_set tracks N devices M presets"                // Preset list (Live 12+)
"live_set tracks N devices M selected_preset_index"  // Current preset index
"live_set tracks N devices M name"                   // Device name
"live_set tracks N devices M class_name"             // Device class
"live_app browser"                                   // For browsing native presets
```

---

## Device 5: kbot-melody-gen.amxd -- AI Melody Generator

### Purpose
A MIDI Generator device that receives parameters from kbot (key, scale, density, register, genre style) and outputs MIDI notes. Can generate into clips or output in real-time.

### Max Patcher Structure
```
[js kbot-melody-gen.js]            -- Max JS: scale-aware melody generation
     |
[live.path]                        -- Access to clip for write mode
     |
[midiout]                          -- Real-time MIDI output (generator mode)
```

### Generation Modes

**Clip mode:** kbot sends parameters, device writes MIDI notes directly into a clip via LOM.

**Live mode:** Device generates notes in real-time, outputting MIDI to downstream instruments. Responds to transport position.

### Parameters (receivable from kbot)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `root` | string | "C" | Root note name |
| `scale` | string | "natural_minor" | Scale name (from music-theory.ts) |
| `octave` | int | 4 | Base octave |
| `density` | float | 0.5 | Note density (0=sparse, 1=dense) |
| `register` | string | "mid" | low/mid/high -- constrains octave range |
| `length_bars` | int | 4 | How many bars to generate |
| `style` | string | "trap_melody" | Generation algorithm |
| `rhythm` | string | "16th" | Rhythmic subdivision |
| `velocity_curve` | string | "humanize" | flat/accent/humanize/crescendo |
| `note_length` | float | 0.5 | Default note duration in beats |
| `probability` | float | 0.7 | Probability each step has a note |
| `leap_probability` | float | 0.2 | Chance of interval > 3rd |
| `repetition` | float | 0.3 | Chance of repeating previous note |

### Scale System

Uses Live 12's built-in scale system when available, plus the 24 scales from kbot's `music-theory.ts`:

```javascript
var SCALES = {
    "major":            [0, 2, 4, 5, 7, 9, 11],
    "natural_minor":    [0, 2, 3, 5, 7, 8, 10],
    "harmonic_minor":   [0, 2, 3, 5, 7, 8, 11],
    "melodic_minor":    [0, 2, 3, 5, 7, 9, 11],
    "dorian":           [0, 2, 3, 5, 7, 9, 10],
    "phrygian":         [0, 1, 3, 5, 7, 8, 10],
    "lydian":           [0, 2, 4, 6, 7, 9, 11],
    "mixolydian":       [0, 2, 4, 5, 7, 9, 10],
    "minor_pentatonic": [0, 3, 5, 7, 10],
    "major_pentatonic": [0, 2, 4, 7, 9],
    "blues":            [0, 3, 5, 6, 7, 10],
    "chromatic":        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    "whole_tone":       [0, 2, 4, 6, 8, 10],
    "diminished":       [0, 2, 3, 5, 6, 8, 9, 11],
    "hirajoshi":        [0, 2, 3, 7, 8],
    "minor_pentatonic_b5": [0, 3, 5, 6, 10]
};
```

### Generation Algorithms

**`trap_melody`**: Sparse, pentatonic, lots of rests. Occasional 16th-note runs. Octave jumps for emphasis. High repetition of 2-3 note motifs.

**`drill_melody`**: Dark, phrygian/harmonic minor. Sliding patterns. Minor 2nd intervals for tension. Repetitive with slight variations.

**`lofi_melody`**: Jazz-influenced, 7th chords arpeggiated. Swing timing. Low velocity variation. Extended notes.

**`ambient`**: Long sustained notes. Wide intervals. Slow movement. Occasional grace notes.

**`arpeggio`**: Chord tones in sequence. Up, down, up-down, random patterns.

**`random_walk`**: Brownian motion through the scale. Each note is +/- 1-3 scale degrees from previous.

### Communication

```json
{"id": "g_001", "action": "melody.generate", "params": {
    "track": 2, "slot": 0,
    "root": "D", "scale": "natural_minor", "octave": 5,
    "density": 0.4, "style": "trap_melody",
    "length_bars": 4, "velocity_curve": "humanize"
}}

{"id": "g_002", "action": "melody.live_start", "params": {
    "root": "D", "scale": "natural_minor",
    "density": 0.5, "style": "arpeggio"
}}

{"id": "g_003", "action": "melody.live_stop", "params": {}}
```

### LOM Paths

```javascript
"live_set tracks N clip_slots M clip"                    // Target clip
"live_set tracks N clip_slots M clip length"             // Clip length
"live_set tracks N clip_slots M clip notes"              // Note manipulation
// For live mode: MIDI output goes through midiout object, no LOM needed
```

---

## kbot-Side Integration: ableton-ws.ts

The new kbot transport replaces `ableton-osc.ts` for M4L communication.

### Key Differences from OSC Transport

| Feature | ableton-osc.ts (old) | ableton-ws.ts (new) |
|---------|---------------------|---------------------|
| Transport | UDP | WebSocket (TCP) |
| Format | OSC binary | JSON |
| Reliability | Fire-and-forget | Request/response with IDs |
| Booleans | Dropped (was buggy) | Native JSON true/false |
| Batching | One message at a time | Array of commands in one frame |
| Events | Polling | Push notifications via subscribe |
| Reconnect | Manual | Auto-reconnect with backoff |
| Port | 11000/11001 | 9999 |

### Connection Lifecycle

```
1. kbot invokes any ableton_* tool
2. ensureAbleton() checks for active WebSocket connection
3. If not connected, tries ws://localhost:9999
4. If connection fails, falls back to OSC (backward compat with AbletonOSC)
5. On connect, subscribes to transport_changed events
6. Commands flow as JSON request/response
7. On disconnect, auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
```

### Backward Compatibility

The new `ableton-ws.ts` exports the same interface as `ableton-osc.ts`. Existing tools in `ableton.ts` continue to work. The transport layer is swapped transparently:

```typescript
// ableton.ts tools don't change -- ensureAbleton() returns either WS or OSC client
const client = await ensureAbleton();
// client.send() and client.query() work identically
// but WS client also supports:
// client.subscribe('transport_changed', callback)
// client.batch([cmd1, cmd2, cmd3]) -- atomic multi-command
```

---

## Installation

### Automated (install.sh)

```bash
#!/bin/bash
# Copies M4L devices to Ableton User Library
# Run: cd packages/kbot/m4l && bash install.sh

ABLETON_USER_LIB="$HOME/Music/Ableton/User Library"
M4L_PRESETS="$ABLETON_USER_LIB/Presets/Audio Effects/Max Audio Effect"
M4L_MIDI="$ABLETON_USER_LIB/Presets/MIDI Effects/Max MIDI Effect"

# Audio Effects (bridge, auto-mixer, preset-browser)
mkdir -p "$M4L_PRESETS/kbot"
cp kbot-bridge/kbot-bridge.amxd "$M4L_PRESETS/kbot/"
cp kbot-auto-mixer/kbot-auto-mixer.amxd "$M4L_PRESETS/kbot/"
cp kbot-preset-browser/kbot-preset-browser.amxd "$M4L_PRESETS/kbot/"

# MIDI Effects (drum-loader, melody-gen)
mkdir -p "$M4L_MIDI/kbot"
cp kbot-drum-loader/kbot-drum-loader.amxd "$M4L_MIDI/kbot/"
cp kbot-melody-gen/kbot-melody-gen.amxd "$M4L_MIDI/kbot/"

echo "kbot M4L devices installed. Refresh Ableton's browser to see them."
```

### Manual

1. Open Ableton Live 12
2. Navigate to User Library in the browser sidebar
3. Drag each `.amxd` file to the appropriate category folder
4. Drop `kbot-bridge.amxd` on the Master track
5. Other devices go on relevant tracks as needed

### First Run

1. Drop `kbot-bridge.amxd` on any track (Master recommended)
2. The Node for Max script starts automatically
3. Look for "kbot bridge: listening on ws://localhost:9999" in Max Console
4. In kbot CLI: run any `ableton_*` command -- it will auto-connect
5. Verify with: `ableton_session_info`

---

## Device Build Instructions

Since `.amxd` files are binary Max patches, they must be assembled in the Max editor. However, the JavaScript files are the core logic and can be developed, tested, and version-controlled as plain text.

### Build Process

1. Open Ableton Live with Max for Live
2. Create new Max Audio Effect / Max MIDI Effect
3. Add `node.script` object, point to the `.js` file
4. Add `js` object, point to the LOM `.js` file
5. Wire up inlets/outlets as described in each device's patcher structure
6. Save as `.amxd` in the `m4l/` directory
7. The JS files are loaded by reference -- editing them auto-reloads in Max

### Development Workflow

```
1. Edit .js files in your editor
2. Max auto-reloads on save (node.script watches file changes)
3. Test via kbot CLI or direct WebSocket (wscat, websocat)
4. Debug via Max Console window (Cmd+Shift+M in Live)
5. For LOM exploration: use Max's live.path + live.object with bang messages
```

### Testing Without Ableton

The Node for Max scripts can be tested standalone:

```bash
# Test kbot-bridge.js outside Max (WebSocket server still works, LOM calls are stubbed)
node m4l/kbot-bridge/kbot-bridge.js --standalone

# Test melody generation
node -e "require('./m4l/kbot-melody-gen/kbot-melody-gen-standalone.js').generate({root:'D',scale:'natural_minor',bars:4})"
```

---

## Migration Path

### Phase 1: kbot-bridge (replaces AbletonOSC)
- Build and install kbot-bridge.amxd
- Write ableton-ws.ts with OSC fallback
- All existing ableton.ts tools work unchanged
- Remove kbot_bridge.py from AbletonOSC directory

### Phase 2: kbot-drum-loader (fixes sample loading)
- Build kbot-drum-loader.amxd
- Update ableton_load_sample and ableton_build_drum_rack to use drum.load_sample action
- Verify with Splice samples from kbot-trap-2026 folder

### Phase 3: kbot-preset-browser + kbot-auto-mixer
- Build both devices
- Add new tools: ableton_preset, ableton_auto_mix
- Integrate into producer-engine.ts for one-shot beat production

### Phase 4: kbot-melody-gen
- Build melody generator
- Integrate into producer-engine.ts melody track generation
- Replace current note-by-note generation with batch generation

### Phase 5: Remove AbletonOSC dependency
- Remove ableton-osc.ts (or keep as legacy fallback)
- Remove kbot_bridge.py
- All communication goes through M4L WebSocket
- Remove AbletonOSC from Control Surface preferences
