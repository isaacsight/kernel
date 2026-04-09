# 2027: The Agentic Synthesizer

## A Build Plan for a Synthesizer That Thinks

**Authors:** Isaac Hernandez, kernel.chat
**Date:** April 9, 2026 (revised)
**Version:** 2.0
**Status:** Active Build Plan

---

## 1. What This Is

2027 is a VST3/CLAP synthesizer plugin with an embedded AI agent. The agent understands musical context, generates patches from natural language, adapts in real-time to what you're playing, and remembers your style across sessions.

This is not a research paper. This is a build plan with phases, milestones, and a clear path from zero to shipping product.

---

## 2. Why Build This

Every synth on the market is reactive — you turn knobs, it makes sound. Even AI-assisted synths (Synplant 2, Sistema2) are request-response: you ask for a preset, it generates one.

No shipping product has an embedded agent that:
- Listens to what you're playing and adapts in real-time
- Remembers your preferences across sessions
- Proposes changes based on musical context (key, chords, energy)
- Has goals ("make this darker," "follow the chord progression")
- Can rewire its own signal flow

That's the gap. kbot already does agent reasoning with 787 tools. 2027 puts that intelligence inside a plugin.

---

## 3. Architecture

### 3.1 Two Layers

**Fast Layer (<1ms, audio thread)**
- Small neural net via RTNeural (~500K params, pre-allocated)
- Chord detection, envelope following, spectral analysis
- Adaptive filter modulation, dynamic LFO rates
- No allocations, no locks, no system calls

**Slow Layer (100ms-10s, background thread)**
- ONNX Runtime for complex reasoning
- Text-to-patch generation, preset morphing, style learning
- Communicates with fast layer via lock-free FIFO
- Can allocate, access disk, run inference

### 3.2 Musical Context Engine

Real-time extraction from MIDI + host transport:

| Feature | Method | Latency |
|---------|--------|---------|
| Chord detection | Pitch class histogram + template matching | <1ms |
| Scale detection | Sliding window pitch accumulation | ~500ms |
| Energy/intensity | RMS + spectral centroid | ~10ms |
| Tempo/position | Host ProcessContext | 0ms |
| Key signature | MIDI analysis + pitch class | ~4 bars |

### 3.3 Signal Flow

```
MIDI In → [Agent Fast] → Oscillators (WT/Gran/FM/Modal) → Filters (ZDF-SVF/Ladder/Formant)
                ↑              ↓
           Context         FX Chain → Stereo Out
           Analysis           ↑
                         [Agent Slow]
                         (text-to-patch,
                          style learning,
                          preset morphing)
```

### 3.4 Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| DSP Engine | Rust (nih-plug) | Memory safety, SIMD, compiles to VST3 + CLAP |
| Fast Agent | RTNeural (C++ via FFI) | Proven real-time neural inference |
| Slow Agent | ONNX Runtime | Background inference, larger models |
| GUI | egui (Rust) | Immediate-mode, minimal CPU |
| Memory | SQLite (embedded) | User profiles, patch history |
| Formats | VST3 + CLAP | Market reach + technical superiority |

---

## 4. Synthesis Engines

### 4.1 Oscillators (5 types)

1. **Wavetable** — mipmap anti-aliased, 2048-sample frames, 256-frame tables, morphing
2. **Granular** — audio-rate capable (440+ grains/sec = pitched), 256 simultaneous grains
3. **FM** — through-zero, free-routing matrix, operator feedback, not fixed algorithms
4. **Modal** — exciter-resonator pairs, 50+ modes, material presets (string/plate/membrane)
5. **PolyBLEP** — classic waveforms for sub-osc and audio-rate LFOs

### 4.2 Filters (3 types, all ZDF)

1. **SVF** — simultaneous LP/HP/BP/Notch, clean and efficient
2. **Moog Ladder** — 4-pole cascade, nonlinear feedback, fat analog character
3. **Formant** — parallel bandpass bank, agent-driven vowel morphing

### 4.3 Modulation

- 4 LFOs (including Lorenz chaos attractor)
- 4 MSEG envelopes
- 32-slot mod matrix with "via" (mod-of-mod)
- **Agent as modulation source** — the AI itself outputs control signals

### 4.4 SIMD

- SSE2/NEON: 4 voices per SIMD register
- AVX2: 8 voices
- Target: 16-voice polyphony at <30% single-core CPU

---

## 5. Agent Capabilities

### 5.1 Text-to-Patch
"warm ambient pad with slow movement" → full parameter set. Uses CLAP embeddings to map text descriptions to learned parameter space.

### 5.2 Adaptive Modulation
Agent observes musical context and adjusts in real-time. Slow ballad → filter LFO slows, mod depth decreases. Aggressive DnB → saturation increases, mod becomes chaotic.

### 5.3 Preset Morphing
Interpolation in learned latent space (not raw parameter space). Produces musically meaningful intermediate sounds.

### 5.4 Self-Patching
Agent can rewire the signal flow — reconnect oscillators to different filters, reorder effects, add parallel paths. Routing is a first-class parameter.

### 5.5 Memory
Persistent SQLite profile: favorite timbres, mod patterns, genre tendencies, time-of-day habits. Informs all suggestions. Fully local, deletable, exportable.

### 5.6 Safety
- "Reactivity" knob: 0% (fully manual) to 100% (fully autonomous)
- Every agent action visible in GUI with undo
- Subtle adjustments by default, not dramatic jumps
- All data local, no telemetry, no internet required

---

## 6. kbot Integration

2027 is a standalone plugin, but it connects to kbot for extended capabilities:

### 6.1 kbot as Control Surface
kbot can drive 2027 via OSC/MIDI from the terminal:
```bash
kbot "load 2027 on track 3 and create a dark ambient pad"
kbot "morph the current patch toward something brighter"
kbot "set reactivity to 80% and follow the chord progression"
```

### 6.2 Ableton Bridge
Via existing AbletonOSC integration:
- Load 2027 as VST3 on any track
- Set parameters via device control
- Automate agent behavior from Ableton's automation lanes
- Expose agent state as Ableton parameters

### 6.3 Preset Sharing
kbot's forge_tool can generate 2027 presets. Collective intelligence feeds anonymous usage signals back to improve the agent's default behavior.

---

## 7. Build Phases

### Phase 1: Foundation (Weeks 1-4)
- [ ] Scaffold Rust project with nih-plug (VST3 + CLAP)
- [ ] Implement wavetable oscillator with anti-aliasing
- [ ] Implement ZDF-SVF filter
- [ ] Basic ADSR envelope
- [ ] Minimal GUI (egui: oscillator selector, filter knobs, waveform display)
- [ ] Builds and loads in Ableton, Bitwig, REAPER
- **Milestone:** Playable synth with 1 oscillator, 1 filter, sounds good

### Phase 2: Multi-Engine (Weeks 5-8)
- [ ] Add FM oscillator (through-zero, 4-operator)
- [ ] Add granular engine (overlap-add, variable rate)
- [ ] Add Moog ladder filter
- [ ] Modulation matrix (16 slots)
- [ ] 2 LFOs + 2 MSEG envelopes
- [ ] SIMD voice packing (4-voice SSE2)
- **Milestone:** Multi-engine synth competitive with Vital

### Phase 3: Agent — Fast Layer (Weeks 9-12)
- [ ] Integrate RTNeural via C FFI
- [ ] Train chord detection model (pitch class histogram → chord label)
- [ ] Musical context extraction from MIDI
- [ ] Agent-as-modulation-source (context → parameter offsets)
- [ ] Adaptive filter behavior based on energy/key
- **Milestone:** Synth reacts to what you play

### Phase 4: Agent — Slow Layer (Weeks 13-16)
- [ ] ONNX Runtime integration (background thread)
- [ ] Text-to-patch pipeline (text → parameter vector)
- [ ] Preset latent space (encode/decode/interpolate)
- [ ] SQLite user profile (preferences, history)
- [ ] kbot ↔ 2027 OSC bridge
- **Milestone:** "warm pad" → playable sound

### Phase 5: Polish + Ship (Weeks 17-20)
- [ ] Full GUI (waveform display, mod matrix visual, agent status panel)
- [ ] Modal synthesis engine
- [ ] Formant filter
- [ ] Preset browser + factory presets (100+)
- [ ] AVX2 optimization
- [ ] macOS (AU + VST3 + CLAP) + Windows (VST3 + CLAP)
- [ ] Beta testing with 10 producers
- **Milestone:** Ship v1.0

---

## 8. What Exists Today

### In kbot (working now)
- Text-to-preset for Serum 2 (programmatic .SerumPreset files)
- Sound designer agent (natural language → synth parameters)
- Music theory engine (scales, chords, progressions)
- Ableton OSC integration (load plugins, set parameters, fire clips)
- Ableton knowledge base (30+ native devices documented)
- DJ set builder, music generator, drum pattern generator

### Not yet built
- Rust DSP engine (Phase 1)
- Neural inference in audio thread (Phase 3)
- Standalone VST3/CLAP plugin wrapper (Phase 1)
- Plugin GUI (Phase 1)
- Trained agent models (Phase 3-4)

---

## 9. Market Position

| Product | Synthesis | AI | Agent | Price |
|---------|-----------|------|-------|-------|
| Serum 2 | 5 engines | None | None | $189 |
| Pigments 7 | 8 engines | None | None | $199 |
| Vital | Wavetable | None | None | Free |
| Synplant 2 | Custom | Audio-to-preset | None | $149 |
| Sistema2 | Custom | Text-to-patch | None | ? |
| **2027** | **5 engines** | **Text-to-patch + context** | **Full agent** | **$149** |

Free tier: full synth, 3-voice poly, no agent. Paid: full poly + agent.

---

## 10. Principles

1. **Sound first.** The synth must sound professional without the agent. The agent makes it better, not functional.
2. **Local first.** All inference runs on-device. No internet. No telemetry. Privacy by architecture.
3. **Subtle by default.** Agent does small, continuous adjustments. Not dramatic jumps. Musician stays in control.
4. **Transparent.** Every agent action visible. Full undo. Clear feedback.
5. **Phased delivery.** Each phase ships a usable product. Phase 1 is already a synth. Phase 3 adds intelligence. Phase 5 is the full vision.

---

## References

### Core Technical
1. nih-plug — Rust VST3/CLAP framework (robbert-vdh/nih-plug, ISC)
2. RTNeural — Real-time neural inference (jatinchowdhury18/RTNeural)
3. Zavalishin, V. "The Art of VA Filter Design" — ZDF filter theory
4. Chowdhury, J. "RTNeural: Fast Neural Inferencing" (arXiv:2106.03037)
5. SPINVAE-2 — Latent space synth parameter interpolation

### Market Research
6. Serum 2, Pigments 7, Vital, Synplant 2, Sistema2, Baby Audio Grainferno
7. Envato Music Trends 2026, Epidemic Sound Trends 2026
