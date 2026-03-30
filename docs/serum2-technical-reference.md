# Serum 2 Technical Reference for Programmatic Control

> Compiled 2026-03-30 from official docs, reverse engineering notes, VST3 parameter dumps, and community research.

---

## 1. Architecture Overview

Serum 2 by Xfer Records (released March 2025) is an advanced hybrid synthesizer available as VST3, AU, and AAX (64-bit only). It is a free upgrade for Serum 1 owners. Price: $249 USD for new users.

### Signal Flow

```
OSC A/B/C ──┐
Noise ──────┤──> Mixer ──> Filter 1 ──┐
Sub ────────┘              Filter 2 ──┤──> Direct Out ──> Main FX Chain ──> Output
                                      ├──> FX Bus 1
                                      └──> FX Bus 2
```

Each oscillator, noise, and sub can be independently routed to Filter 1, Filter 2, or a blend between them. Each filter output and each oscillator can also route directly to FX Bus 1, FX Bus 2, or the Direct bus.

---

## 2. Oscillators

### Count: 3 primary oscillators (A, B, C) + Sub + Noise

Each primary oscillator supports 5 synthesis modes:

| Mode | Description |
|------|-------------|
| **Wavetable** | Classic Serum wavetable with smooth interpolation, dual warp modes, up to 256 frames per table |
| **Multisample** | SFZ format instrument layers with velocity/articulation mapping. Ships with orchestra, choir, pianos, guitars |
| **Sample** | Single-sample playback with loop points, crossfades, slicing (manual/auto), rate control (tape stop), score extraction |
| **Granular** | Up to 256 simultaneous grains, density up to 30 grains, grain length down to 0ms, window shape control, offset/direction randomization |
| **Spectral** | Real-time harmonic resynthesis, transient detection, spectral filtering (drawable filter curve), spectral warps (spread partials, boost harmonics, gate, twist phases, vocoding from other oscillators) |

### Sub Oscillator
- Basic waveform generator (sine, triangle, saw, square, etc.)
- Pitch tracking, octave control, coarse pitch

### Noise Oscillator
- Sample-based noise with pitch tracking toggle
- Independent level and pan

### Unison
- Up to **16 voices** per oscillator
- Unison parameters per oscillator: Detune, Blend, Width, Span, Random Start, Warp, Warp 2
- **Stacking modes**: Off, and transposition-based stacking (e.g., 12+7 distributing voices across octave and fifth intervals, 1-3 octaves range)
- **Tuning modes**: Harmonic, Ratio, Semitone, Step

### Wavetable Warp Modes (per oscillator, dual-warp -- two can run simultaneously)

**Serum 1 legacy modes:**
- Sync (Self-Sync) -- formant-shifted, repeats faster and restarts
- Windowed Sync
- Bend +, Bend -, Bend +/-
- PWM (Pulse Width Modulation)
- Asym +, Asym -, Asym +/-
- Flip
- Mirror
- Remap 1, Remap 2, Remap 3, Remap 4
- Quantize
- FM (from other OSC) -- technically Phase Distortion in Serum 1
- AM (Amplitude Modulation from other OSC)
- RM (Ring Modulation from other OSC)
- FM from Noise, FM from Sub

**New in Serum 2:**
- True modular-style FM (distinct from PD-based "FM from B")
- PD (Phase Distortion) explicitly separated from FM
- Dual Warp Mode (two warp modes simultaneously)
- New timbre-shifting warps
- New saturation/distortion warp types
- Filtering warp types

---

## 3. Filters

### Count: 2 dual filters (Filter 1 and Filter 2)

### Routing: Series or Parallel
- Per-oscillator Filter Balance control (-100 to +100, routing between Filter 1 and Filter 2)

### Filter Parameters (per filter)
- Type, Frequency (Cutoff), Resonance, Drive, Var, Stereo, Level, X, Y, Wet

### Filter Type Categories

**Classic Serum filters (carried from v1):**
- MG Low 12 (Moog-style low-pass 12dB)
- MG Low 24 (Moog-style low-pass 24dB)
- MG High (Moog-style high-pass)
- MG Band (Moog-style band-pass)
- Low Pass, High Pass, Band Pass, Notch (generic SVF variants)
- Comb +, Comb -
- Phaser
- Flanger
- Sample & Hold

**New in Serum 2:**
- **MG Dirty** -- Moog-style with added grit/distortion
- **Acid Ladder** -- TB-303 style resonant ladder filter
- **EMS Ladder** -- EMS VCS3 style filter
- **Wasp** -- Wasp synth style filter
- **K35** -- Korg MS-20 style filter with LP-to-HP morphing
- **Comb 2** -- New comb filter variant
- **Diffuser** -- Disperser-style allpass diffusion filter
- **PZ SVF** (S2 Filters category) -- Fully drawable parametric/state-variable filter with custom frequency response curves, morphable between drawn shapes via modulation
- Drive-based / Clean Drive filter variants
- Analog-mode filters with added saturation behavior

### Default Filter Type value
The VST3 parameter `Filter 1 Type` (ID 2000002) defaults to 0.009434 which maps to "MG Low 12". The type parameter is a normalized float that maps to the full filter list.

---

## 4. Envelopes

### Count: 4 envelopes (Env 1-4)

Env 1 is hardwired to amplitude (VCA). Env 2-4 are assignable.

### Parameters per Envelope

| Parameter | VST3 Name | Description |
|-----------|-----------|-------------|
| Attack | `Env N Attack` | Attack time |
| Hold | `Env N Hold` | Hold time after attack |
| Decay | `Env N Decay` | Decay time |
| Sustain | `Env N Sustain` | Sustain level |
| Release | `Env N Release` | Release time |
| Attack Curve | `Env N Atk Curve` | Shape of attack curve |
| Decay Curve | `Env N Dec Curve` | Shape of decay curve |
| Release Curve | `Env N Rel Curve` | Shape of release curve |
| Start Level | `Env N Start` | Start level (Env 2-4 only) |
| End Level | `Env N End` | End level (Env 2-4 only) |

### Envelope Features
- BPM synchronization
- Legato inversion mode
- Fully editable modulation remap curves

---

## 5. LFOs

### Count: 10 LFOs (LFO 1-10)

### Parameters per LFO

| Parameter | VST3 Name | Description |
|-----------|-----------|-------------|
| Rate | `LFO N Rate` | Speed (free or BPM-synced) |
| Smooth | `LFO N Smooth` | Smoothing amount |
| Rise | `LFO N Rise` | Fade-in time |
| Delay | `LFO N Delay` | Delay before LFO starts |
| Phase | `LFO N Phase` | Starting phase offset |

### LFO Modes

| Mode | Description |
|------|-------------|
| **Standard** | Draw custom waveform shapes on grid, independent X/Y grid sizes |
| **Path** | Draw XY vector path, produces dual X and Y modulation outputs (effectively 2 mod sources per LFO) |
| **Lorenz** | Chaos attractor, produces X and Y outputs, controlled unpredictability |
| **Rossler** | Chaos attractor variant, produces X and Y outputs |
| **S&H** | Sample & Hold, stepped random modulation |

### LFO Features
- Maximum rate up to 1 kHz (audio-rate modulation for harmonics)
- BPM sync
- Drawable shapes with independent X/Y grid resolution
- LFO point modulation (modulate individual shape points)
- Modulation remapping (remap any mod output through a custom curve)
- With Path and Chaos modes producing dual X/Y outputs, effective total: up to 20 modulation sources from LFOs alone

---

## 6. Modulation Matrix

### Slots: 64 modulation slots (Mod 1 through Mod 64)

### Parameters per Slot

| Parameter | VST3 Name | Description |
|-----------|-----------|-------------|
| Amount | `Mod N Amount` | Modulation depth (bipolar, 0.5 = center/no mod) |
| Out | `Mod N Out` | Output scaling (0-100%) |

### Modulation Sources
- Env 1-4
- LFO 1-10 (including X/Y outputs for Path/Chaos modes)
- Macro 1-8
- Mod Wheel
- Velocity
- Key Tracking
- Aftertouch
- Pitch Bend
- Note (MIDI note number)
- Random (per-note random)
- Oscillators A, B, C (audio-rate modulation)
- Sub, Noise (as mod sources)
- Any MIDI CC (CC0-CC127 on channels 1-16)

### Modulation Destinations
Virtually every continuous parameter in the synth including:
- All oscillator parameters (level, pan, pitch, position, warp, unison params)
- Filter parameters (cutoff, resonance, drive, etc.)
- Envelope parameters (attack, decay, sustain, release, curves)
- LFO parameters (rate, smooth, rise, delay, phase -- modulate LFOs with LFOs)
- FX parameters
- Macro values
- Mixer levels and routing

### Matrix Features
- Drag-and-drop reordering
- Individual mod bypass
- Aux/source curves (remapping)
- Visual mod flow display
- Modulation of modulation (LFOs controlling other LFO parameters)

---

## 7. Macros

### Count: 8 macros (up from 4 in Serum 1)

| VST3 ID | Name | Default |
|---------|------|---------|
| 7000000 | Macro 1 | 0 |
| 7001000 | Macro 2 | 0 |
| 7002000 | Macro 3 | 0 |
| 7003000 | Macro 4 | 0 |
| 7004000 | Macro 5 | 0 |
| 7005000 | Macro 6 | 0 |
| 7006000 | Macro 7 | 0 |
| 7007000 | Macro 8 | 0 |

---

## 8. Effects (FX)

### FX Bus Architecture
- **3 independent FX chains**: Direct/Main, FX Bus 1, FX Bus 2
- Effects can be duplicated (unlimited instances of same effect type)
- Drag-and-drop reordering
- Each chain has 16 parameter slots exposed to automation (`FX Main Param 1-16`, `FX Bus 1 Param 1-16`, `FX Bus 2 Param 1-16`)

### Available Effect Modules

**Carried from Serum 1:**
- Distortion (multiple algorithms)
- Flanger
- Phaser
- Chorus
- Delay
- Compressor
- EQ (parametric)
- Reverb (Hall, Plate algorithms)
- Filter (as FX)
- Hyper (unison-style thickening FX)

**New in Serum 2:**
- **Echobode** -- Bode frequency shifter with delay in feedback path and diffusion control
- **Convolve** -- Convolution reverb with IR library (ships with IRs, supports custom IR loading)
- **Vintage Reverb** -- Old-school character reverb algorithm
- **Nitrous Reverb** -- Lush, expansive reverb algorithm
- **Basin Reverb** -- Creative ambience reverb algorithm
- **Updated Overdrive** -- Enhanced overdrive/distortion with new modes
- **High Quality Delay** -- Improved delay algorithm
- **Utility FX** -- Gain, pan, stereo tools
- **Frequency Splitter (L/H)** -- Split signal into Lows/Highs for independent processing
- **Frequency Splitter (L/M/H)** -- Split into Lows/Mids/Highs
- **Mid/Side Splitter** -- Split into Mid/Side channels

**Total**: ~13+ distinct effect module types, with 5 reverb algorithms total (Hall, Plate, Vintage, Nitrous, Basin).

---

## 9. Arpeggiator & Clip Sequencer

### Arpeggiator

| Parameter | VST3 Name |
|-----------|-----------|
| Enable | `Arp Enable` |
| Rate | `Arp Rate` |
| Shift | `Arp Shift` |
| Range | `Arp Range` |
| Offset | `Arp Offset` |
| Repeats | `Arp Repeats` |
| Gate | `Arp Gate` |
| Chance | `Arp Chance` |
| Retrig Rate | `Arp Retrig Rate` |
| Velo Decay | `Arp Velo Decay` |
| Velo Target | `Arp Velo Target` |
| Transpose | `Arp Transpose` |
| Wrap Transpose | `Arp Wrap Transpose` |
| Wrap Range | `Arp Wrap Range` |
| Wrap Phantom Note | `Arp Wrap Phantom Note` |

- **12 memory/snapshot slots** triggered via MIDI key ranges
- Octave range, swing, gate length control

### Clip Sequencer (Piano Roll)

| Parameter | VST3 Name |
|-----------|-----------|
| Enable | `Clip Player Enable` |
| Transpose | `Clip Player Transpose` |
| Rate | `Clip Player Rate` |
| Offset | `Clip Player Offset` |

- In-synth piano roll editor
- MIDI import support
- Up to 12 clip snapshots
- Probability settings per note
- Automation lanes for macros
- Overdub/extend recording
- Quantization

### Global Scale & Swing
- `Scale` parameter (ID 14000001): Constrains output to musical scales (default: Major)
- `Swing` parameter (ID 14): Swing amount
- `Swing Div` parameter (ID 15): Swing division (default: 1/16)

---

## 10. VST3 Parameter Reference

### Parameter ID Scheme

Serum 2 uses a hierarchical ID numbering system:

| ID Range | Category |
|----------|----------|
| 0-20 | Global (Main Vol, Tuning, Porta, Bend, Swing, Bypass, Bus volumes) |
| 1000000-1000050+ | Oscillator A |
| 1001000-1001050+ | Oscillator B |
| 1002000-1002050+ | Oscillator C |
| 1003000-1003036 | Noise |
| 1004000-1004035 | Sub |
| 2000000-2000010 | Filter 1 |
| 2001000-2001010 | Filter 2 |
| 3000000-3000007 | Envelope 1 |
| 3001000-3001009 | Envelope 2 |
| 3002000-3002009 | Envelope 3 |
| 3003000-3003009 | Envelope 4 |
| 4000000-4000004 | LFO 1 |
| 4001000-4009004 | LFO 2-10 |
| 6000000-6063001 | Mod Matrix (64 slots, Amount + Out each) |
| 7000000-7007000 | Macros 1-8 |
| 9000000-9006002 | Routing (Osc>Filter Balance, Osc>Bus, Filter>Bus) |
| 10000000-10000003 | Clip Player |
| 12000000-12000014 | Arpeggiator |
| 14000000-14000001 | Key, Scale |
| 15000000-15000003 | Global Osc (Detune Rand, Pan Rand, Env Rand, Cutoff Rand) |
| 17000000-17002015 | FX (Main 1-16, Bus1 1-16, Bus2 1-16) |

**Total exposed VST3 parameters: 2,622** (including 2,048 MIDI CC parameters across 128 CCs x 16 channels, and 256 Aftertouch/Pitch Bend per-channel params).

**Core synth parameters (excluding MIDI CC/Aftertouch/PitchBend per-channel): 542**

### Key Oscillator Parameters (per osc A/B/C)

| VST3 Name | Description |
|-----------|-------------|
| `A Enable` | On/Off |
| `A Level` | Volume (0-1, default 0.75 = -5dB) |
| `A Pan` | Stereo pan |
| `A Octave` | Octave transpose |
| `A Semi` | Semitone transpose |
| `A Fine` | Fine tuning (cents) |
| `A Coarse Pitch` | Continuous pitch (no snap), for automation sweeps |
| `A Ratio` | Frequency ratio |
| `A Hz Offset` | Hz offset |
| `A Pitch Track` | Keyboard tracking on/off |
| `A Start` | Sample/WT start position |
| `A End` | Sample/WT end position |
| `A Reverse` | Forward/Reverse |
| `A Scan Rate` | WT/sample scan rate |
| `A Scan BPM Rate` | BPM-synced scan rate |
| `A Scan Key Track` | Key tracking for scan |
| `A Position` | Wavetable position |
| `A Loop Start` | Loop start point |
| `A Loop End` | Loop end point |
| `A Loop X-Fade` | Loop crossfade |
| `A Loop Mode` | One-shot, Loop, etc. |
| `A Relative Loop` | Relative loop toggle |
| `A Single Slice` | Slice number |
| `A Slice Play Mode` | "To Next Marker" etc. |
| `A Unison` | Number of unison voices (0=1 voice, up to 16) |
| `A Uni Stack` | Unison stacking mode |
| `A Uni Detune` | Unison detuning amount |
| `A Uni Blend` | Unison blend |
| `A Uni Width` | Stereo width of unison |
| `A Uni Span` | Unison span |
| `A Uni Rand Start` | Random start phase per voice |
| `A Uni Warp` | Warp amount for unison |
| `A Uni Warp 2` | Second warp for unison |
| `A Param34-51` | Reserved/dynamic parameters (context-dependent on oscillator mode) |

B and C oscillators follow identical naming: `B Enable`, `B Level`, `C Position`, etc.

### Global Parameters

| VST3 ID | Name | Default | Display |
|---------|------|---------|---------|
| 0 | Main Vol | 0.5 | 50% [-9.0 dB] |
| 1 | Main Tuning | 0.5 | 0.5000 |
| 2 | Amp | 0.5 | 0.5000 |
| 3 | Porta Time | 0 | 0 ms |
| 4 | Porta Curve | 0.5 | 0 |
| 5 | Bend Up | 26 | 2 semitones |
| 6 | Bend Down | 22 | -2 semitones |
| 7 | Pitch Bend | 0.5 | 0.00 |
| 8 | Mod Wheel | 0 | 0 |
| 10 | Mono Toggle | 0 | Off |
| 11 | Legato | 0 | Off |
| 12 | Porta Always | 0 | Off |
| 13 | Porta Scaled | 0 | Off |
| 14 | Swing | 3 | OFF |
| 15 | Swing Div | 24 | 1/16 |
| 16 | Transpose | 1 | 0 |
| 17 | Bypass | 0 | Off |
| 18 | Direct Vol | 0.5 | -0.0 dB |
| 19 | Bus 1 Vol | 0.5 | -0.0 dB |
| 20 | Bus 2 Vol | 1.0 | -0.0 dB |

### Routing Parameters

| VST3 ID | Name | Description |
|---------|------|-------------|
| 9000000 | A>Filter Balance | -100 (Filter 1) to +100 (Filter 2) |
| 9000001 | A>BUS1 | Send to FX Bus 1 |
| 9000002 | A>BUS2 | Send to FX Bus 2 |
| 9001000 | B>Filter Balance | |
| 9001001 | B>BUS1 | |
| 9001002 | B>BUS2 | |
| 9002000 | C>Filter Balance | |
| 9002001 | C>BUS1 | |
| 9002002 | C>BUS2 | |
| 9003000 | Noise>Filter Balance | |
| 9003001 | Noise>BUS1 | |
| 9003002 | Noise>BUS2 | |
| 9004000 | Sub Osc>Filter Balance | |
| 9004001 | Sub Osc>BUS1 | |
| 9004002 | Sub Osc>BUS2 | |
| 9005001 | Filter 1>BUS1 | |
| 9005002 | Filter 1>BUS2 | |
| 9006001 | Filter 2>BUS1 | |
| 9006002 | Filter 2>BUS2 | |

---

## 11. Serum 2 vs Serum 1 Comparison

| Feature | Serum 1 | Serum 2 |
|---------|---------|---------|
| Primary Oscillators | 2 (A, B) | 3 (A, B, C) |
| Oscillator Types | Wavetable only | Wavetable, Multisample, Sample, Granular, Spectral |
| Warp Modes | Single warp per osc | Dual warp per osc + true FM |
| Filters | 1 | 2 (series/parallel) |
| Filter Types | Standard set | Expanded (Acid, EMS, Wasp, K35, Diffuser, PZ SVF, etc.) |
| Envelopes | 3 | 4 |
| LFOs | 8 (some sources say 4) | 10 (with Path, Chaos, S&H modes) |
| LFO Modes | Standard shapes | Standard, Path (XY), Lorenz, Rossler, S&H |
| Macros | 4 | 8 |
| Mod Matrix Slots | ~32 | 64 |
| FX Chains | 1 (serial only) | 3 (Direct + Bus 1 + Bus 2), unlimited effect duplication |
| FX Modules | ~10 | ~13+ (added Echobode, Convolve, 3 new reverbs, splitters) |
| Arpeggiator | No | Yes (12 snapshots) |
| Clip Sequencer | No | Yes (MIDI piano roll, 12 clips) |
| Global Scale | No | Yes |
| Swing | No | Yes |
| Mixer Panel | No | Yes (visual routing) |
| Unison Voices | Up to 16 | Up to 16 |
| Factory Presets | ~450 | 626 presets + 288 wavetables |
| Preset Format | .fxp | .SerumPreset |
| Backward Compatible | -- | Yes (loads all Serum 1 presets) |
| "Serum 1 compatibility" toggle | -- | Yes (exact DSP replication mode) |
| Plugin Formats | VST2, VST3, AU, AAX | VST3, AU, AAX (no VST2) |

---

## 12. Preset Format

### Serum 1: `.fxp`
- Based on Steinberg VST FXP format
- Binary format with plugin-specific data sections
- Wavetable data embedded (up to 4MB per preset)
- Wavetable: 2048 samples per frame, up to 256 frames, 32-bit float, little-endian
- Partially reverse-engineered (see 0xdevalias gist below)

### Serum 2: `.SerumPreset`
- **New XferJson-based format, fully reverse-engineered**
- Structure:
  1. Header: `b"XferJson\x00"` + `uint64_le(json_length)` + JSON metadata
  2. Payload: `uint32_le(cbor_length)` + `uint32_le(2)` + Zstandard-compressed CBOR data
- JSON header contains preset metadata (name, author, tags, etc.)
- CBOR payload contains all synth state (parameters, wavetables, samples, etc.)

### Programmatic Preset Tools

| Tool | Language | URL |
|------|----------|-----|
| serum-preset-packager | Python | https://github.com/KennethWussmann/serum-preset-packager |
| node-serum2-preset-packager | TypeScript/Node.js | https://github.com/CharlesBT/node-serum2-preset-packager |
| SerumPresetGenerator | C# | https://github.com/potatoTeto/SerumPresetGenerator (Serum 1 .fxp only) |
| preset.tools | Web | https://preset.tools/ (web-based .SerumPreset editor) |

### Creating Presets Programmatically

```bash
# Unpack a .SerumPreset to JSON
python cli.py unpack MyPreset.SerumPreset MyPreset.json

# Edit the JSON (all parameters, wavetable references, metadata)

# Pack it back
python cli.py pack MyPreset.json MyPreset.SerumPreset
```

```typescript
// Node.js / TypeScript (node-serum2-preset-packager)
import { decode, encode } from 'node-serum2-preset-packager';

const preset = decode(readFileSync('MyPreset.SerumPreset'));
// Modify preset.metadata, preset.data, etc.
const packed = encode(preset);
writeFileSync('Modified.SerumPreset', packed);
```

### Serum 1 Legacy Parameter Names (from Pedalboard dump)

These are the parameter names exposed by Serum 1 via Spotify Pedalboard, included for cross-reference:

```
mastervol, a_vol, a_pan, a_octave, a_semi, a_fine, a_unison, a_unidet,
a_uniblend, a_warp, a_coarsepit, a_wtpos, a_randphase, a_phase,
b_vol, b_pan, b_octave, b_semi, b_fine, b_unison, b_unidet, b_uniblend,
b_warp, b_coarsepit, b_wtpos, b_randphase, b_phase,
noise_level, noise_pitch, noise_fine, noise_pan, noise_randphase, noise_phase,
sub_osc_level, sub_osc_pan,
env1_atk, env1_hold, env1_dec, env1_sus, env1_rel,
osca_fil, oscb_fil, oscn_fil, oscs_fil, fil_type, ...
```

---

## 13. DAW Automation Notes

### VST3 Parameter Automation
- All 542 core parameters are automatable via VST3 parameter IDs
- FX parameters are exposed as generic `FX Main Param 1-16`, `FX Bus 1 Param 1-16`, `FX Bus 2 Param 1-16` -- the meaning of each slot changes based on which effects are loaded and in what order
- MIDI CC assignments are saved/recalled with DAW sessions and can optionally be saved with presets (enable "Load MIDI Map from Preset" preference)
- Pitch controls separated for automation: OCT (octave), SEM (semitone), FIN (fine), CRS (coarse continuous) -- use CRS for smooth pitch sweeps
- Use `Main Tuning` as modulation destination to have all oscillators follow a coarse pitch change

### Known Issues
- Recent updates fixed VST3 parameter automation recall for effect parameters
- Logic Pro had issues assigning wrong automation parameters when loading old projects (fixed in later Serum 2 updates)

### MIDI CC Support
- Full CC0-CC127 across 16 MIDI channels exposed as VST3 parameters
- Aftertouch per-channel (16 channels)
- Pitch Bend per-channel (16 channels)

---

## 14. System Requirements

- **Windows**: Windows 10+
- **macOS**: High Sierra+ (Intel), Big Sur+ (Apple Silicon, native)
- **Formats**: VST3, AU, AAX (64-bit only)
- **Demo**: Available, 15-minute session limit

---

## 15. Key Data Sources

### Complete VST3 Parameter Dump
- https://gist.github.com/KennethWussmann/5b58e4de728680a0bf8906a8b113103d#file-serum-2-vst3-parameters-json
  - Full JSON: 2,622 parameters with IDs, names, default values, and display strings
  - Local copy saved at `/tmp/serum2-vst3-params.json`

### Reverse Engineering Notes
- https://gist.github.com/0xdevalias/135a18e979ac8e302ebbc700a50a8d74 -- Supplementary notes on preset format RE
- https://gist.github.com/0xdevalias/5a06349b376d01b2a76ad27a86b08c1b -- Main notes on generating synth patches with AI, interacting with VSTs from code

### Official Resources
- Product page: https://xferrecords.com/products/serum-2
- Web manual: https://xferrecords.com/web-manual/serum-2/welcome
- "What's New" PDF: https://static.xferrecords.com/Serum%202%20What's%20New.pdf
- Changelog: https://gist.github.com/0xdevalias/a537a59d1389d5aed3bc63b544c70c8d

### Community Resources
- Sonic Weaponry full feature breakdown: https://sonic-weaponry.com/blogs/free-production-tutorials-and-resources/serum-2-released
- Surge Sounds complete guide: https://surgesounds.com/post/serum-2-new-features-complete-producers-guide
- Splice advanced features tutorial: https://splice.com/blog/serum-2-advanced-features/
- Databroth in-depth review: https://www.databroth.com/blog/serum-2-review
- Pitch Innovations comparison: https://pitchinnovations.com/blog/serum-1-vs-serum-2-heres-everything-you-need-to-know-serum-vst/
- EDMProd beginner guide: https://www.edmprod.com/serum-2-guide/
- ModeAudio introduction: https://modeaudio.com/magazine/an-introduction-to-serum-2
- Production Music Live top 8 updates: https://www.productionmusiclive.com/blogs/news/top-8-updates-in-xfer-serum-2-2025
