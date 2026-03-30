# Max for Live: Complete Capabilities Reference
## The Definitive Guide for Building AI-Controlled Music Production Systems
### Compiled March 2026 -- K:BOT Project

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Max/MSP Object Categories](#2-maxmsp-object-categories)
3. [Gen~ (Compiled DSP)](#3-gen-compiled-dsp)
4. [Node for Max](#4-node-for-max)
5. [JavaScript / V8 in M4L](#5-javascript--v8-in-m4l)
6. [MC (Multi-Channel Audio)](#6-mc-multi-channel-audio)
7. [Live API Deep Dive](#7-live-api-deep-dive)
8. [Live Object Model (LOM) Complete Reference](#8-live-object-model-lom-complete-reference)
9. [MIDI Generators and Transformations](#9-midi-generators-and-transformations)
10. [Audio Analysis](#10-audio-analysis)
11. [Hardware Integration](#11-hardware-integration)
12. [Jitter (Video/Visuals)](#12-jitter-videovisuals)
13. [RNBO (Code Export)](#13-rnbo-code-export)
14. [Community Ecosystem](#14-community-ecosystem)
15. [Performance and Limitations](#15-performance-and-limitations)
16. [AI-Powered M4L Possibilities](#16-ai-powered-m4l-possibilities)

---

## 1. Architecture Overview

Max for Live (M4L) is a full implementation of Cycling '74's Max visual programming environment embedded inside Ableton Live. It is not a simplified version -- it includes the complete Max, MSP (audio), and Jitter (video/matrix) environments with additional objects specific to Live integration.

### Three Device Types

| Type | What It Does | File Extension |
|------|-------------|----------------|
| **Audio Effect** | Processes audio on a track | `.amxd` |
| **MIDI Effect** | Processes/generates MIDI before an instrument | `.amxd` |
| **Instrument** | Generates audio from MIDI input | `.amxd` |

Plus two MIDI Tool types (Live 12+):
- **MIDI Generator** -- creates notes from scratch in a clip
- **MIDI Transformation** -- modifies existing notes in a clip

### Programming Environments Inside M4L

| Environment | Thread | LOM Access | Audio | npm | Use Case |
|-------------|--------|-----------|-------|-----|----------|
| **Max patcher** | Main + Audio | Yes (via live.* objects) | Yes (MSP) | No | Visual patching, signal flow |
| **Gen~** | Audio (compiled) | No | Yes (sample-level) | No | Custom DSP, filters, oscillators |
| **js / v8 (JavaScript)** | Main (deferred) | Yes (LiveAPI class) | No | No | LOM scripting, data processing |
| **node.script (Node for Max)** | Separate process | **No** | No | **Yes** | Networking, ML, file I/O, APIs |
| **Jitter** | Main + GPU | No | No | No | Video, OpenGL, matrix math |

### Communication Flow for AI Control

```
kbot (Node.js)
   |
   | WebSocket (TCP, JSON, bidirectional)
   v
node.script (Node for Max)          -- Full Node.js, npm, networking
   |
   | maxApi.outlet() / addHandler()  -- Max message passing
   v
js object (Max JavaScript)           -- LiveAPI class, LOM access
   |
   | live.path / live.object / live.observer
   v
Ableton Live (Live Object Model)     -- Tracks, clips, devices, transport
```

---

## 2. Max/MSP Object Categories

Max/MSP provides **200+ MSP audio objects** and hundreds more for data, MIDI, UI, and control. Here is the complete functional breakdown.

### 2.1 Synthesis (Oscillators & Generators)

| Object | Function |
|--------|----------|
| `cycle~` | Cosine/sine wave oscillator (wavetable) |
| `saw~` | Anti-aliased sawtooth oscillator |
| `rect~` | Anti-aliased square/rectangle wave |
| `tri~` | Anti-aliased triangle wave |
| `phasor~` | Sawtooth ramp (0 to 1), master phase source |
| `noise~` | White noise generator |
| `pink~` | Pink (1/f) noise generator |
| `click~` | Single-sample impulse generator |
| `train~` | Pulse train generator |
| `ioscbank~` | Incremental oscillator bank (additive synthesis) |
| `oscbank~` | Oscillator bank (additive synthesis) |
| `kink~` | Waveshaping via piecewise linear transfer |

### 2.2 Filters

| Object | Function |
|--------|----------|
| `biquad~` | General-purpose biquad filter (LP, HP, BP, notch, allpass, peaking, shelving) |
| `svf~` | State-variable filter (simultaneous LP/HP/BP/notch outputs) |
| `lores~` | Resonant lowpass filter |
| `onepole~` | Simple one-pole lowpass/highpass |
| `reson~` | Resonant bandpass filter |
| `allpass~` | Allpass filter (phase shifting) |
| `comb~` | Comb filter (feedforward + feedback) |
| `teeth~` | Comb filter bank |
| `hilbert~` | Hilbert transform (90-degree phase shift for frequency shifting) |
| `cross~` | Crossover filter (splits into low and high bands) |
| `cascade~` | Cascaded biquad filter (sharper rolloff) |
| `buffir~` | FIR filter using buffer~ as impulse response (convolution) |
| `fffb~` | Fast fixed filter bank (parallel bandpass array) |
| `filtercoeff~` | Generate biquad coefficients from parameters |
| `slide~` | Logarithmic envelope follower / smoothing filter |
| `phaseshift~` | Allpass-based phase shifter |

### 2.3 Delays

| Object | Function |
|--------|----------|
| `tapin~` / `tapout~` | Delay line pair (write/read, multiple taps) |
| `delay~` | Simple signal delay (integer samples) |

### 2.4 Dynamics Processing

| Object | Function |
|--------|----------|
| `omx.comp~` | Compressor |
| `omx.peaklim~` | Peak limiter |
| `omx.4band~` | 4-band compressor |
| `omx.5band~` | 5-band compressor |
| `overdrive~` | Soft-clipping distortion |
| `clip~` | Hard clipping |
| `normalize~` | Normalize signal level |

### 2.5 FFT / Spectral Processing

| Object | Function |
|--------|----------|
| `fft~` / `ifft~` | Forward/inverse FFT |
| `pfft~` | Patching environment for spectral processing (hosts sub-patches operating in frequency domain) |
| `fftin~` / `fftout~` | FFT I/O inside pfft~ |
| `cartopol~` / `poltocar~` | Cartesian-to-polar and polar-to-cartesian conversion |
| `gizmo~` | Spectral pitch shifter (inside pfft~) |
| `fbinshift~` | Spectral bin shifting |
| `frameaccum~` | Running sum of FFT frames |
| `frameaverage~` | Average over FFT frames |
| `framedelta~` | Difference between FFT frames |
| `framesmooth~` | Smoothing across FFT frames |
| `fftinfo~` | FFT size/hop/window info |
| `vectral~` | Spectral cross-fade/morphing |
| `phasewrap~` | Wrap phase values to -pi/pi range |

### 2.6 Sampling / Buffer Operations

| Object | Function |
|--------|----------|
| `buffer~` | Audio sample storage (the fundamental sample container) |
| `polybuffer~` | Manage multiple buffer~ objects as a collection |
| `groove~` | Variable-speed playback with loop points |
| `play~` | Simple sample playback |
| `wave~` | Wavetable lookup (buffer as waveshaper/oscillator) |
| `2d.wave~` | 2D wavetable interpolation |
| `index~` | Non-interpolating buffer lookup |
| `lookup~` | Interpolating buffer lookup (waveshaping) |
| `peek~` | Read/write buffer values at message rate |
| `poke~` | Write into buffer at signal rate |
| `record~` | Record signal into buffer |
| `info~` | Buffer metadata (length, channels, sample rate) |
| `stutter~` | Glitch/stutter effect on buffer playback |
| `chucker~` | Chunk-based buffer playback |
| `sfplay~` / `sfrecord~` | Stream audio files from/to disk |
| `sflist~` | Manage multiple soundfile cue points |
| `sfinfo~` | Soundfile metadata |

### 2.7 Analysis / Metering

| Object | Function |
|--------|----------|
| `snapshot~` | Sample signal value at intervals |
| `peakamp~` | Peak amplitude tracker |
| `meter~` | Level meter (UI) |
| `levelmeter~` | Multi-segment level meter (UI) |
| `scope~` | Oscilloscope display |
| `spectroscope~` | Real-time spectrum analyzer display |
| `number~` | Display signal value as number |
| `fzero~` | Fundamental frequency estimator |
| `edge~` | Signal-to-bang converter (zero crossing) |
| `change~` | Detect signal value changes |
| `count~` | Sample counter |
| `zerox~` | Zero-crossing rate |
| `thresh~` | Signal threshold detector (hysteresis) |
| `minimum~` / `maximum~` | Running min/max tracker |
| `minmax~` | Combined min and max |
| `capture~` | Capture signal values to text |
| `spike~` | Detect spikes in signal |
| `sync~` | Detect zero crossings in phasor-like signals |
| `loudness~` | **EBU R 128 loudness meter (LUFS)** -- momentary, short-term, integrated |

### 2.8 Routing / Mixing

| Object | Function |
|--------|----------|
| `selector~` | Signal selector (N inputs to 1 output) |
| `gate~` | Signal gate (1 input to N outputs) |
| `matrix~` | NxM signal routing matrix with crossfade |
| `send~` / `receive~` | Wireless signal connections (within a patch; NOT between M4L devices) |

### 2.9 Math / Signal Operators

Full set of signal-rate math: `+~`, `-~`, `*~`, `/~`, `%~`, `!-~` (reverse subtract), `!/~` (reverse divide), `abs~`, `sqrt~`, `pow~`, `log~`, `exp~`, `sin~`, `cos~`, `tan~`, `asin~`, `acos~`, `atan~`, `atan2~`, `sinh~`, `cosh~`, `tanh~`, `round~`, `trunc~`, `avg~`, `average~`, `bitand~`, `bitor~`, `bitxor~`, `bitnot~`, `bitshift~`, `atodb~`, `dbtoa~`, `ftom~`, `mtof~`.

### 2.10 Polyphony

| Object | Function |
|--------|----------|
| `poly~` | Polyphonic voice manager (hosts a sub-patch per voice) |
| `thispoly~` | Query/control individual voice inside poly~ |
| `in~` / `out~` | Signal I/O for poly~ sub-patches |
| `in` / `out` | Message I/O for poly~ sub-patches |

### 2.11 Functions / Envelopes

| Object | Function |
|--------|----------|
| `adsr~` | ADSR envelope generator |
| `curve~` | Exponential ramp generator |
| `line~` | Linear ramp generator |
| `function` | Breakpoint function editor (UI) |
| `trapezoid~` | Trapezoidal envelope |
| `triangle~` | Triangle envelope |
| `zigzag~` | Phase-driven function playback |
| `techno~` | Pattern-based gate/envelope |
| `rand~` | Random signal generator |

### 2.12 UI Objects

| Object | Function |
|--------|----------|
| `filtergraph~` | Interactive filter display and control |
| `waveform~` | Waveform display with selection |
| `spectroscope~` | Spectrum analyzer |
| `scope~` | Oscilloscope |
| `gain~` | Gain fader with signal I/O |
| `meter~` | VU meter |
| `number~` | Signal value display |
| `plot~` | XY plotter |
| `zplane~` | Z-plane pole/zero display |
| `ezadc~` / `ezdac~` | Quick audio I/O toggles |

### 2.13 Live-Specific UI Objects

These are mandatory for M4L devices (they integrate with Live's parameter system):

| Object | Function |
|--------|----------|
| `live.dial` | Rotary dial (automatable, saveable) |
| `live.slider` | Linear slider |
| `live.numbox` | Number box |
| `live.menu` | Dropdown menu |
| `live.tab` | Tab selector |
| `live.text` | Toggle/momentary button with text |
| `live.toggle` | On/off toggle |
| `live.button` | Momentary button |
| `live.gain~` | Gain fader with level meter |
| `live.meter~` | Level meter |
| `live.scope~` | Mini oscilloscope |
| `live.grid` | Step sequencer grid |
| `live.step` | Pattern step editor |
| `live.arrows` | Navigation arrows |
| `live.banks` | Bank selector |
| `live.comment` | Text label |
| `live.line` | Decorative line |
| `live.colors` | Color swatch |

### 2.14 Data Structures

| Object | Function |
|--------|----------|
| `dict` | JSON-like hierarchical dictionary (fast, supports nesting) |
| `coll` | Indexed collection (key-value, any data type, saveable) |
| `table` | Integer array with graphical editor |
| `buffer~` | Audio sample data (also usable as numeric array) |
| `funbuff` | Function/breakpoint table |
| `preset` | Store/recall object states |
| `pattr` | Named parameter for state management |
| `pattrstorage` | Centralized preset storage for entire patcher hierarchy |
| `pattrhub` | Query/manage pattr bindings |
| `bag` | Unordered collection of numbers |
| `borax` | MIDI note statistics tracker |

### 2.15 Timing Objects

| Object | Function |
|--------|----------|
| `metro` | Regular bang generator (ms or tempo-relative) |
| `clocker` | Elapsed time reporter |
| `delay` | Single-shot delay (message rate) |
| `pipe` | Multi-value delay with independent timing |
| `transport` | Global tempo/beat clock (syncs to Live's transport) |
| `timer` | Measure time between events |
| `timepoint` | Bang at specific bar/beat position |
| `when` | Report current transport time |
| `tempo` | Tempo-to-ms conversion |
| `translate` | Convert between time formats (ms, hz, bars, ticks, samples) |

### 2.16 MIDI Objects

| Object | Function |
|--------|----------|
| `midiin` / `midiout` | Raw MIDI byte I/O |
| `notein` / `noteout` | MIDI note messages |
| `ctlin` / `ctlout` | MIDI CC messages |
| `pgmin` / `pgmout` | Program change |
| `bendin` / `bendout` | Pitch bend |
| `touchin` / `touchout` | Channel pressure |
| `polyin` / `polyout` | Polyphonic aftertouch |
| `midiin` / `midiout` | Raw MIDI |
| `midiparse` / `midiformat` | Parse/construct MIDI bytes |
| `seq` | MIDI file sequencer/recorder |
| `follow` | Score follower |
| `borax` | MIDI note analysis (voices, durations, velocities) |
| `stripnote` | Remove note-offs |
| `makenote` | Add note-offs to note-ons |
| `sustain` | MIDI sustain pedal emulation |
| `flush` | Send all-notes-off |
| `kslider` | Piano keyboard display/input |
| `ddg.mono` | Monophonic voice allocation |

### 2.17 Network Objects

| Object | Function |
|--------|----------|
| `udpsend` / `udpreceive` | UDP (OSC-formatted) network I/O |
| `mxj net.tcp.send` / `mxj net.tcp.recv` | TCP networking (Java) |
| `serial` | Serial port communication (Arduino, Teensy, etc.) |
| `maxurl` | HTTP requests (GET/POST) |
| Node for Max | WebSocket, HTTP server, TCP, any npm networking |

**Note:** Integrated OSC support is disabled in M4L, but `udpsend`/`udpreceive` work for raw OSC.

---

## 3. Gen~ (Compiled DSP)

Gen~ is a **compiled DSP sub-language** inside Max that operates at the **single-sample level**. It is the most powerful DSP tool in Max for Live.

### Why Gen~ Matters

1. **Single-sample feedback loops** -- Impossible in regular MSP (which operates on vectors/blocks of 64-512 samples). Gen~ can do Z^-1 (single-sample delay) via the `history` operator.
2. **Compiled to native machine code** -- Gen~ transparently compiles your patch to optimized C/assembly at runtime. A chain of Gen objects becomes one meta-object with zero inter-object overhead.
3. **64-bit double precision** -- All internal calculations use doubles.
4. **No block-size artifacts** -- Everything is sample-accurate.
5. **GenExpr language** -- Full textual programming with `if/else`, `for`, `while`, functions.

### What Gen~ Can Do That MSP Cannot

| Capability | MSP | Gen~ |
|-----------|-----|------|
| Single-sample feedback (Z^-1) | No (minimum = vector size) | **Yes** (history operator) |
| Custom filter topologies | Limited to existing objects | **Arbitrary** -- build any filter from scratch |
| Physical modeling (waveguides) | Requires workarounds | **Native** -- short delay feedback networks |
| Sample-accurate timing | No (quantized to vector) | **Yes** |
| Custom oscillators | Use existing objects | **Build from scratch** at sample level |
| Inline math expressions | No | **Yes** (codebox / GenExpr) |
| Loops and conditionals | No (data flow only) | **Yes** (for, while, if/else) |
| Code export to C/C++ | No | **Yes** (standalone Gen~; disabled in M4L) |

### Complete Gen~ Operator Categories

**Buffer Operations:** `buffer`, `channels`, `cycle`, `data`, `dim`, `lookup`, `nearest`, `peek`, `poke`, `sample`, `splat`, `wave`

**Delay/Feedback:** `delay` (variable, multi-tap, configurable interpolation: none/linear/cosine/cubic/spline), `history` (the critical Z^-1 operator)

**Conversion:** `atodb`, `dbtoa`, `ftom`, `mtof`, `mstosamps`, `sampstoms`

**Waveform Generation:** `phasor`, `rate`, `train`, `triangle`

**Filtering:** `change`, `dcblock`, `delta`, `interp`, `latch`, `phasewrap`, `sah`, `slide`

**Integrators:** `accum` (+=), `mulequals` (*=), `counter`

**FFT Constants:** `samplerate`, `vectorsize`, `fftsize`, `ffthop`, `fftoffset`, `fftfullspect`

**Utilities:** `fixdenorm`, `fixnan`, `isdenorm`, `isnan`, `t60`, `t60time`, `elapsed`, `mc_channel`, `mc_channelcount`, `voice`, `voicecount`

**Full math suite:** All standard arithmetic, trigonometric, hyperbolic, comparison, logical, and bitwise operators.

### GenExpr Language

```genexpr
// Example: Custom resonant lowpass filter at sample level
History x1, x2, y1, y2;
Param cutoff(1000), resonance(0.7);

omega = 2 * pi * cutoff / samplerate;
alpha = sin(omega) / (2 * resonance);
b0 = (1 - cos(omega)) / 2;
b1 = 1 - cos(omega);
b2 = b0;
a0 = 1 + alpha;
a1 = -2 * cos(omega);
a2 = 1 - alpha;

out1 = (b0/a0)*in1 + (b1/a0)*x1 + (b2/a0)*x2 - (a1/a0)*y1 - (a2/a0)*y2;
x2 = x1; x1 = in1;
y2 = y1; y1 = out1;
```

### Physical Modeling with Gen~

Gen~ is ideal for physical modeling because it supports:
- **Digital waveguides** -- delay line networks with filter feedback (Karplus-Strong strings, waveguide brass/woodwind models)
- **Modal synthesis** -- parallel resonant filters excited by impulses
- **Mass-spring networks** -- via the mi-gen library (mass-interaction modeling)
- **Feedback FM synthesis** -- operator feedback loops at sample rate
- **Bowed string / reed models** -- nonlinear excitation + resonator

### Gen~ Jitter Variants

| Object | Domain | Runs On | Use Case |
|--------|--------|---------|----------|
| `gen~` | Audio (sample-rate) | CPU | Custom DSP |
| `jit.gen` | Matrix (any dimension) | CPU | Image/data processing |
| `jit.pix` | Video (4-plane RGBA) | CPU | Video effects |
| `jit.gl.pix` | Texture (4-plane RGBA) | **GPU** | GPU-accelerated video/shaders |

---

## 4. Node for Max

Node for Max embeds a **full Node.js runtime** (currently v20.6) inside Max, running as a separate process controlled by the `node.script` object.

### What Node for Max CAN Do

| Capability | Details |
|-----------|---------|
| **Full npm ecosystem** | Install and use ANY npm package |
| **WebSocket server/client** | Real-time bidirectional communication (our kbot-bridge uses this) |
| **HTTP server** | Run Express, Fastify, or any HTTP framework inside Ableton |
| **TCP/UDP networking** | Raw socket communication |
| **File system access** | Read/write files, watch directories, stream audio files |
| **Child processes** | Spawn external programs, run Python scripts, shell commands |
| **Machine learning** | TensorFlow.js, ONNX Runtime, brain.js, ml5.js |
| **Database access** | SQLite, PostgreSQL, MongoDB, Redis clients |
| **API calls** | HTTP/REST/GraphQL to any external service |
| **Computer vision** | MediaPipe (hand tracking, face mesh, pose estimation) |
| **Data visualization** | D3.js, generate SVGs/images |
| **Real-time data** | WebSocket clients for market data, sensor streams, etc. |
| **Electron apps** | Run full GUI applications alongside Max |
| **QR code generation** | Via npm packages |
| **Sentiment analysis** | NLP processing |
| **JSON/XML parsing** | Complex data manipulation |
| **Crypto/hashing** | Node.js crypto module |

### What Node for Max CANNOT Do

| Limitation | Workaround |
|-----------|------------|
| **No LiveAPI access** | Use `js` or `v8` object as intermediary; Node sends commands via `maxApi.outlet()`, js object executes LOM operations |
| **No audio signal processing** | Audio must flow through MSP/Gen~ objects; Node handles control data only |
| **No synchronous Live interaction** | Node runs asynchronously in separate process; cannot be used in MIDI Tools |
| **No direct Max UI** | Can send data to Max UI objects via messages |

### Node for Max API

```javascript
const maxAPI = require("max-api");

// Receive messages from Max
maxAPI.addHandler("my_command", (arg1, arg2) => {
    // Process command
    maxAPI.outlet("result", processedData);
});

// Send to Max console
maxAPI.post("Hello from Node", maxAPI.POST_LEVELS.INFO);

// Work with Max dictionaries
const data = await maxAPI.getDict("my_dict");
await maxAPI.setDict("my_dict", { key: "value" });
await maxAPI.updateDict("my_dict", { nested: { update: true } });

// Outlet a bang
maxAPI.outletBang();
```

### Community Examples

- **PoseNet** -- Real-time human pose estimation from webcam
- **MediaPipe Handpose/Facemesh** -- Hand tracking, face landmarks
- **Node LOM** -- Manipulate Live sessions from Node (via js intermediary)
- **YouTube streaming** -- Stream video into Max
- **D3.js visualizations** -- Data-driven graphics
- **Sentiment analysis** -- Text analysis in Max patches

---

## 5. JavaScript / V8 in M4L

Max has two JavaScript engines: the legacy `js` object (SpiderMonkey, ES5) and the modern `v8` object (V8 engine, ES2022). Both can access the LiveAPI.

### js vs v8 Object Comparison

| Feature | `js` (legacy) | `v8` (Max 9 / Live 12.2+) |
|---------|--------------|---------------------------|
| Engine | SpiderMonkey (ES5) | V8 (ES2022) |
| async/await | No | **Yes** |
| Promises | No | **Yes** |
| Arrow functions | No | **Yes** |
| Template literals | No | **Yes** |
| Classes | No | **Yes** |
| Destructuring | No | **Yes** |
| for...of | No | **Yes** |
| Modules | No | **Yes** |
| Performance | Slower | **Significantly faster** |
| UI variant | `jsui` | `v8ui` |
| LiveAPI | Yes (LiveAPI class) | Yes (LiveAPI class) |
| File I/O | Limited (Max File object) | Yes |
| Drawing API | Sketch API (jsui) | Drawing context (v8ui) |

### The LiveAPI Class (Available in Both)

```javascript
// Constructor
var api = new LiveAPI([callback], [path_or_id]);

// Properties
api.id          // Current object ID (dynamic, session-specific)
api.path        // Quoted canonical path ("live_set tracks 0")
api.unquotedpath // Unquoted path
api.children    // Array of child names
api.type        // Object type per LOM
api.info        // Complete description
api.mode        // 0 = follow identity, 1 = follow position
api.property    // Currently observed property
api.proptype    // Type of observed property

// Methods
api.get("property_name")        // Get property value
api.getstring("property_name")  // Get as string
api.set("property_name", value) // Set property value
api.call("function_name", args) // Call LOM function
api.goto("path")                // Navigate to path
api.getcount("child_name")      // Count children
```

### Critical Constraints

1. **Cannot be created in global code** -- must wait for `live.thisdevice` bang signaling device is loaded
2. **Cannot run in high-priority thread** -- use `defer` or `deferlow` for thread safety
3. **Changes cannot be triggered by notifications** -- if an observed property changes and you want to change something else in response, you must `deferlow` the change
4. **IDs are session-specific** -- never persist IDs between sessions; use paths

### Sketch Drawing API (jsui / v8ui)

The `jsui` and `v8ui` objects allow custom UI drawing with a Canvas-like API:

```javascript
// v8ui example
function paint() {
    var g = mgraphics;
    g.set_source_rgba(0.2, 0.4, 0.8, 1.0);
    g.rectangle(0, 0, width, height);
    g.fill();

    g.set_source_rgba(1, 1, 1, 1);
    g.set_font_size(12);
    g.move_to(10, 20);
    g.show_text("Custom UI");
}
```

This enables fully custom UI elements -- waveform displays, XY pads, spectrograms, node graphs, or any visualization.

---

## 6. MC (Multi-Channel Audio)

MC (Multi-Channel) wraps **multiple audio channels into a single patchcord**, enabling massive polyphony, spatialization, and parallel processing.

### Core Concept

Instead of patching 64 separate `cycle~` objects for a synth, you patch one `mc.cycle~` and set its channel count to 64. Every downstream MC object automatically processes all 64 channels.

### MC Object Categories

**Audio I/O:**
- `mc.adc~` / `mc.dac~` -- Multi-channel audio input/output
- `mc.vst~` / `mc.amxd~` -- Multi-channel VST/M4L hosting

**Signal Manipulation:**
- `mc.pack~` / `mc.unpack~` -- Merge/split individual signals
- `mc.combine~` -- Merge multiple MC signals
- `mc.separate~` -- Split MC signal by channel index
- `mc.interleave~` / `mc.deinterleave~` -- Reorganize channel order
- `mc.resize~` -- Change channel count (up/down-mix)
- `mc.dup~` -- Duplicate single channel across N channels

**Mixing & Routing:**
- `mc.mixdown~` -- Mix N channels to stereo with panning
- `mc.selector~` / `mc.gate~` -- MC routing
- `mc.target` / `mc.targetlist` -- Send messages to specific channels

**Processing:**
- Any MSP object prefixed with `mc.` processes per-channel
- `mc.degrade~` -- Per-channel quality reduction
- `mc.evolve~` / `mc.gradient~` -- Generate varying parameters across channels

**Voice Management:**
- `mc.noteallocator~` -- MIDI-to-voice allocation for polyphonic synthesis

**Info:**
- `mc.channelcount~` -- Report number of channels

### What MC Enables

1. **Massive polyphony** -- 128+ voice synths with a single patchcord
2. **Spectral processing** -- mc.fft~ operates on many frequency bands simultaneously
3. **Ambisonics** -- `mc.ambiencode~` / `mc.ambidecode~` for 3D spatial audio
4. **Speaker arrays** -- Route to any number of outputs for immersive installations
5. **Additive synthesis** -- Hundreds of partials, each an MC channel
6. **Granular synthesis** -- Each grain as an MC channel

### MC Limitation in M4L

**User connections prohibited** -- you cannot manually drag MC patchcords in M4L. Only runtime-created (scripted) MC connections work. This means MC patches must be fully wired programmatically or pre-built.

---

## 7. Live API Deep Dive

The Live API gives M4L devices programmatic control over nearly every aspect of Ableton Live through four core objects.

### Core Objects

| Object | Function | Thread |
|--------|----------|--------|
| `live.path` | Navigate the LOM hierarchy, find objects by path | Main |
| `live.object` | Get/set properties, call functions on LOM objects | Main |
| `live.observer` | Watch properties for changes (push notifications) | Main |
| `live.remote~` | Control DeviceParameter at **signal rate** (audio thread) | Audio |

### live.remote~ (Signal-Rate Parameter Control)

This is uniquely powerful: `live.remote~` lets you modulate ANY device parameter at audio rate with sample-accurate timing and configurable smoothing.

- Input: signal (0.0-1.0 in normalized mode) or raw value
- Smoothing: configurable ramp time for temporal downsampling
- Latency: exactly one audio buffer (predictable)
- Does NOT affect undo history or record automation

This means an M4L device can be an **LFO, envelope follower, or AI-driven modulator** controlling any parameter in any device on any track at audio rate.

### What You CAN Control via the Live API

| Category | Capabilities |
|----------|-------------|
| **Transport** | Start, stop, continue, tempo (20-999 BPM), time signature, loop on/off, loop start/length, metronome, overdub, record, tap tempo, jump to cue points, nudge up/down, Ableton Link |
| **Tracks** | Create audio/MIDI/return tracks, delete tracks, duplicate tracks, rename, recolor, arm, solo, mute, fold groups, set input/output routing, read meters (peak L/R, RMS), get performance impact |
| **Clips (Session)** | Create MIDI clips, create audio clips from file, delete, fire, stop, duplicate, crop, quantize, set loop points/start marker/end marker, set warp mode/pitch/gain, mute |
| **Clips (Arrangement)** | Duplicate clip to arrangement, access arrangement clips list, get start/end times |
| **MIDI Notes** | Add notes (pitch, start, duration, velocity, probability, velocity deviation), get all notes, get notes by region, get notes by ID, modify notes, remove notes, select/deselect, duplicate region |
| **Devices** | Access all devices on any track, get/set any parameter by index or name, enable/disable, move devices between tracks, access VST/AU plugin parameters |
| **Mixer** | Volume, pan, crossfader assignment, sends (all as DeviceParameter objects) |
| **Scenes** | Create, delete, duplicate, fire, set name/color |
| **Cue Points** | Create/delete, set name/time/color, jump to next/prev |
| **Groove** | Access groove pool, set base/quantization/random/timing/velocity amounts |
| **Views** | Switch views, follow song, draw mode, select track/scene/clip/device/chain, show/hide views, zoom, scroll |
| **Application** | Get version, CPU usage, press dialog buttons, toggle browser |
| **Tuning System** | Set name, reference pitch, note tunings, pseudo-octave |
| **Undo/Redo** | Trigger undo/redo, check can_undo/can_redo |
| **Capture MIDI** | Trigger capture to session or arrangement |
| **Stem Separation** | Accessible via API (Live 12.3+) |

### What You CANNOT Do from M4L

| Limitation | Details |
|-----------|---------|
| **Load M4L devices programmatically** | `Track.insert_device` works only for built-in devices, not presets or M4L devices |
| **Load samples into Simpler by file path** | No `set sample_path` -- Sample Selector is numeric (0-127), not file-path based. Workarounds exist (browser hotswap hack, drag simulation) but are fragile |
| **Create MIDI clips in Arrangement View directly** | Must create in Session, then `duplicate_clip_to_arrangement` |
| **Access browser contents** | Browser is read-only; cannot enumerate or search programmatically |
| **Send SysEx or Program Changes** | MIDI output limited to what Live passes between devices |
| **Control other M4L device internals** | Cannot reach into another M4L device's patcher |
| **True multi-channel audio** | Device I/O limited to stereo (2 channels in, 2 out) despite MSP supporting 512 |
| **Audio send~/receive~ between devices** | Explicitly not supported |
| **Save Gen~ patches** | Can load and run, but cannot author/save (M4L limitation) |

### M4L vs MIDI Remote Scripts

| Feature | M4L | Remote Script (Python) |
|---------|-----|----------------------|
| Audio processing | **Yes** (MSP/Gen~) | No |
| Custom UI | **Yes** (live.* objects, jsui) | No (Push display only) |
| Access to LOM | Yes (same LOM) | Yes (same LOM) |
| Clip grid observation | Via live.observer | **More efficient** (permanent watchers) |
| Session-wide control | Must be on a track | **Global** (runs at app level) |
| SysEx support | No | **Yes** |
| Control surface protocol | No | **Yes** (bidirectional feedback to hardware) |
| npm/networking | **Yes** (Node for Max) | No |
| Persistence | Saved with Live Set | Installed system-wide |
| User installable | **Yes** (drag and drop) | Requires file system access |

---

## 8. Live Object Model (LOM) Complete Reference

The LOM is a tree of objects that represents the entire state of Ableton Live. Every class, property, and function is listed below.

### Class Hierarchy

```
Application
  └── Application.View
Song (live_set)
  ├── Track[] (tracks, return_tracks, visible_tracks, master_track)
  │   ├── ClipSlot[]
  │   │   └── Clip
  │   │       └── Clip.View
  │   ├── Clip[] (arrangement_clips)
  │   ├── Device[]
  │   │   ├── DeviceParameter[]
  │   │   └── Device.View
  │   ├── MixerDevice
  │   │   └── DeviceParameter[] (volume, panning, sends, crossfader)
  │   ├── Track.View
  │   └── (group_track reference)
  ├── Scene[]
  ├── CuePoint[]
  ├── GroovePool
  │   └── Groove[]
  ├── TuningSystem
  └── Song.View
RackDevice (extends Device)
  ├── Chain[]
  │   ├── Device[]
  │   ├── MixerDevice
  │   └── Chain.View
  └── DrumPad[] (drum racks only)
```

### Device-Specific Classes

These extend `Device` with additional properties and functions:

| Class | What It Wraps | Key Extras |
|-------|--------------|------------|
| `SimplerDevice` | Simpler instrument | `sample` child (Sample object), `playback_mode` (classic/one-shot/slicing), `voices`, `retrigger`, `pad_slicing`, `crop()`, `reverse()`, `warp_as()`, `warp_double()`, `warp_half()`, `guess_playback_length()`, `playing_position` |
| `SimplerDevice.View` | Simpler display | Zoom and display controls |
| `Sample` | Loaded sample in Simpler | `file_path` (read-only), `length`, sample metadata |
| `WavetableDevice` | Wavetable instrument | Oscillator/filter/modulation parameters |
| `Eq8Device` | EQ Eight | 8-band parametric EQ parameters |
| `Eq8Device.View` | EQ Eight display | Display mode controls |
| `CompressorDevice` | Compressor | Threshold, ratio, attack, release, knee |
| `RoarDevice` | Roar (saturation/distortion) | Drive parameters |
| `MeldDevice` | Meld (hybrid synth) | Synthesis parameters |
| `DriftDevice` | Drift (analog-modeled synth) | Oscillator/filter parameters |
| `SpectralResonatorDevice` | Spectral Resonator | Spectral processing parameters |
| `HybridReverbDevice` | Hybrid Reverb | Convolution + algorithmic parameters |
| `ShifterDevice` | Shifter (pitch shift) | Shift parameters |
| `LooperDevice` | Looper | Transport/recording controls |
| `DrumCellDevice` | Individual Drum Rack cell | Per-pad synthesis parameters |
| `PluginDevice` | VST/AU plugin | `plugin_name`, mapped parameters |
| `MaxDevice` | Max for Live device | M4L-specific controls |
| `RackDevice` | Instrument/Audio/MIDI Rack | `chains[]`, `drum_pads[]`, `chain_selector` |
| `DrumChain` | Chain inside Drum Rack | Pad-specific chain |

### Song Functions (Complete)

```
start_playing()              stop_playing()               continue_playing()
undo()                       redo()
create_audio_track(index)    create_midi_track(index)     create_return_track()
delete_track(index)          delete_return_track(index)   duplicate_track(index)
create_scene(index)          delete_scene(index)          duplicate_scene(index)
stop_all_clips(quantized?)
tap_tempo()
jump_by(beats)               scrub_by(beats)
jump_to_next_cue()           jump_to_prev_cue()
set_or_delete_cue()
capture_midi(destination)    capture_and_insert_scene()
play_selection()
trigger_session_record(length)
re_enable_automation()
find_device_position(device, target, pos)
move_device(device, target, pos)
force_link_beat_time()
get_current_beats_song_time()
get_current_smpte_song_time(format)
```

### Track Functions

```
create_audio_clip(file_path, position)
delete_clip(clip)
delete_device(index)
duplicate_clip_slot(index)
duplicate_clip_to_arrangement(clip, destination_time)
stop_all_clips()
jump_in_running_session_clip(beats)
```

### Clip Functions (MIDI)

```
add_new_notes(dict)                    // Returns note IDs
get_all_notes_extended()               // All notes as dict
get_notes_extended(pitch, span, time, span)
get_notes_by_id(list)
get_selected_notes_extended()
apply_note_modifications(dict)         // Modify existing notes
remove_notes_extended(pitch, span, time, span)
remove_notes_by_id(list)
select_notes_by_id(list)
select_all_notes()
deselect_all_notes()
duplicate_notes_by_id(list)
duplicate_region(start, length, dest, pitch, transpose)
duplicate_loop()
quantize(grid, amount)
quantize_pitch(pitch, grid, amount)
crop()
clear_all_envelopes()
clear_envelope(parameter)
fire()
stop()
move_playing_pos(beats)
scrub(beat_time)
stop_scrub()
```

### Clip Functions (Audio)

```
add_warp_marker(dict)        // beat_time, sample_time
remove_warp_marker(beat_time)
move_warp_marker(beat_time, distance)
// Plus all non-MIDI functions above
```

---

## 9. MIDI Generators and Transformations

Live 12 introduced MIDI Tools -- a new device category for clip-level MIDI manipulation. M4L can create custom MIDI Tools.

### Architecture

```
[live.miditool.in]           -- Receives clip data + context
      |
  (your patch)               -- Generate or transform notes
      |
[live.miditool.out]          -- Writes notes back to clip
```

### live.miditool.in Outputs

**Left outlet** -- Note data as dictionary:
```json
{
  "notes": [
    {
      "note_id": 1,
      "pitch": 60,
      "start_time": 0.0,
      "duration": 0.5,
      "velocity": 100,
      "mute": 0,
      "probability": 1.0,
      "velocity_deviation": 0.0,
      "release_velocity": 64
    }
  ]
}
```

**Right outlet** -- Context data:
- Grid interval (quantization setting)
- Selection time range
- Selected scale (root + intervals)
- Clip length

### Generator Workflow

1. Receive trigger from `live.miditool.in` (user clicks Apply or adjusts parameter)
2. Generate note dictionaries from scratch using context data (scale, grid, selection)
3. Wrap in `{"notes": [...]}` dictionary
4. Send to `live.miditool.out`

### Transformation Workflow

1. Receive existing notes from `live.miditool.in` left outlet
2. Extract notes array via `dict.unpack notes:`
3. Iterate with `array.map` -- modify pitch, time, velocity, duration, etc.
4. Repack and send to `live.miditool.out`

### Apply Cycle (Snapshot System)

The apply cycle creates snapshots: within one cycle, `live.miditool.in` always returns the same original data. This prevents feedback loops and allows parameter exploration without accumulating changes.

### MIDI Tool Limitations

- **No MSP (audio) objects** -- MIDI Tools cannot process audio
- **No node.script** -- Node runs asynchronously; MIDI Tools require synchronous operation
- **No transport control** -- `transport` object reports unreliable values
- **Offline only** -- Operates on clip data, not real-time MIDI streams

---

## 10. Audio Analysis

### Built-in Analysis Objects

| Object | Analysis Type | Details |
|--------|--------------|---------|
| `fzero~` | Fundamental frequency (pitch) | FFT-based, good for simple signals |
| `retune~` | Pitch detection + correction | Built-in auto-tune, returns detected pitch, adjustable correction amount (0-100%) |
| `loudness~` | **EBU R 128 LUFS metering** | Momentary, short-term, and integrated loudness |
| `peakamp~` | Peak amplitude | Peak level tracking |
| `snapshot~` | Signal sampling | Sample signal values at intervals |
| `fft~` / `ifft~` | Spectral analysis | Raw FFT for custom analysis |
| `pfft~` | Spectral processing environment | Host custom frequency-domain patches |
| `scope~` | Waveform visualization | Time-domain display |
| `spectroscope~` | Spectrum visualization | Frequency-domain display |
| `zerox~` | Zero-crossing rate | Brightness/noise estimation |

### External Analysis Objects (Must Be Installed)

| Object | Analysis Type | Source |
|--------|--------------|--------|
| `sigmund~` | Pitch detection (sinusoidal tracking) | Miller Puckette (fiddle~ 2.0) |
| `fiddle~` | Pitch + amplitude tracking | Miller Puckette (legacy, still usable) |
| `bonk~` | Onset/attack detection | Miller Puckette (percussion-optimized) |

### FluCoMa (Fluid Corpus Manipulation) -- The ML Analysis Toolkit

FluCoMa is a free, open-source toolkit bringing machine listening and machine learning to Max. It is the most comprehensive audio analysis framework available.

**Slicing/Segmentation:**
- `fluid.bufonsetslice~` -- Onset detection in buffers
- `fluid.buftransientslice~` -- Transient detection
- `fluid.bufnoveltyslice~` -- Novelty-based segmentation
- `fluid.bufampslice~` -- Amplitude-based slicing

**Audio Decomposition:**
- `fluid.bufsines~` -- Sinusoidal/residual separation
- `fluid.buftransients~` -- Transient/residual separation
- `fluid.bufhpss~` -- Harmonic/percussive separation (HPSS)
- `fluid.bufnmf~` -- Non-negative matrix factorization (source separation)

**Descriptor Analysis:**
- `fluid.pitch~` -- IRCAM YIN pitch detection (most accurate available)
- `fluid.loudness~` -- Loudness measurement
- `fluid.melbands~` -- Mel-frequency band energies
- `fluid.mfcc~` -- Mel-frequency cepstral coefficients
- `fluid.spectralshape~` -- Spectral centroid, spread, skewness, kurtosis, rolloff, flatness, crest
- `fluid.chroma~` -- Chroma features (pitch class distribution)
- `fluid.onsetfeature~` -- Real-time onset features

**Machine Learning:**
- `fluid.mlpclassifier~` -- Neural network classifier
- `fluid.mlpregressor~` -- Neural network regression
- `fluid.kdtree` -- K-nearest neighbor search
- `fluid.normalize~` -- Feature normalization
- `fluid.standardize~` -- Feature standardization
- `fluid.pca~` -- Principal component analysis
- `fluid.umap~` -- UMAP dimensionality reduction
- `fluid.grid~` -- Self-organizing map

**Corpus Management:**
- `fluid.dataset~` -- Store feature datasets
- `fluid.datasetquery~` -- Query datasets
- `fluid.labelset~` -- Labeled dataset management

### IRCAM MuBu / CataRT

- **MuBu** -- Multi-buffer toolbox for multimodal analysis and synthesis
- **CataRT** -- Corpus-based concatenative synthesis: analyze a corpus of sounds by audio descriptors, navigate descriptor space to play grains from matching regions
- **SKataRT** -- M4L version of CataRT
- **PiPo** -- Plugin Interface for Processing Objects (descriptor analysis framework)

### What You Can Build

1. **Real-time pitch tracker** -- sigmund~/fluid.pitch~ feeding MIDI generation
2. **Beat/onset detector** -- bonk~/fluid.bufonsetslice~ triggering events
3. **Loudness meter** -- loudness~ for LUFS monitoring and auto-gain
4. **Spectral feature extractor** -- fluid.spectralshape~ for brightness, warmth, noise content
5. **Automatic EQ** -- Analyze spectrum, generate EQ curves
6. **Content-based sampler** -- CataRT-style: play samples by timbral similarity
7. **Source separation** -- fluid.bufhpss~/fluid.bufnmf~ for stems
8. **Audio classifier** -- fluid.mlpclassifier~ trained on genre/instrument/mood

---

## 11. Hardware Integration

### Official Connection Kit (Free from Ableton)

The Connection Kit provides ready-made M4L devices for:
- **Arduino/Genuino** -- Digital/analog I/O via serial
- **OSC** -- Send/receive OSC over network
- **LEGO MINDSTORMS EV3** -- Sensor/motor control
- **littleBits** -- Modular electronics
- **JSON APIs** -- Web service integration

### Supported Hardware Protocols

| Protocol | Max Objects | Use Cases |
|----------|-----------|-----------|
| **MIDI** | `midiin`, `midiout`, `ctlin`, `notein`, etc. | Any MIDI controller, MPE devices |
| **OSC** | `udpsend`, `udpreceive` | TouchOSC, Lemur, VCV Rack, SuperCollider, custom apps |
| **Serial** | `serial` | Arduino, Teensy, ESP32, custom microcontrollers |
| **DMX** (via serial) | `serial` + DMX protocol | Stage lighting, LED fixtures |
| **CV/Gate** (via DC-coupled interface) | `sig~` output through DC-coupled audio interface | Eurorack modular, analog synths |
| **HID** | `hi` (Human Interface Device) | Joysticks, gamepads, custom USB devices |
| **Camera** | Jitter `jit.grab` | Webcams, video capture devices |
| **TCP/IP** | Node for Max or `mxj net.tcp.*` | Network devices, IoT |
| **WebSocket** | Node for Max | Custom apps, web interfaces, our kbot bridge |
| **Bluetooth** | Node for Max | BLE sensors (via noble/web-bluetooth npm) |

### CV/Gate Integration

With a DC-coupled audio interface (e.g., Expert Sleepers ES-9, MOTU, RME), M4L can:
- Send 1V/oct pitch CV from MIDI notes
- Send gate/trigger signals
- Send modulation CV from any parameter
- Receive CV and convert to control data
- Clock sync between DAW and modular

### Arduino Integration Example

```
[serial /dev/tty.usbmodem* 9600]  -- Serial connection to Arduino
       |
   [route analog digital]          -- Parse sensor data
       |
   [scale 0 1023 0. 1.]           -- Normalize sensor values
       |
   [live.remote~]                  -- Control any Ableton parameter
```

---

## 12. Jitter (Video/Visuals)

Jitter is Max's real-time video and 3D graphics engine. It runs inside M4L for audio-reactive visuals.

### Core Concepts

- **jit.matrix** -- The fundamental data container (any dimension, any planecount, any type). Images are 2D, 4-plane (ARGB), char matrices.
- **jit.gl.*** -- OpenGL objects for GPU-accelerated rendering
- **jit.world** -- All-in-one rendering context (window + renderer + physics)

### Key Object Categories

**Video I/O:**
- `jit.grab` -- Camera capture
- `jit.movie` -- Video file playback
- `jit.record` -- Video recording
- `jit.desktop` -- Screen capture

**Matrix Processing:**
- `jit.op` -- Matrix math operations (add, multiply, threshold, etc.)
- `jit.brcosa` -- Brightness/contrast/saturation
- `jit.slide` -- Temporal smoothing
- `jit.wake` -- Temporal feedback/trails
- `jit.scissors` / `jit.glue` -- Split/join matrices
- `jit.unpack` / `jit.pack` -- Split/combine planes
- `jit.rgb2luma` -- Color to grayscale
- `jit.chromakey` -- Chroma key (green screen)
- `jit.sobel` -- Edge detection
- `jit.convolve` -- 2D convolution
- `jit.noise` -- Random noise generation
- `jit.cellblock` -- Matrix data display/editor

**3D / OpenGL:**
- `jit.gl.gridshape` -- Parametric 3D shapes (sphere, torus, plane, etc.)
- `jit.gl.mesh` -- Custom mesh rendering
- `jit.gl.model` -- Load 3D models (OBJ, etc.)
- `jit.gl.text3d` / `jit.gl.text2d` -- 3D/2D text rendering
- `jit.gl.camera` -- Virtual camera control
- `jit.gl.light` -- Scene lighting
- `jit.gl.material` -- Material properties
- `jit.gl.shader` -- Custom GLSL shaders
- `jit.gl.slab` -- GPU texture processing (shader chains)
- `jit.gl.node` -- Scene graph hierarchy
- `jit.gl.sketch` -- Immediate-mode OpenGL drawing
- `jit.gl.videoplane` -- Video-on-plane in 3D scene
- `jit.gl.pix` -- Gen-based GPU shader programming
- `jit.gl.pass` -- Multi-pass rendering effects

**Physics:**
- `jit.phys.world` -- Physics simulation engine
- `jit.phys.body` -- Physics-enabled objects (rigid body dynamics)
- `jit.phys.ghost` -- Collision detection zones
- `jit.phys.multiple` -- Particle systems with physics

**Animation:**
- `jit.anim.node` -- Animation system (position, rotation, scale)
- `jit.anim.drive` -- Animation driver

### Performance Consideration

**GPU is mandatory for acceptable performance.** CPU-based Jitter video processing competes with audio for CPU time. Always use `jit.gl.*` objects (GPU) instead of CPU-based matrix processing when possible. The `jit.gl.pix` / `jit.gl.slab` objects run shaders on the GPU, leaving CPU free for audio.

### Audio-Reactive Visuals Example

```
[adc~]                    -- Audio input
   |
[spectroscope~]           -- Visualize (optional)
   |
[fft~ 1024 256]           -- Spectral analysis
   |
[jit.catch~]              -- Convert audio to matrix
   |
[jit.gl.mesh @draw_mode points]  -- Render as 3D pointcloud
   |
[jit.gl.shader myshader]  -- Custom shader coloring
   |
[jit.world]               -- Render to window
```

---

## 13. RNBO (Code Export)

RNBO is a separate Cycling '74 product that exports Max-like patches to multiple targets. While not part of M4L directly, it extends the ecosystem.

### Export Targets

| Target | Output | Use Case |
|--------|--------|----------|
| **VST3 / AU Plugin** | Compiled plugin binary | Use your M4L ideas in any DAW |
| **Web Audio** | JavaScript + WebAssembly | Browser-based instruments |
| **Raspberry Pi** | ARM binary | Hardware effects pedals, standalone synths, Eurorack |
| **C++ Source** | Portable C++ code | Embed in any application |
| **Max External** | Compiled .mxo/.mxe | Faster alternative to patch |
| **Bela Board** | Ultra-low latency embedded | Sub-millisecond audio hardware |

### RNBO Limitation in M4L

RNBO cannot directly export from M4L (Gen~ code export is disabled in M4L). You must build in standalone Max first, then export.

---

## 14. Community Ecosystem

### maxforlive.com

The central community repository for M4L devices. Statistics:
- **Thousands of devices** -- Instruments, Audio Effects, MIDI Effects, MIDI Generators, MIDI Transformations
- **Categories**: Instruments, Audio Effects, MIDI Effects, MIDI Generators, MIDI Transformations
- **Sorted by**: Downloads, ratings, date, author
- **Mix of free and paid** devices
- Active community with constant new submissions (multiple per day)

### Notable Developers and Devices

**Ableton (Official)**
- Connection Kit (hardware integration)
- Convolution Reverb
- Max 7 Pitch and Time Machines
- Instant Haus (generative beats)
- Melodic Steps, CV Tools, Expression Control

**Dillon Bastan** (via Isotonik Studios)
- **Entanglement** -- Quantum wavefunctions as wavetables
- **Coalescence** -- Concatenative synthesizer powered by SOM neural network
- **Natural Selection** -- Genetic algorithm preset evolution
- **Pathways** -- Spectrogram-based sample navigation
- **Nirvana** -- Feedback sandbox (space/material/circuit modes)
- **Rhythmorphic** -- Generative rhythm engine

**Isotonik Studios** (Publisher/Marketplace)
- Largest commercial M4L device marketplace
- Categories: instruments, effects, utilities, MIDI tools
- Devices from dozens of developers

**IRCAM** (Research)
- **CataRT/SKataRT** -- Corpus-based concatenative synthesis
- **MuBu** -- Multi-buffer analysis toolkit
- **RAVE** -- Neural audio synthesis (via nn~)

**Cycling '74 (Max Community)**
- Gen~ examples library (filters, oscillators, effects)
- MC examples
- Jitter GL examples

**Robert Henke (Monolake)**
- Granulator II (granular synthesis, included with Live Suite)
- Various experimental devices

**Other Notable Devices**
- **KOAN Sound's Palette Sequencer** -- Color-palette generative sequencer
- **PinkAI** -- AI harmonic generation
- **Data Knot** -- Real-time ML for music (built on FluCoMa)
- **Magenta Studio** -- Google's ML tools for Live (rhythm/melody generation)
- **V-Module** -- Video content creation in Live (Jitter wrapper)
- **Loudness Meter** -- LUFS metering device

---

## 15. Performance and Limitations

### CPU Architecture

M4L devices share CPU with Live's audio engine. Critical performance characteristics:

| Factor | Detail |
|--------|--------|
| **Thread sharing** | M4L shares one core per track with other devices on that track |
| **Overhead per device** | Each M4L device has base overhead regardless of content (~2-4% CPU per device measured in some tests) |
| **Live.scope~ cost** | ~2% CPU per instance |
| **Editor window penalty** | Open M4L editor window increases CPU and latency |
| **Factor vs standalone Max** | M4L typically uses 2-3x CPU compared to same patch in standalone Max |
| **Practical device limit** | ~6-10 complex M4L devices before CPU issues (varies by hardware) |

### Hard Limitations of Max for Live

**Audio:**
- Device I/O limited to **stereo** (2 channels) despite MSP supporting 512
- Cannot access audio drivers directly (input/output flows through device chain)
- `send~` / `receive~` cannot pass audio between M4L devices
- Audio I/O only works in preview mode

**MIDI:**
- MIDI input comes from Live, output goes to Live (no direct external MIDI)
- No SysEx or Program Change messages
- MIDI only active in preview mode
- Single port and channel per track

**MC (Multi-Channel):**
- Cannot manually create MC patchcord connections (must be scripted/pre-built)

**Gen~:**
- Can load and run Gen~ sub-patches but cannot save new ones
- Cannot export Gen~ code (C/C++ export disabled)

**Authorization / Saving:**
- Cannot build standalones or collectives
- Frozen devices serve as distribution/protection mechanism
- `autopattr` not available (must use individual `pattr` objects)

**OSC:**
- Integrated OSC support disabled (`udpsend`/`udpreceive` still work for raw UDP/OSC)

**Jitter:**
- Full Jitter available but GPU performance depends heavily on hardware
- Jitter in M4L documented as "not officially supported" but works in practice
- No rendering to separate window from M4L (must render to textures/matrices)

**MIDI Tools:**
- No audio objects (MSP)
- No `node.script` (async incompatible)
- No reliable `transport` access
- Cannot control transport
- Synchronous operation only

### Scheduler and Timing

- Max messages are **not sample-accurate** -- they are scheduled at the control rate (typically 1-2ms resolution)
- MSP signals ARE sample-accurate within the audio thread
- `live.remote~` provides sample-accurate parameter control with one-buffer latency
- Events are timestamped with 64-bit accuracy internally
- `transport` syncs to Live's transport for tempo-relative timing
- `metro` and `clocker` timing in M4L has been reported as slightly less accurate than in standalone Max

---

## 16. AI-Powered M4L Possibilities

Given everything above, here is what is technically possible for AI-controlled music production through M4L.

### Tier 1: Fully Achievable Now (kbot-bridge architecture)

| Capability | How | Components |
|-----------|-----|-----------|
| **AI mixing assistant** | Analyze tracks via FFT/loudness~, send analysis to kbot, AI determines EQ/compression/levels, set parameters via live.object | Node for Max + js/LiveAPI + loudness~ + fft~ |
| **Intelligent auto-accompaniment** | Observe playing (live.observer on clip notes/transport), send to AI, generate complementary MIDI, write via add_new_notes() | js/LiveAPI + Node for Max + AI API |
| **Generative sequencing** | AI generates note patterns, writes to clips via LOM | Node for Max + js/LiveAPI |
| **Automatic arrangement** | Analyze clip content, AI determines song structure, duplicate/fire clips in timeline | Node for Max + js/LiveAPI |
| **Sample recommendation** | Analyze project (descriptors), search library by similarity (FluCoMa), suggest matches | FluCoMa + Node for Max |
| **Real-time parameter modulation** | AI determines modulation curves, output via live.remote~ at signal rate | Gen~/MSP + live.remote~ |
| **Intelligent drum programming** | AI generates patterns aware of genre/style, writes to drum rack clips | Node for Max + js/LiveAPI |
| **Automatic stem separation** | Trigger via Live API (12.3+) | js/LiveAPI |
| **Voice/effect preset morphing** | Interpolate between parameter states over time | js/LiveAPI + pattrstorage |

### Tier 2: Achievable with Neural Inference (RAVE/nn~)

| Capability | How | Components |
|-----------|-----|-----------|
| **Real-time audio style transfer** | RAVE model: encode input audio, decode with different model/latent manipulation | nn~ + RAVE model + Gen~ |
| **Neural audio synthesis** | Train RAVE on your sounds, generate new timbres by exploring latent space | nn~ + trained RAVE model |
| **Timbre morphing** | Interpolate between RAVE latent spaces of two sounds | nn~ + Gen~ |
| **Voice cloning** | RAVE trained on voice dataset, driven by pitch/envelope input | nn~ + retune~ + adsr~ |
| **Intelligent reverb/spatial** | Neural network learns room characteristics | nn~ + buffer processing |

### Tier 3: Achievable with FluCoMa ML Pipeline

| Capability | How | Components |
|-----------|-----|-----------|
| **Audio content classifier** | Analyze features (MFCC, spectral shape), train MLP classifier, auto-tag tracks | fluid.mfcc~ + fluid.mlpclassifier~ |
| **Similarity search** | Build KD-tree of audio descriptors, find similar sounds | fluid.kdtree + fluid.dataset~ |
| **Intelligent sampler** | CataRT-style: navigate descriptor space, play grains by timbral target | fluid.* + MuBu/CataRT |
| **Automatic beat matching** | Onset detection + tempo estimation + warp marker placement | fluid.bufonsetslice~ + fluid.pitch~ |
| **Dynamic mixing by content** | Classify instruments per track, apply genre-appropriate mixing rules | fluid.mlpclassifier~ + live.remote~ |

### Tier 4: Possible with External Compute (Node for Max + API)

| Capability | How | Components |
|-----------|-----|-----------|
| **Full AI composition** | Send project analysis to cloud LLM, receive arrangement/notes/parameters | Node for Max + HTTP + OpenAI/Anthropic API |
| **Lyric generation** | AI generates lyrics synced to melody/rhythm | Node for Max + LLM API |
| **Visual generation from audio** | Analyze audio features, generate images/video via DALL-E/Midjourney | Node for Max + API + Jitter |
| **Collaborative AI jamming** | Real-time bidirectional: audio analysis -> AI -> MIDI generation | Node for Max + WebSocket + AI API |
| **Production feedback** | Send full mix analysis to AI, receive natural language critique | Node for Max + loudness~/FFT analysis + LLM |

### Architecture for Maximum AI Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    Ableton Live 12                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ kbot-bridge   │  │ kbot-auto-   │  │ kbot-neural-engine   │  │
│  │ (M4L device)  │  │ mixer        │  │ (M4L instrument)     │  │
│  │               │  │ (M4L effect) │  │                      │  │
│  │ node.script   │  │              │  │  ┌─────────────────┐ │  │
│  │ ┌──────────┐  │  │ fft~ loudness│  │  │ nn~ (RAVE model)│ │  │
│  │ │WebSocket │  │  │ live.remote~ │  │  │ Gen~ (latent    │ │  │
│  │ │server    │  │  │              │  │  │  manipulation)  │ │  │
│  │ └──────────┘  │  └──────────────┘  │  └─────────────────┘ │  │
│  │       │       │                     │                      │  │
│  │ js (LiveAPI)  │                     │  FluCoMa analysis    │  │
│  │ live.path     │                     │  fluid.pitch~        │  │
│  │ live.object   │                     │  fluid.mfcc~         │  │
│  │ live.observer │                     │  fluid.mlpclassifier~│  │
│  └───────┬───────┘                     └──────────────────────┘  │
│          │                                                       │
└──────────┼───────────────────────────────────────────────────────┘
           │ WebSocket (JSON over TCP)
           │
┌──────────▼──────────┐     ┌─────────────────────────────────┐
│       K:BOT          │     │      External Services          │
│   (Node.js CLI)      │────▶│  Anthropic Claude API           │
│                      │     │  OpenAI GPT-4 API               │
│  Agent loop:         │     │  Google Gemini API               │
│  think → plan →      │     │  Splice sample library           │
│  execute → learn     │     │  Custom ML inference servers     │
│                      │     └─────────────────────────────────┘
│  Music theory engine │
│  Genre knowledge     │
│  User style learning │
└──────────────────────┘
```

---

## Appendix A: Quick Reference -- "Can M4L Do X?"

| Question | Answer |
|----------|--------|
| Create/delete tracks? | **Yes** -- `Song.create_audio_track()`, `Song.create_midi_track()`, `Song.delete_track()` |
| Create MIDI clips? | **Yes** -- `ClipSlot.create_clip(length)` |
| Create audio clips from file? | **Yes** -- `ClipSlot.create_audio_clip(path)` or `Track.create_audio_clip(path, position)` |
| Write MIDI notes? | **Yes** -- `Clip.add_new_notes(dict)` with full note properties |
| Read MIDI notes? | **Yes** -- `Clip.get_all_notes_extended()` returns dict with all note data |
| Control any device parameter? | **Yes** -- `DeviceParameter.value` is read/write |
| Modulate parameters at audio rate? | **Yes** -- `live.remote~` at signal rate |
| Create automation? | **Yes** -- via `live.remote~` during recording, or create envelope breakpoints |
| Change tempo? | **Yes** -- `Song.tempo` (20.0-999.0 BPM, read/write) |
| Start/stop transport? | **Yes** -- `Song.start_playing()`, `Song.stop_playing()` |
| Access arrangement view? | **Partially** -- can read arrangement clips, duplicate session clips to arrangement, but cannot create arrangement clips from scratch |
| Load samples into Simpler? | **No direct API** -- Sample Selector is numeric; file path loading not supported via LOM |
| Load plugins? | **Partially** -- `Track.insert_device` works for built-in devices only |
| Trigger stem separation? | **Yes** -- available via API in Live 12.3+ |
| Access the browser? | **No** -- browser is not exposed in LOM |
| Send MIDI to external hardware? | **Via Live's MIDI routing** -- set track output to external MIDI port |
| Run machine learning? | **Yes** -- TensorFlow.js via Node for Max, or RAVE/nn~ for neural audio |
| Process video? | **Yes** -- full Jitter available (GPU recommended) |
| Connect to hardware? | **Yes** -- MIDI, OSC, serial (Arduino), HID, camera, CV/gate |
| Run a web server inside Ableton? | **Yes** -- Node for Max can run Express/Fastify/etc. |
| Call external APIs? | **Yes** -- Node for Max has full HTTP/WebSocket/fetch |
| Custom UI? | **Yes** -- live.* objects for standard controls, jsui/v8ui for fully custom drawing |
| Gen~ for custom DSP? | **Yes** (load and run) / **No** (cannot save new Gen~ patches in M4L) |
| Export to hardware? | **No** (RNBO requires standalone Max) |

---

## Appendix B: Sources

- [Cycling '74 Max Documentation](https://docs.cycling74.com/)
- [Gen Overview](https://docs.cycling74.com/userguide/gen/_gen_overview/)
- [Gen~ Operators](https://docs.cycling74.com/max8/vignettes/gen~_operators)
- [Node for Max API](https://docs.cycling74.com/apiref/nodeformax/)
- [Live API Overview](https://docs.cycling74.com/userguide/m4l/live_api_overview/)
- [Live Object Model](https://docs.cycling74.com/max8/vignettes/live_object_model)
- [Max for Live Limitations](https://docs.cycling74.com/userguide/m4l/live_limitations/)
- [Max for Live MIDI Tools](https://docs.cycling74.com/userguide/m4l/live_miditools/)
- [MC Documentation](https://docs.cycling74.com/max8/vignettes/mc_topic)
- [LiveAPI JavaScript Object](https://docs.cycling74.com/legacy/max8/vignettes/jsliveapi)
- [SimplerDevice Reference](https://docs.cycling74.com/apiref/lom/simplerdevice/)
- [MSP Functional Object Listing](https://docs.cycling74.com/max7/vignettes/msp_functional)
- [RNBO](https://cycling74.com/products/rnbo)
- [FluCoMa](https://www.flucoma.org/)
- [RAVE / nn~](https://github.com/acids-ircam/RAVE)
- [IRCAM MuBu / CataRT](https://ismm.ircam.fr/mubu/)
- [Ableton Connection Kit](https://www.ableton.com/en/packs/connection-kit/)
- [Ableton M4L Reference Manual](https://www.ableton.com/en/manual/max-for-live/)
- [Node for Max Community](https://github.com/Cycling74/n4m-community)
- [Adam Murray V8 LiveAPI Tutorial](https://adammurray.link/max-for-live/v8-in-live/live-api/)
- [maxforlive.com Library](https://maxforlive.com/library/)
- [Isotonik Studios](https://isotonikstudios.com/)
- [Dillon Bastan Devices](https://isotonikstudios.com/product-category/isotonik-collective/dillon-bastan/)
- [Data Knot / FluCoMa for Music](https://cdm.link/data-knot-for-max-machine-learning-as-musicians-want-it/)
- [Magenta Studio](https://www.ableton.com/en/blog/magenta-studio-free-ai-tools-ableton-live/)
- [PinkAI Generative Ecosystem](https://waveinformer.com/2025/08/17/pinkai-a-max-for-live-ecosystem-for-generative-music-creation/)
- [IRCAM Forum Neural Synthesis Tutorial](https://forum.ircam.fr/article/detail/tutorial-neural-synthesis-in-max-8-with-rave/)
