# 2027

An agentic wavetable synthesizer built for AI control. VST3 + CLAP plugin powered by [nih-plug](https://github.com/robbert-vdh/nih-plug).

**Vendor**: kernel.chat  
**License**: MIT

## Features

- **Wavetable oscillator** — 2048-sample frames, 256-frame table, linear interpolation between samples and frames
- **ZDF State Variable Filter** — Topology-Preserving Transform (Zavalishin method), simultaneous LP/HP/BP/Notch
- **Exponential ADSR** — natural-sounding attack/decay/release curves
- **16-voice polyphony** — oldest-voice stealing
- **MIDI input** — note on/off with velocity
- **Stereo output** — mono synth engine duplicated to L/R

## Parameters

| Parameter | Range | Default |
|---|---|---|
| Pitch | -24 to +24 semitones | 0 |
| Fine Tune | -100 to +100 cents | 0 |
| WT Position | 0% to 100% | 0% |
| Cutoff | 20 Hz to 20 kHz | 20 kHz |
| Resonance | 0% to 100% | 0% |
| Filter Mode | LP / HP / BP / Notch | LP |
| Attack | 1 ms to 10 s | 10 ms |
| Decay | 1 ms to 10 s | 100 ms |
| Sustain | 0% to 100% | 70% |
| Release | 1 ms to 10 s | 300 ms |
| Master | -60 to +6 dB | -6 dB |

## Build

Requires Rust (stable) and Cargo.

```bash
# Install Rust if needed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build the plugin
cd packages/2027
cargo build --release

# The compiled plugin will be at:
#   target/release/libtwenty_twenty_seven.dylib  (macOS)
#   target/release/libtwenty_twenty_seven.so     (Linux)
#   target/release/twenty_twenty_seven.dll       (Windows)
```

### Bundle as VST3/CLAP

Use [nih-plug's bundler](https://github.com/robbert-vdh/nih-plug/tree/master/nih_plug_xtask) to create proper plugin bundles:

```bash
# Install the bundler (one-time)
cargo install --git https://github.com/robbert-vdh/nih-plug.git cargo-nih-plug

# Bundle
cargo nih-plug bundle twenty-twenty-seven --release

# Output:
#   target/bundled/2027.vst3/
#   target/bundled/2027.clap
```

Copy the bundle to your plugin folder:
- **macOS VST3**: `~/Library/Audio/Plug-Ins/VST3/`
- **macOS CLAP**: `~/Library/Audio/Plug-Ins/CLAP/`
- **Linux VST3**: `~/.vst3/`
- **Linux CLAP**: `~/.clap/`

## Architecture

```
src/
├── lib.rs           # Plugin entry, voice management, MIDI handling, process loop
├── params.rs        # nih-plug parameter definitions
└── dsp/
    ├── mod.rs       # DSP module exports
    ├── wavetable.rs # Wavetable + oscillator (2048 × 256, linear interp)
    ├── filter.rs    # ZDF-SVF (Zavalishin TPT)
    └── envelope.rs  # Exponential ADSR
```
