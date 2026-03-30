# Serum 2 — VST3 Parameter Reference for Programmatic Control

> Comprehensive reference for controlling Serum 2 parameters from a DAW bridge (OSC, remote scripts, or VST3 host API).
> Compiled from: Serum 2 manual (v2.0, March 2025), Serum 1 manual (v1.0.1), Xfer Records changelogs through v2.0.23, Steve Duda forum posts, and community documentation.
> Last updated: 2026-03-30

---

## CRITICAL: How Serum 2 Exposes Parameters to DAWs

### Static vs Dynamic Parameters

Serum 2 divides its automation parameters into two categories:

1. **Static parameters** — Always available in the DAW's automation list. These include oscillator controls, filter controls, envelope controls, LFO controls, macros, voicing, and mixer parameters. These are the parameters you can reliably address by name/index from external code.

2. **Dynamic parameters (FX only)** — FX parameters are NOT pre-registered in the automation list. Per Steve Duda (Xfer Records, April 2025): _"The effects are dynamic, they require right-click -> Automate to automate them. Otherwise we would have had to provide a static structure for automation parameters — you'd have a million items in a list, literally, and I'm pretty sure DAWs would have collapsed trying to build that menu."_ This means FX parameters only become visible to the DAW after the user right-clicks the parameter in Serum's GUI and selects "Automate." In Bitwig, a plugin reload may be required for the new parameter to appear.

### Parameter Naming Convention

Serum 2 uses a **"Section Parameter"** naming convention for its VST3 exposed parameters. The exact names as they appear in DAW automation lanes follow the patterns documented below. Parameter values are normalized 0.0-1.0 in VST3.

### Known Bug (Fixed in v2.0.18+)

Changelog v2.0.18: _"Fixed 2.0.17 Parameter Automation recall of effect parameters offset by one index after project reload."_ If using an older version, FX parameter indices may be shifted by one.

---

## 1. OSCILLATOR PARAMETERS

Serum 2 has **three primary oscillators** (OSC A, OSC B, OSC C), plus **Sub** and **Noise** oscillators.

### Per-Oscillator Controls (OSC A / OSC B / OSC C)

Each oscillator exposes these parameters (prefix with oscillator name):

| Parameter Name | Range | Description |
|---|---|---|
| `Osc A On` | 0/1 | Enable/disable oscillator |
| `Osc A Level` | 0-100% | Output volume |
| `Osc A Pan` | -100% to +100% | Stereo panning (center = 50% normalized) |
| `Osc A Octave` | -4 to +4 | Octave transpose |
| `Osc A Semi` | -12 to +12 | Semitone transpose |
| `Osc A Fine` | -100 to +100 cents | Fine tuning |
| `Osc A Coarse` | continuous | Coarse pitch (smooth, for modulation/automation) |
| `Osc A WT Pos` | 0-100% | Wavetable position (which frame plays) |
| `Osc A Warp` | 0-100% | Warp amount (depth of selected warp mode) |
| `Osc A Warp 2` | 0-100% | Second warp amount (NEW in Serum 2 — dual warp) |
| `Osc A Phase` | 0-100% | Phase start position (100% = "Mem" / phase memory) |
| `Osc A Random` | 0-100% | Random phase offset per voice |
| `Osc A Unison Detune` | 0-100% | Unison voice detuning amount |
| `Osc A Unison Blend` | 0-100% | Unison voice level balance (default 75%) |

**Note on OSC C**: New in Serum 2. Same parameter set as OSC A/B. Parameter names follow the pattern `Osc C WT Pos`, `Osc C Level`, etc.

### Oscillator Modes (per oscillator)

Each oscillator can be set to one of 5 modes:
- **Wavetable** (default, classic Serum behavior)
- **Sample** (single sample with loop/slice/crossfade)
- **Multisample** (SFZ instrument layers)
- **Granular** (grain-based synthesis, up to 256 grains)
- **Spectral** (frequency spectrum resynthesis)

Mode-specific parameters (Sample/Granular/Spectral) include additional controls like `Start`, `End`, `Loop Start`, `Loop End`, `Crossfade`, `Scan Rate`, `Grain Size`, `Window`, `Hi Freq`, `Lo Freq`, `Timbre` — these become available when the oscillator is in the corresponding mode.

### Sub Oscillator

| Parameter Name | Range | Description |
|---|---|---|
| `Sub On` | 0/1 | Enable/disable |
| `Sub Level` | 0-100% | Output volume |
| `Sub Pan` | -100% to +100% | Stereo panning |
| `Sub Octave` | -4 to +4 | Octave (NEW in Serum 2: modulatable) |
| `Sub Direct` | 0-100% | Direct output level (bypass filter) |

### Noise Oscillator

| Parameter Name | Range | Description |
|---|---|---|
| `Noise On` | 0/1 | Enable/disable |
| `Noise Level` | 0-100% | Output volume |
| `Noise Pan` | -100% to +100% | Stereo panning |
| `Noise Pitch` | 0-100% | Playback pitch (50% = nominal) |
| `Noise Phase` | 0-100% | Start position ("sample start") |
| `Noise Random` | 0-100% | Random start offset per voice |

Noise oscillator types (Serum 2): White, Pink, Brown, Geiger, plus all user noise samples.

---

## 2. FILTER PARAMETERS

Serum 2 has **dual filters** (Filter 1 and Filter 2) that can run in **series** or **parallel**.

### Per-Filter Controls

| Parameter Name | Range | Description |
|---|---|---|
| `Filter 1 On` | 0/1 | Enable/disable |
| `Filter 1 Cutoff` | 0-100% | Cutoff frequency |
| `Filter 1 Res` | 0-100% | Resonance |
| `Filter 1 Drive` | 0-100% | Drive/saturation amount |
| `Filter 1 Var` | 0-100% | Variable parameter (function depends on filter type) |
| `Filter 1 Mix` | 0-100% | Wet/dry mix (100% = full wet) |
| `Filter 1 Stereo` | 0-100% | L/R cutoff offset (50% = no offset) |

Same parameter set for Filter 2: `Filter 2 Cutoff`, `Filter 2 Res`, etc.

### Filter Types (Complete List)

#### Serum 1 Legacy Types (all retained in Serum 2)

| Type Name | Category | Var Function |
|---|---|---|
| `MG Low 6` | Moog-style ladder LP 6dB/oct | Fat amount |
| `MG Low 12` | Moog-style ladder LP 12dB/oct | Fat amount |
| `MG Low 18` | Moog-style ladder LP 18dB/oct | Fat amount |
| `MG Low 24` | Moog-style ladder LP 24dB/oct | Fat amount |
| `Low 6` | State-variable LP 6dB/oct | Fat amount |
| `Low 12` | State-variable LP 12dB/oct | Fat amount |
| `Low 18` | State-variable LP 18dB/oct | Fat amount |
| `Low 24` | State-variable LP 24dB/oct | Fat amount |
| `High 6` | State-variable HP 6dB/oct | Fat amount |
| `High 12` | State-variable HP 12dB/oct | Fat amount |
| `High 18` | State-variable HP 18dB/oct | Fat amount |
| `High 24` | State-variable HP 24dB/oct | Fat amount |
| `Band` | Bandpass | Fat amount |
| `Peak` | Peak/resonant | Fat amount |
| `Notch` | Notch (band-reject) | Fat amount |
| `LH` | Dual SVF: Low + High | 2nd cutoff freq |
| `LB` | Dual SVF: Low + Band | 2nd cutoff freq |
| `LP` | Dual SVF: Low + Peak | 2nd cutoff freq |
| `LN` | Dual SVF: Low + Notch | 2nd cutoff freq |
| `HB` | Dual SVF: High + Band | 2nd cutoff freq |
| `HP` | Dual SVF: High + Peak | 2nd cutoff freq |
| `HN` | Dual SVF: High + Notch | 2nd cutoff freq |
| `BP` | Dual SVF: Band + Peak | 2nd cutoff freq |
| `BN` | Dual SVF: Band + Notch | 2nd cutoff freq |
| `PP` | Dual SVF: Peak + Peak | 2nd cutoff freq |
| `PN` | Dual SVF: Peak + Notch | 2nd cutoff freq |
| `NN` | Dual SVF: Notch + Notch | 2nd cutoff freq |
| `LBH` | Morphing SVF: Low-Band-High | Morph position |
| `LPH` | Morphing SVF: Low-Peak-High | Morph position |
| `LNH` | Morphing SVF: Low-Notch-High | Morph position |
| `BPN` | Morphing SVF: Band-Peak-Notch | Morph position |
| `Comb L` | Comb + LP feedback | LP cutoff |
| `Comb H` | Comb + HP feedback | HP cutoff |
| `Comb HL` | Comb + HP+LP feedback | HL band width |
| `Flange L` | Flanger + LP feedback | LP cutoff |
| `Flange H` | Flanger + HP feedback | HP cutoff |
| `Flange HL` | Flanger + HP+LP feedback | HL band width |
| `Phase L` | Phaser + LP feedback | LP cutoff |
| `Phase H` | Phaser + HP feedback | HP cutoff |
| `Phase HL` | Phaser + HP+LP feedback | HL band width |
| `EQ Shelf` | EQ shelf (L/H) | dB Gain |
| `EQ Peak` | EQ parametric peak | dB Gain |
| `Combs` | Comb filters | (varies) |
| `Allpasses` | Allpass filter | (varies) |
| `Reverb` | Reverb-style filter | Damping |
| `French LP` | Unique distorting LP (French style) | Boeuf |
| `German LP` | Clean zero-delay-feedback LP | (none) |
| `Add Bass` | Phase-rotated LP + drive | Thru (phase-shifted dry) |
| `Formant 1` | Formant vowel filter | Formant shift |
| `Formant 2` | Formant vowel filter | Formant shift |
| `Formant 3` | Formant vowel filter | Formant shift |

#### Serum 2 New Filter Types

| Type Name | Category | Description |
|---|---|---|
| `MG Ladder` | New Moog ladder emulation | Improved analog ladder model |
| `Acid Ladder` | TB-303 style acid ladder | Roland TB-303 resonant character |
| `EMS Ladder` | EMS VCS3 style ladder | EMS analog character |
| `MG Dirty` | Dirty Moog-style | Saturated/driven ladder filter |
| `Wasp` | EDP Wasp emulation | Classic Wasp synth filter |
| `Comb 2` | Improved comb filter | Enhanced comb filter model |
| `Diffuser` | Diffusion filter | Smears/diffuses signal |
| `DJ Mixer` | DJ-style high/low cut | Practical high/low frequency cuts |
| `PZ SVF` | Drawable filter curves | Draw custom filter shapes and morph between them |

---

## 3. ENVELOPE PARAMETERS

Serum 2 has **4 envelopes** (Env 1-4). Env 1 is always the amplitude envelope.

### Per-Envelope Controls

| Parameter Name | Range | Description |
|---|---|---|
| `Env 1 A` | 0-100% | Attack time |
| `Env 1 H` | 0-100% | Hold time |
| `Env 1 D` | 0-100% | Decay time |
| `Env 1 S` | 0-100% | Sustain level |
| `Env 1 R` | 0-100% | Release time |
| `Env 1 Velocity` | 0-100% | Velocity sensitivity |

Same pattern for Env 2, Env 3, Env 4 (NEW — Serum 1 had only 3).

Serum 2 additions: BPM sync for envelopes, Invert Legato (force retrigger even in legato mode).

---

## 4. LFO PARAMETERS

Serum 2 has **10 LFOs** (LFO 1-10). LFOs 7-10 appear automatically after LFO 6 is assigned.

### Per-LFO Controls

| Parameter Name | Range | Description |
|---|---|---|
| `LFO 1 Rate` | varies | Speed (Hz or BPM-synced division) |
| `LFO 1 Rise` | 0-100% | Fade-in time for LFO influence |
| `LFO 1 Delay` | 0-100% | Delay before rise begins |
| `LFO 1 Smooth` | 0-100% | Output smoothing |
| `LFO 1 Phase` | 0-100% | Start phase (NEW in Serum 2) |

Same pattern for LFO 2 through LFO 10.

### LFO Modes

| Mode | Description |
|---|---|
| `Trig` | Retrigger on note-on |
| `Env` | One-shot (plays once, stops at end) |
| `Off` | Free-running, ignores note-on |

### LFO Shape Modes (NEW in Serum 2)

| Mode | Description |
|---|---|
| Standard | Classic drawn LFO shape |
| Path | Draw freely on X/Y pad — both axes become modulation |
| Lorenz | Lorenz attractor chaos mode |
| Rossler | Rossler attractor chaos mode |
| S&H | Sample and Hold — random or stepped |

LFO rates can reach up to **1000 Hz** (10x mode) for creating harmonics at audio rates.

---

## 5. MACRO PARAMETERS

Serum 2 has **8 macros** (doubled from Serum 1's 4).

| Parameter Name | Range | Description |
|---|---|---|
| `Macro 1` | 0-100% | User-assignable macro |
| `Macro 2` | 0-100% | User-assignable macro |
| `Macro 3` | 0-100% | User-assignable macro |
| `Macro 4` | 0-100% | User-assignable macro |
| `Macro 5` | 0-100% | User-assignable macro (NEW) |
| `Macro 6` | 0-100% | User-assignable macro (NEW) |
| `Macro 7` | 0-100% | User-assignable macro (NEW) |
| `Macro 8` | 0-100% | User-assignable macro (NEW) |

Each macro can itself be a modulation destination in Serum 2.

---

## 6. MODULATION MATRIX

### Matrix Structure

- **Serum 1**: 16 modulation slots
- **Serum 2**: Expanded (exact slot count varies, significantly more than 16)
- Each slot has: **Source**, **Destination**, **Amount** (bipolar), **Aux Source**, **Aux Amount**, **Type** (unidirectional/bidirectional)

### Modulation Sources (Complete List)

#### Draggable Sources (visible as tiles in the UI)

| Source Name | Description |
|---|---|
| `Env 1` - `Env 4` | Envelopes (4 total) |
| `LFO 1` - `LFO 10` | LFOs (10 total) |
| `Velocity` | Note velocity |
| `Note` | MIDI note number / pitch |
| `Mod Wheel` | MIDI CC1 mod wheel |
| `Macro 1` - `Macro 8` | Macro controls |

#### Matrix-Only Sources (available in Mod Matrix "Src" dropdown)

| Source Name | Description |
|---|---|
| `Aftertouch` | Channel pressure (poly AT if supported) |
| `Pitch Bend` | Pitch bend wheel |
| `Chaos 1` | Chaos LFO type 1 (periodic, bipolar) |
| `Chaos 2` | Chaos LFO type 2 (chaotic restart) |
| `Random 1` | Note-on random value 1 |
| `Random 2` | Note-on random value 2 |
| `Osc A Output` | Oscillator A audio as mod source (NEW in Serum 2) |
| `Osc B Output` | Oscillator B audio as mod source (NEW) |
| `Osc C Output` | Oscillator C audio as mod source (NEW) |
| `Sub Output` | Sub oscillator audio as mod source (NEW) |
| `Noise Output` | Noise oscillator audio as mod source (NEW) |
| `Filter 1 Output` | Filter 1 audio as mod source (NEW) |
| `Filter 2 Output` | Filter 2 audio as mod source (NEW) |
| `Voice Count` | Number of active voices as mod source (NEW) |
| `Fixed` | Constant value (use amount slider as fixed offset) |

### Modulation Destinations (Parameter Names in Matrix)

These are the string names as they appear in the Mod Matrix destination dropdown. They correspond to the automatable parameter names above.

**Oscillator destinations (per osc A/B/C):**
- `A Level`, `A Pan`, `A WT Pos`, `A Warp`, `A Warp 2`, `A Phase`, `A Random`, `A Unison Det`, `A Unison Blend`, `A Octave`, `A Semi`, `A Fine`, `A Coarse Pitch`
- Same pattern for B and C prefixes

**Sub/Noise destinations:**
- `Sub Level`, `Sub Pan`, `Sub Oct`, `Sub Direct`
- `Noise Level`, `Noise Pan`, `Noise Pitch`, `Noise Phase`, `Noise Random`

**Filter destinations (per filter 1/2):**
- `Fil 1 Cutoff`, `Fil 1 Res`, `Fil 1 Drive`, `Fil 1 Var`, `Fil 1 Mix`, `Fil 1 Stereo`
- Same pattern for `Fil 2`

**Envelope destinations:**
- `Env 1 A`, `Env 1 D`, `Env 1 S`, `Env 1 R` (and Env 2-4)

**LFO destinations (NEW in Serum 2 — LFOs can modulate other LFOs):**
- `LFO 1 Rate`, `LFO 1 Rise`, `LFO 1 Delay`, `LFO 1 Smooth`, `LFO 1 Phase`
- Same pattern for LFO 2-10

**Macro destinations (NEW in Serum 2):**
- `Macro 1` through `Macro 8`

**Global destinations:**
- `Master Vol`, `Chaos 1 Rate`, `Chaos 2 Rate`, `Pitch Bend Range`

**Voicing destinations:**
- `Porta Time`

### Modulation Matrix Features (Serum 2 Enhancements)

- **Drag-and-drop reordering** of modulation rows
- **Bypass** individual modulations (toggle on/off without removing)
- **Remove** modulations with single click
- **Editable source curves** (custom response curves for mod sources, not just linear)
- **Editable aux source curves**
- **Dynamic visualizations** showing real-time modulation activity

---

## 7. WARP MODES

### Per Oscillator (Two Warp Slots in Serum 2)

Each oscillator has TWO warp mode slots (Serum 1 had one). The warp amount parameters are `Osc X Warp` and `Osc X Warp 2`.

### Complete Warp Mode List

#### Serum 1 Legacy Warp Modes (all retained)

| Warp Mode | Description |
|---|---|
| `Off` | No warp |
| `Self Sync` | Self-oscillator sync (bright/edgy formant character) |
| `Windowed Sync` | Smooth-windowed self-sync (softer than Self Sync) |
| `Bend +` | Pinch waveform inward toward middle |
| `Bend -` | Pull waveform outward toward edges |
| `Bend +/-` | Bidirectional bend |
| `PWM` | Pulse width modulation (push waveform left) |
| `Asym +` | Asymmetric bend right |
| `Asym -` | Asymmetric bend left |
| `Asym +/-` | Bidirectional asymmetric |
| `Flip` | Polarity flip at variable point |
| `Mirror` | Mirror waveform in second half |
| `Remap 1` | Custom graph remapping (full wave) |
| `Remap 2` | Mirrored remapping (each half independently) |
| `Remap 3` | Sinusoidal remapping |
| `Remap 4` | 4x remapping (applied 4 times) |
| `Quantize` | Sample-rate reduction on waveform (pitch-tracked) |
| `FM (from Osc)` | Frequency modulation from the other oscillator |
| `AM (from Osc)` | Amplitude modulation from the other oscillator |
| `RM (from Osc)` | Ring modulation from the other oscillator |
| `FM Noise` | FM from noise oscillator |
| `FM Sub` | FM from sub oscillator |

#### Serum 2 New Warp Modes

| Warp Mode | Description |
|---|---|
| `PD (Self)` | Phase distortion — oscillator modulates itself |
| `PD (from Osc)` | Phase distortion from another oscillator |
| `PD (from Filter)` | Phase distortion derived from filter |
| `FM (True)` | True modular-style FM (different from Serum 1's PD-based "FM") |
| `Distortion` | Waveform distortion modes |
| `Filter` | Filter applied as warp |
| `Timbre Shift` | Spectral timbre shifting |

Plus **Spectral warp modes** (available in Spectral oscillator mode):
- Spread partials
- Boost harmonics
- Gate frequencies below threshold
- Twist phases
- Apply masks/vocoding from other oscillators

---

## 8. MIXER PARAMETERS (NEW IN SERUM 2)

The mixer provides routing control for all sound sources.

### Per-Channel Controls

| Parameter Name | Description |
|---|---|
| `Mixer A Level` | OSC A level in mixer |
| `Mixer A Pan` | OSC A pan in mixer |
| `Mixer A Filter Routing` | Route to Filter 1, Filter 2, or blend |
| `Mixer A Bus 1` | Send level to FX Bus 1 |
| `Mixer A Bus 2` | Send level to FX Bus 2 |

Same pattern for B, C, Sub, Noise, Filter 1, Filter 2.

### Filter Routing

| Routing | Description |
|---|---|
| Filter (knob left) | 100% Filter 1 |
| Filter (knob center) | 50/50 blend |
| Filter (knob right) | 100% Filter 2 |
| Main | Direct to main output (through FX) |
| Direct | Bypass filter and FX |
| None | No output (use as mod source only) |

### FX Bus Structure

- **Main** — Primary FX chain
- **Bus 1** — Secondary FX chain
- **Bus 2** — Tertiary FX chain

---

## 9. EFFECTS PARAMETERS (DYNAMIC — see note at top)

FX parameters are **dynamically registered** for automation. They are NOT in the default automation list. You must right-click the parameter in Serum's UI and select "Automate" to expose it.

### Available Effects (13 + 3 Splitters)

#### Effects Modules

| Effect | Key Parameters |
|---|---|
| **Reverb** | Size, Pre Delay, Low Cut, Damp, Hi Cut, Width, Mix |
| **EQ** | Freq L, Q L, Gain L, Freq R, Q R, Gain R |
| **Distortion** | Mode, Drive, Filter Freq, Q, LP/BP/HP, Mix |
| **Flanger** | Rate, Depth, Feed, Phase, Mix |
| **Phaser** | Rate, Depth, Freq, Feed, Phase, Mix |
| **Chorus** | Rate, Delay 1, Delay 2, Depth, Feed, LPF, Mix |
| **Delay** | Time L, Time R, Feed, Freq, Q, Mix |
| **Compressor** | Thresh, Ratio, Attack, Release, Gain, Mix |
| **Filter** | Type, Cutoff, Res, Drive, Var, Mix |
| **Hyper/Dimension** | Rate, Detune, Unison, Size, Mix |
| **Bode** (NEW) | Frequency shift amount, Delay, Feedback, Mix |
| **Convolve** (NEW) | IR selection, Size, Pre Delay, Mix |
| **Utility** (NEW) | Gain, Pan, Width, Phase invert, Mono, Mix |

#### Reverb Modes (5 total)

| Mode | Description |
|---|---|
| `Plate` | Classic plate reverb (Serum 1 legacy) |
| `Hall` | Hall reverb (Serum 1 legacy) |
| `Vintage` (NEW) | Vintage-character reverb |
| `Nitrous` (NEW) | Distinctive metallic/shimmer reverb |
| `Basin` (NEW) | Large ambient reverb |

#### Distortion Modes

Serum 1 modes: Tube, Warm, Soft Clip, Hard Clip, Asymmetric, Sine Fold, Diode 1, Diode 2, Linear Fold, Zero Square, Downsample, X-Shaper, X-Shaper (Asym)
Serum 2 addition: **Overdrive** (stackable within module), DC bias control

#### Splitter Modules (NEW in Serum 2)

| Module | Description |
|---|---|
| `Splitter L/H` | Split into Low/High frequency bands |
| `Splitter L/M/H` | Split into Low/Mid/High frequency bands |
| `Splitter M/S` | Split into Mid/Side stereo |

Splitters allow independent FX chains on each band.

### Multiple Effect Instances

In Serum 2, you can use **multiple instances of the same effect** (e.g., two Distortions, three Filters). This was not possible in Serum 1.

---

## 10. VOICING & PERFORMANCE PARAMETERS

| Parameter Name | Range | Description |
|---|---|---|
| `Mono` | 0/1 | Monophonic mode |
| `Legato` | 0/1 | Legato (no envelope retrigger on overlapping notes) |
| `Poly` | 1-32 | Maximum polyphony |
| `Porta Time` | 0-100% | Portamento/glide time |
| `Porta Always` | 0/1 | Glide even without held note |
| `Porta Scaled` | 0/1 | Scale glide time by interval distance |
| `Pitch Bend Range` | semitones | Pitch bend wheel range |
| `Mod Wheel` | 0-100% | MIDI CC1 |
| `Master Vol` | 0-100% | Master output volume |

### Voice Dispersion (NEW in Serum 2)

Per-voice parameter variation for up to 8 voices:
- Panning variation
- Detune variation
- Cutoff variation
- Envelope variation

---

## 11. GLOBAL PARAMETERS

| Parameter Name | Description |
|---|---|
| `Osc A Pitch Track` | Pitch tracking on/off for Osc A |
| `Osc B Pitch Track` | Pitch tracking on/off for Osc B |
| `Osc C Pitch Track` | Pitch tracking on/off for Osc C |
| `Noise Fine` | Fine-tune for noise oscillator (cents) |
| `Oversampling` | Quality setting for warp modes |
| `Chaos 1 Rate` | Chaos 1 oscillator speed |
| `Chaos 2 Rate` | Chaos 2 oscillator speed |
| `Chaos BPM` | BPM sync for chaos oscillators |
| `Chaos Mono` | Share chaos across all voices |

### Unison Global Settings (per oscillator)

| Parameter | Description |
|---|---|
| `A Unison Range` | Max detune in semitones (0-48) |
| `A Unison Width` | Stereo spread of unison voices |
| `A Unison Warp` | Warp offset per unison voice |
| `A Unison WT Pos` | WT Position offset per unison voice |
| `A Unison Stack` | Harmonic stacking (off, 12 1x, 12 2x, +7 variants, Center-12, Center-24) |
| `A Unison Tuning` | Tuning algorithm: Linear, Super, Exp, Inv, Random |

Serum 2 additions: **Semitone**, **Harmonic**, **Ratio**, **Step** tuning modes.

---

## 12. WAVETABLE CATEGORIES

### Factory Wavetable Folders

| Category | Description |
|---|---|
| **Analog** | Analog-style oscillator shapes, classic synth models (TB-303, etc.) |
| **Digital** | Digital/modern wavetables, complex timbres |
| **Spectral** | Spectrally-derived wavetables, harmonic content |
| **Vowel** | Vocal/formant-based wavetables |
| **User** | User-created wavetables |

Serum 2 ships with **288+ factory wavetables** and **626+ factory presets**.

Each wavetable consists of up to **256 frames** (sub-tables), each 2048 samples at 32-bit.

### Serum 2 New Factory Content

- Additional analog and digital wavetables (contributed by Splice, Virtual Riot, ill.gates, Drumsound & Bassline Smith, and others)
- Factory multisamples (SFZ format, contributed by Rodrigo Montes, Steve Duda, Robin Tyndale, Brandon Seliga)
- Factory samples for Sample and Granular modes

---

## 13. CLIP SEQUENCER & ARPEGGIATOR (NEW IN SERUM 2)

### Clip Sequencer

Internal MIDI clip player with:
- Piano roll editor
- Automation lanes (can automate macros, velocity)
- 12 clip slots per bank
- Overdub and Extend recording modes
- MIDI output to host DAW
- Key and Scale constraint

### Arpeggiator

- Pattern modes with advanced editor
- Transpose shift and range
- Gate, Chance, Offset, Repeats per step
- Velocity shaping over time
- Retrigger options
- 12 arp slots per bank
- MIDI output to host

---

## 14. SERUM 1 vs SERUM 2 — PARAMETER NAMING CHANGES

### What Changed

| Area | Serum 1 | Serum 2 |
|---|---|---|
| Oscillators | 2 (Osc A, Osc B) | 3 (Osc A, Osc B, Osc C) |
| Osc modes | Wavetable only | Wavetable, Sample, Multisample, Granular, Spectral |
| Warp slots | 1 per osc | 2 per osc (Warp, Warp 2) |
| Filters | 1 | 2 (Filter 1, Filter 2) |
| Envelopes | 3 (Env 1-3) | 4 (Env 1-4) |
| LFOs | 4 (LFO 1-4) | 10 (LFO 1-10) |
| Macros | 4 (Macro 1-4) | 8 (Macro 1-8) |
| FX chains | 1 | 3 (Main, Bus 1, Bus 2) |
| FX instances | 1 per type | Multiple per type |
| Chaos sources | 2 (matrix only) | 2 + Lorenz/Rossler LFO modes |
| Clip/Arp | None | Built-in clip sequencer + arpeggiator |

### What Stayed the Same

- **Parameter naming convention** is the same — Serum 2 uses the same `Osc A WT Pos`, `Filter 1 Cutoff`, `Env 1 A`, `LFO 1 Rate`, `Macro 1` naming as Serum 1.
- **All Serum 1 presets** load perfectly in Serum 2 with full backward compatibility.
- **Mod matrix drag-and-drop** workflow is identical.
- **FX parameter names** within each module (Size, Feed, Rate, etc.) follow the same convention.

### New Parameter Names in Serum 2

Any parameter referencing these is new to v2:
- `Osc C *` (all Osc C parameters)
- `* Warp 2` (second warp slot)
- `Filter 2 *` (all Filter 2 parameters)
- `Env 4 *` (fourth envelope)
- `LFO 5-10 *` (LFOs 5 through 10)
- `Macro 5-8` (macros 5 through 8)
- `LFO * Phase` (LFO start phase)
- Mixer parameters
- Voice dispersion parameters

---

## 15. PROGRAMMATIC CONTROL NOTES

### For DAW Bridge Implementation (OSC/Remote Script)

1. **Static parameters** (~100+ parameters) are reliably addressable by name. Use the names documented above.

2. **FX parameters** must be dynamically discovered. After the user enables an FX and right-clicks "Automate," the parameter appears in the host's parameter list. Your bridge code should enumerate available parameters at runtime rather than assuming a fixed list.

3. **Parameter values are normalized 0.0 to 1.0** in VST3. Map to the display range as needed.

4. **Ableton Live specifics**: In Live's automation lanes, Serum parameters appear with slightly different formatting — typically `Osc A WT Pos` becomes something like "Osc A Wt Pos" (capitalization may vary). Use the DAW's API to enumerate actual parameter names.

5. **Bitwig specifics**: After adding a new automatable FX parameter via right-click in Serum, you may need to deactivate and reactivate the plugin for the parameter to appear in Bitwig's automation list.

6. **VST3 Note ID handling**: Serum 2 has an "Ignore VST3 Note IDs" preference in `Serum2Prefs.json` to work around host note ID issues. Enable this if per-note modulation behaves incorrectly.

7. **Pro Tools**: Has dedicated automatable parameter shortcuts.

8. **Logic Pro**: Known issues with automation data loading in some versions. Fixed in Serum 2.0.20+.

9. **Parameter index stability**: Do NOT rely on parameter indices across Serum versions. The changelog documents at least one instance where FX parameter indices shifted by one between versions (v2.0.17 bug, fixed in v2.0.18). Always address parameters by name when possible.

---

## Sources

- Serum 2 Manual v1.0.0 (March 2025), xferrecords.com
- Serum 1 Manual v1.0.1 (October 2014), xferrecords.com
- Serum/Serum 2 Changelog (GitHub Gist, 0xdevalias)
- Xfer Records Forum: "Serum 2 Automation on Live 12.1" (Steve Duda, April 2025)
- CFA-Sound: "Xfer Serum 2 Review & Insights" (March 2025)
- Sonic Weaponry: "Serum 2 Full Feature Breakdown" (March 2025)
