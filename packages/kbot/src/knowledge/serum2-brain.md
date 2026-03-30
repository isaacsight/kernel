# Serum 2 Brain — Complete Synthesis Knowledge Base

> Source: Serum 2 User Guide v1.0.3 (354 pages), VST3 parameter dumps, Xfer Records documentation
> For kbot Serum 2 agent — used for sound design, preset programming, and Ableton integration

---

## 1. ARCHITECTURE OVERVIEW

**Serum 2** by Xfer Records (v2.0.18+, released March 2025). VST3/AU/AAX, 64-bit only.
Free upgrade for Serum 1 owners. $249 new.

### Signal Flow
```
OSC A ──┐                    ┌─ Direct Out ──> Main FX Chain ──> Output
OSC B ──┤                    │
OSC C ──┼──> Mixer ──> Filter 1 ──┤──> FX Bus 1
Noise ──┤              Filter 2 ──┤──> FX Bus 2
Sub ────┘
```

Each oscillator routes independently to Filter 1, Filter 2, or blend.
Each filter output routes to Direct, Bus 1, or Bus 2.

---

## 2. OSCILLATORS (5 sources)

### 3 Primary Oscillators (A, B, C)
Each supports 5 synthesis modes:

| Mode | Key Feature | Unique Controls |
|------|-------------|-----------------|
| **Wavetable** | Classic Serum. Smooth interpolation, dual warp. Up to 256 frames per table. | WT Pos, Warp, Warp 2, Phase |
| **Multisample** | SFZ format instruments. Ships with orchestra, choir, pianos, guitars. | Timbre, Velocity layers |
| **Sample** | Single-sample. Loop, slice (auto/manual), tape stop, score extraction. | Start, End, Loop, Rate, Slice |
| **Granular** | Up to 256 simultaneous grains, density up to 30, window shape control. | Density, Length, Scan, X\|Y |
| **Spectral** | Real-time harmonic resynthesis with transient detection. | Cut, Filter (drawable), Mix |

### Unison (per oscillator)
- **Up to 16 voices**
- Parameters: Detune, Blend, Width, Span, Rand Start, Warp, Warp 2
- **Stack modes**: Off, interval-based stacking (e.g., 12+7 = octave+fifth)
- **Tuning modes**: Harmonic, Ratio, Semitone, Step

### Wavetable Warp Modes (dual — two active simultaneously)

| Category | Modes | Description |
|----------|-------|-------------|
| **Off** | Off | No warp |
| **Alt Warp** | Sync | Hard/soft sync (Var = smoothness) |
| | Bend +, Bend -, Bend +/- | Pinch waveform inward/outward/both |
| | PWM | Push waveform left (classic pulse width) |
| | Asym +, Asym -, Asym +/- | Bend entire waveform left/right/both |
| | Flip | Polarity flip at warp position |
| | Mirror | Mirror image for 2nd half of cycle (octave effect) |
| | Remap 1/2/3/4 | Custom wave cycle remapping (drawable graph) |
| | Quantize | Sample rate reduction on the waveform itself |
| | Odd/Even | Scale odd vs even harmonics (0%=odd, 100%=even) |
| **Filter** | LPF | Low-pass filter on waveform |
| | HPF | High-pass filter on waveform |
| **Distortion** | Tube | Analog tube emulation |
| | Soft Clip | Gentle nonlinear compression |
| | Hard Clip | Aggressive peak limiting |
| | Diode 1/2 | Analog diode clipping (guitar pedal character) |
| | Linear Fold | Wavefolding (metallic, harsh) |
| | Sine Fold | Sine-based wavefolding (smooth, evolving) |
| | Zero-Square | Zero below threshold, square above |
| | Asym (dist.) | Asymmetric distortion (different +/- halves) |
| | Rectify | Flip/remove one half of waveform |
| | Sine Shaper | Sine function waveshaping (warm, musical) |
| | Stomp Box | Guitar pedal overdrive emulation |
| | Tape Sat. | Analog tape saturation (warm, vintage) |
| | Soft Sat. | Subtle smooth saturation |
| **FM** | FM (B/C/Noise/Sub/Filter1/Filter2) | Frequency modulation from source |
| | Thru-Zero | FM that continues through negative frequencies |
| | Exp | Exponential FM scaling (bright, harsh) |
| | Linear | Linear FM scaling (smooth, musical, bell-like) |
| **PD** | PD (B/C/Noise/Sub/Filter1/Filter2/Self) | Phase distortion from source |
| **AM** | AM (B/C/Noise/Sub/Filter1/Filter2) | Amplitude modulation from source |
| **RM** | RM (B/C/Noise/Sub/Filter1/Filter2) | Ring modulation from source |
| **Utility** | Swap Warps | Swap Warp 1 and Warp 2 positions |

### Sub Oscillator
- Waveforms: Sine, Triangle, Saw (up/down), Square, Pulse 25%, Pulse 12.5%
- Independent octave, pitch tracking, phase, direct output
- NEW: Direct out control (bypass filter routing)

### Noise Oscillator
- Sample-based noise with preset library (White, Pink, Brown, Geiger, + user samples)
- Controls: Level, Pan, Pitch, Fine, Phase, Random phase, One-shot/Loop, Start
- Pitch tracking toggle

---

## 3. FILTERS (Dual)

### 2 filters: Filter 1 and Filter 2
- Routing: Series or Parallel (per-oscillator Filter Balance control)
- Parameters per filter: **Type, Cutoff, Resonance, Drive, Var, Mix, Pan/Stereo, Level**
- Drive has Clean Mode option: -24dB pre-gain, +24dB post-gain
- Keytrack toggle on Cutoff

### Complete Filter Types (30+ types in 5 categories)

**NORMAL:**
| Type | Description | Var Function |
|------|-------------|-------------|
| MG Low 6/12/18/24 | Moog-style ladder LP | FAT: saturation in resonance path |
| Low 6/12/18/24 | State-variable LP | FAT |
| High 6/12/18/24 | State-variable HP | FAT |
| Band/Peak/Notch 12/24 | State-variable BPF/Peak/Notch | FAT |

**MULTI (Dual SVF):**
| Type | Description | Var Function |
|------|-------------|-------------|
| LH/LB/LP/LN/HB/HP/HN/BP/BN/PP/PN/NN | Two SVF filters combined | FREQ: second SVF cutoff |

**FLANGES (Morphing SVF + Comb/Flanger/Phaser):**
| Type | Description | Var Function |
|------|-------------|-------------|
| LBH/LPH/LNH/BPN | Morphing SVF | MORPH: transition between states |
| Cmb L/Flg L/Phs L | Comb/Flanger/Phaser (LP feedback) | LP FREQ |
| Cmb H/Flg H/Phs H | Comb/Flanger/Phaser (HP feedback) | HP FREQ |
| Cmb HL/Flg HL/Phs HL | Comb/Flanger/Phaser (HP+LP feedback) | HL WID |

**MISC:**
| Type | Description | Var Function |
|------|-------------|-------------|
| Low/Band/High EQ 6/12 | Morphable EQ | DB +/- |
| Ring Mod / Ring Modx2 | Ring modulation at cutoff freq | SPREAD |
| SampHold / SampHold- | Sample-and-hold distortion | — |
| French LP | Nonlinear distorting LP | BOEUF |
| German LP | Zero-delay feedback LP | — |
| Add Bass | Phase-rotated LP with drive | THRU |
| Formant I/II/III | Vowel filters (3 variations) | FORMNT |
| Bandreject | Notch filter | WIDTH |
| Dist.Comb 1/2 LP/BP | Comb + pass combo | COMBFRQ |
| Scream LP/BP | High-feedback scream | SCREAM |

**NEW (Serum 2):**
| Type | Description | Var Function |
|------|-------------|-------------|
| **Wsp** | Wasp synth filter (buzzes/burbles) | MORPH: LPF/Notch/HPF |
| **DJ Mixer** | Xfer DJM filter | — |
| **Diffusor** | All-pass diffusor stage | STAGES |
| **MG Ladder** | Clean transistor ladder VCF | SMOOTH |
| **Acid Ladder** | Diode ladder VCF (303 acid) | SMOOTH |
| **EMS Ladder** | EMS VCS3 style VCF | SMOOTH |
| **MG Dirty** | MG Ladder fully overdriven | PAIN |
| **PZ SVF** | Drawable filter curves | SMOOTH |
| **Comb 2** | New comb with extreme resonance | FRQ2 |
| **Exp MM** | Expander multimode LP/Notch/HP | MIX |
| **Exp BPF** | Expander band-pass | — |

---

## 4. ENVELOPES (4)

- **Env 1**: Hardwired to amplitude (VCA)
- **Env 2-4**: Freely assignable to any destination

### Parameters per envelope
| Parameter | VST3 Name Pattern | Description |
|-----------|-------------------|-------------|
| Attack | `Env N Attack` | Time to peak |
| Hold | `Env N Hold` | Time at peak before decay |
| Decay | `Env N Decay` | Time to sustain level |
| Sustain | `Env N Sustain` | Held level |
| Release | `Env N Release` | Fade after note-off |
| Atk Curve | `Env N Atk Curve` | Attack shape |
| Dec Curve | `Env N Dec Curve` | Decay shape |
| Rel Curve | `Env N Rel Curve` | Release shape |
| Start | `Env N Start` | Start level (Env 2-4 only) |
| End | `Env N End` | End level (Env 2-4 only) |
| Delay | - | Pre-envelope delay (BPM syncable) |

### Features
- Curve shapes: exponential, linear, custom (drag to reshape)
- BPM sync on delay
- Legato mode (don't retrigger on overlapping notes)
- Legato Inverted mode

---

## 5. LFOs (10)

### 5 LFO Modes
| Mode | Description |
|------|-------------|
| **Normal** | Draw custom waveform on grid (independent X/Y grid sizes) |
| **Path** | Draw XY vector path — produces dual X and Y outputs (2 mod sources per LFO) |
| **Chaos: Lorenz** | Lorenz attractor — dual X/Y outputs, controlled chaos |
| **Chaos: Rossler** | Rossler attractor — dual X/Y outputs |
| **S&H** | Sample & Hold — stepped random modulation |

### Parameters per LFO
| Parameter | Description |
|-----------|-------------|
| Rate | Speed (free Hz or BPM-synced to musical divisions) |
| Smooth | 4th-order Butterworth filtering on output |
| Rise | Fade-in time (LFO fades from flat to drawn shape) |
| Delay | Milliseconds before LFO starts after note trigger |
| Phase | Stereo phase offset |

### Trigger Modes (MODE)
| Mode | Description |
|------|-------------|
| **FREE** | Follows host clock, ignores notes |
| **RETRIG** | Retriggers with each new note |
| **ENVELOPE** | Single cycle then stops (supports loopback point) |
| **HOST** | Retriggers on host transport position |

### Key Facts
- Audio-rate capable (up to 1 kHz for harmonics)
- BPM sync: 8 bars down to 1/32nd note
- LFOs 7-10 become visible after assigning LFO 6
- LFO point modulation: modulate individual shape points
- Copy wavetable shapes to LFO and vice versa
- With Path/Chaos dual X/Y: up to 20 effective mod sources

---

## 6. MODULATION MATRIX

### 64 slots, 49+ sources

### Modulation Sources
- Env 1-4
- LFO 1-10 (including X/Y for Path/Chaos modes)
- Macro 1-8
- Velocity, Release Velocity
- Mod Wheel, Aftertouch, Pitch Bend
- Key Tracking, Note Number
- Voice Index, Unison Index
- Gate/Note On
- Oscillators A, B, C (audio-rate)
- Sub, Noise (as mod sources)
- Filter 1, Filter 2 outputs
- MIDI CC (any CC 0-127)
- Random (per-note)

### Destinations
Virtually every continuous parameter:
- All oscillator params (level, pan, pitch, WT position, warp, unison)
- Filter params (cutoff, res, drive, var, mix)
- Envelope params (AHDSR, curves)
- LFO params (rate, smooth, rise, delay, phase)
- FX params, macro values, mixer levels, routing

### Features
- **Bipolar amounts** (0.5 = center/no mod, >0.5 positive, <0.5 negative)
- Per-slot bypass toggle
- Curve/remapping editor per mod route
- AUX multiply/invert sources
- INV toggle for polarity reversal
- Drag-and-drop reordering
- Assign via drag from source header to any knob

### VST3 Parameters
- `Mod N Amount` (ID: 6000000 + (N-1)*1000) — the modulation depth
- `Mod N Out` — output scaling (0-100%)
- Source and destination are set in the Serum 2 UI (NOT automatable via VST3)

---

## 7. MACROS (8)

- **8 macro knobs** (up from 4 in Serum 1)
- VST3: `Macro 1` through `Macro 8` (IDs: 7000000-7007000)
- Drag macro header to any knob to assign
- One macro can control multiple destinations
- Macros can be both mod sources and destinations
- Tooltip shows all assigned destinations

---

## 8. EFFECTS (3-Bus Architecture)

### Routing
| Bus | Purpose |
|-----|---------|
| **Direct** | Main output → Main FX chain → Master |
| **Bus 1** | Parallel FX bus 1 |
| **Bus 2** | Parallel FX bus 2 |

Each bus has 16 automation param slots: `FX Main Param 1-16`, `FX Bus 1 Param 1-16`, `FX Bus 2 Param 1-16`

**IMPORTANT:** FX params are DYNAMIC — they only appear in DAW automation after right-click > Automate in Serum 2 UI.

### FX Modules (16)

| Module | Key Parameters | Notes |
|--------|---------------|-------|
| **Bode** | Phase vocoder/frequency shifter | New. Delay in feedback path, diffusion |
| **Chorus** | Delay 1, Delay 2, Rate, Depth, Mix | Stereo chorus |
| **Compressor** | Threshold, Ratio, Attack, Release, Mix | Dynamic range |
| **Convolve** | IR select, Attack, Decay, Mix | Convolution reverb. NEW. Custom IR loading |
| **Delay** | Time L/R, Feedback, Filter, Mix | Ping-pong, tap modes, BPM sync |
| **Distortion** | Drive, Mix, Type | 13 algorithms: Tube, Soft Clip, Hard Clip, Sine, etc. PRE/POST filter |
| **Equalizer** | Low/Mid/High bands | Parametric EQ |
| **Filter** | Cutoff, Res, Type, Mix | Additional filter stage |
| **Flanger** | Rate, Depth, Phase, Feedback, Mix | BPM sync |
| **Hyper/Dimension** | Rate, Depth, Mix | Chorus-like widening |
| **Phaser** | Rate, Depth, Feedback, Mix | Phase cancellation |
| **Reverb** | Size, Decay, Pre-delay, Mix | Room simulation. Multiple algorithms |
| **Splitter L/H** | Crossover freq | Split into Low/High bands |
| **Splitter L/M/H** | Low/High crossover | Split into 3 bands |
| **Splitter MS** | — | Split into Mid/Side |
| **Utility** | Gain, Pan, Mix | Gain staging |

Effects can be duplicated (unlimited instances). Drag-and-drop reorder.

---

## 9. ARPEGGIATOR

### Parameters
| Parameter | VST3 Name | Description |
|-----------|-----------|-------------|
| Enable | `Arp Enable` | On/Off |
| Rate | `Arp Rate` | Speed (BPM-synced) |
| Shift | `Arp Shift` | Note shift |
| Range | `Arp Range` | Octave range |
| Offset | `Arp Offset` | Pattern offset |
| Repeats | `Arp Repeats` | Note repeats |
| Gate | `Arp Gate` | Note length |
| Chance | `Arp Chance` | Probability per step |
| Retrig Rate | `Arp Retrig Rate` | Retrigger speed |
| Velo Decay | `Arp Velo Decay` | Velocity fade |
| Velo Target | `Arp Velo Target` | Velocity target |
| Transpose | `Arp Transpose` | Transposition |

- **12 memory/snapshot slots** triggered via MIDI key ranges
- Octave range, swing, gate length control

---

## 10. CLIP SEQUENCER (Piano Roll)

| Parameter | VST3 Name |
|-----------|-----------|
| Enable | `Clip Player Enable` |
| Transpose | `Clip Player Transpose` |
| Rate | `Clip Player Rate` |
| Offset | `Clip Player Offset` |

- Built-in piano roll editor
- MIDI import support
- Up to 12 clip snapshots
- Per-note probability
- Automation lanes for macros
- Quantization options

---

## 11. GLOBAL / VOICING

| Parameter | VST3 Name | Default | Description |
|-----------|-----------|---------|-------------|
| Main Vol | `Main Vol` | 0.5 (-9dB) | Master volume |
| Main Tuning | `Main Tuning` | 0.5 (A440) | Global fine tune |
| Amp | `Amp` | 0.5 | Amplitude scaling |
| Porta Time | `Porta Time` | 0 | Portamento/glide time |
| Porta Curve | `Porta Curve` | 0.5 | Glide curve shape |
| Bend Up | `Bend Up` | 2 semi | Pitch bend up range |
| Bend Down | `Bend Down` | 2 semi | Pitch bend down range |
| Mono | `Mono Toggle` | Off | Monophonic mode |
| Legato | `Legato` | Off | Legato (don't retrigger envs) |
| Porta Always | `Porta Always` | Off | Glide on all notes (not just legato) |
| Porta Scaled | `Porta Scaled` | Off | Scale porta time by interval |
| Swing | `Swing` | OFF | Swing amount |
| Swing Div | `Swing Div` | 1/16 | Swing division |
| Transpose | `Transpose` | 0 | Global transpose |
| Direct Vol | `Direct Vol` | 0.5 | Direct bus volume |
| Bus 1 Vol | `Bus 1 Vol` | 0.5 | Bus 1 volume |
| Bus 2 Vol | `Bus 2 Vol` | 1.0 | Bus 2 volume |

### Randomization (per-voice)
| Parameter | Description |
|-----------|-------------|
| Detune Rand | Random pitch offset per voice |
| Pan Rand | Random pan per voice |
| Env Rand | Random envelope timing per voice |
| Cutoff Rand | Random filter cutoff per voice |

---

## 12. VST3 PARAMETER ID SCHEME

| ID Range | Category |
|----------|----------|
| 0-20 | Global |
| 1000000+ | OSC A |
| 1001000+ | OSC B |
| 1002000+ | OSC C |
| 1003000+ | Noise |
| 1004000+ | Sub |
| 2000000+ | Filter 1 |
| 2001000+ | Filter 2 |
| 3000000+ | Env 1 |
| 3001000+ | Env 2 |
| 3002000+ | Env 3 |
| 3003000+ | Env 4 |
| 4000000+ | LFO 1 |
| 4001000-4009000 | LFO 2-10 |
| 6000000+ | Mod Matrix (64 slots) |
| 7000000+ | Macros 1-8 |
| 9000000+ | Routing |
| 10000000+ | Clip Player |
| 12000000+ | Arpeggiator |
| 14000000+ | Key/Scale |
| 15000000+ | Global Osc randomization |
| 17000000+ | FX params |

**Total: 542 core params, 2622 total (incl. MIDI CC/AT/PB per-channel)**

---

## 13. PRESET FORMAT

### Serum 2: `.SerumPreset`
- Header: `b"XferJson\x00"` + uint64_le(json_length) + JSON metadata
- Payload: uint32_le(cbor_length) + uint32_le(2) + Zstandard-compressed CBOR data
- **Fully reverse-engineered**

### Programmatic Tools
| Tool | Language |
|------|----------|
| serum-preset-packager | Python (github.com/KennethWussmann) |
| node-serum2-preset-packager | TypeScript (github.com/CharlesBT) |
| preset.tools | Web-based editor |

---

## 14. SERUM 2 vs SERUM 1

| Feature | Serum 1 | Serum 2 |
|---------|---------|---------|
| Oscillators | 2 (A, B) | 3 (A, B, C) |
| Osc Modes | Wavetable only | Wavetable + Sample + Multisample + Granular + Spectral |
| Warp | Single per osc | Dual warp per osc + true FM |
| Filters | 1 | 2 (series/parallel) |
| Filter Types | ~30 | ~40+ (added Acid, EMS, Wasp, Dirty, PZ SVF, Diffusor, etc.) |
| Envelopes | 3 | 4 |
| LFOs | 4-8 | 10 (with Path, Lorenz, Rossler, S&H) |
| Macros | 4 | 8 |
| Mod Slots | ~32 | 64 |
| FX Buses | 1 | 3 (Direct + Bus 1 + Bus 2) |
| FX Modules | ~10 | 16 (added Bode, Convolve, Splitters, Utility) |
| Arpeggiator | No | Yes (12 snapshots) |
| Clip Sequencer | No | Yes (piano roll + MIDI import) |
| Presets | ~450 | 626 + 288 wavetables |
| Preset Format | .fxp | .SerumPreset |
| Plugin Format | VST2/VST3/AU/AAX | VST3/AU/AAX only |

---

## 15. SOUND DESIGN RECIPES

### Tecca-Style Bounce Pluck
- OSC A: Basic Shapes wavetable, WT pos ~35% (saw/square blend)
- OSC B: Digital wavetable, low level (~20%), slight detune
- Env 1: A=2ms, D=350ms, S=15%, R=120ms (sustain = groove)
- Filter 1: MG Low 12, cutoff 45%, res 20%
- Env 2 → Filter cutoff (plucky sweep)
- Velocity → cutoff + WT pos (dynamics = brightness + timbre)
- LFO 1 (S&H, Trigger) → pitch + cutoff + pan (micro-variation per hit)

### 808 Sub Bass
- OSC A: Wavetable, sine wave (Basic Shapes pos 0%)
- Env 1: A=0, D=2s, S=0, R=400ms
- Filter: Off or MG Low 24 (very low cutoff)
- Mono mode, portamento for slides

### Pad / Atmosphere
- OSC A + B: Different wavetables, slow WT position modulation
- High unison (8-16 voices), wide detune
- Filter: Low 12 or LP, high cutoff, slight res
- Env 1: Long A (500ms+), high S, long R
- LFO → WT position (slow, evolving)
- FX: Reverb (large), Chorus, Delay

### Acid Lead
- OSC A: Saw wavetable
- Filter 1: **Acid Ladder** (the 303 filter)
- Env 2 → cutoff with high depth, short decay
- Res: 60-80% for squelch
- Mono, legato, short portamento
- Distortion FX (Tube or Hard Clip)

---

## 16. DAW INTEGRATION NOTES

### Ableton + M4L Bridge Control
- Load Serum 2 via `load_plugin` (name: "Serum", manufacturer: "Xfer Records")
- Query params via `get_device_params` — returns all 542 core params
- Set params via `set_param` by index or name
- FX params are DYNAMIC — only visible after right-click > Automate in Serum UI
- Use `Main Tuning` as mod destination for all-osc pitch control
- Use CRS (Coarse Pitch) for smooth pitch sweeps via automation

### Automation Best Practices
- Separate OCT/SEM/FIN/CRS controls for different automation use cases
- OCT for octave jumps, CRS for smooth sweeps
- Mod matrix amounts are automatable, but sources/destinations are NOT
- FX params require manual "Automate" registration first
