//! # 2027 — Agentic Synthesizer
//!
//! A VST3/CLAP synthesizer designed for AI-driven control.
//! Built with nih-plug.
//!
//! - 16-voice polyphony with oldest-voice stealing
//! - 3 oscillator modes: Wavetable, FM (4-operator through-zero), Granular
//! - ZDF State Variable Filter (Zavalishin TPT): LP/HP/BP/Notch
//! - Exponential ADSR envelope
//! - 4 LFOs (sine, tri, saw, square, S&H, Lorenz chaos)
//! - 32-slot modulation matrix with via (mod-of-mod)
//! - Musical intelligence: chord/scale detection, energy tracking
//! - Agent brain: maps musical context to AgentX/AgentY modulation
//! - Stereo output

use nih_plug::prelude::*;
use std::sync::Arc;

mod context;
mod dsp;
mod intelligence;
mod params;

use context::agent::{int_to_agent_mode, Agent};
use context::chord_detector::ChordDetector;
use context::energy_tracker::EnergyTracker;
use context::musical_context::MusicalContext;
use context::scale_detector::ScaleDetector;
use dsp::drums::DrumKit;
use dsp::envelope::Adsr;
use dsp::filter::{FilterMode, ZdfSvf};
use dsp::fm::FmOscillator;
use dsp::granular::GranularEngine;
use dsp::lfo::LfoBank;
use dsp::mod_matrix::{ModDest, ModMatrix, ModSource, ModSourceValues};
use dsp::wavetable::{Wavetable, WavetableOscillator};
use intelligence::adaptive_dynamics::AdaptiveDynamics;
use intelligence::spectral_awareness::SpectralAwareness;
use intelligence::session_memory::SessionMemory;
use params::SynthParams;

/// Maximum number of simultaneous voices.
const MAX_VOICES: usize = 16;

/// Oscillator mode enum (matches the osc_mode IntParam: 0/1/2).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OscMode {
    Wavetable,
    Fm,
    Granular,
}

impl OscMode {
    fn from_int(v: i32) -> Self {
        match v {
            1 => OscMode::Fm,
            2 => OscMode::Granular,
            _ => OscMode::Wavetable,
        }
    }
}

/// A single synth voice.
struct Voice {
    /// Whether this voice is currently active.
    active: bool,
    /// MIDI note number that triggered this voice.
    note: u8,
    /// Note ID for nih-plug's voice management (matches NoteEvent note_id).
    note_id: i32,
    /// Velocity (0.0..1.0).
    velocity: f32,
    /// Wavetable oscillator.
    oscillator: WavetableOscillator,
    /// FM oscillator (4-operator through-zero).
    fm_osc: FmOscillator,
    /// Granular synthesis engine.
    granular: GranularEngine,
    /// Amplitude envelope.
    envelope: Adsr,
    /// Per-voice filter.
    filter: ZdfSvf,
    /// Voice age counter — incremented each sample while active. Used for voice stealing.
    age: u64,
}

impl Voice {
    fn new(sample_rate: f32) -> Self {
        Self {
            active: false,
            note: 0,
            note_id: 0,
            velocity: 0.0,
            oscillator: WavetableOscillator::new(),
            fm_osc: FmOscillator::new(sample_rate),
            granular: GranularEngine::new(sample_rate),
            envelope: Adsr::new(sample_rate),
            filter: ZdfSvf::new(sample_rate),
            age: 0,
        }
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.envelope.set_sample_rate(sample_rate);
        self.filter.set_sample_rate(sample_rate);
        self.fm_osc.set_sample_rate(sample_rate);
        self.granular.set_sample_rate(sample_rate);
    }
}

/// The 2027 synthesizer plugin.
pub struct TwentyTwentySeven {
    params: Arc<SynthParams>,
    /// Shared wavetable (all voices read from the same table).
    wavetable: Wavetable,
    /// Polyphonic voice pool.
    voices: Vec<Voice>,
    /// LFO bank (4 LFOs, shared across all voices).
    lfo_bank: LfoBank,
    /// Modulation matrix (32 routing slots).
    mod_matrix: ModMatrix,
    /// Sample rate, set during initialization.
    sample_rate: f32,
    /// Tracks the last FM algorithm value to detect changes.
    last_fm_algo: i32,

    // --- Musical intelligence (Phase 3) ---
    /// Real-time chord detector.
    chord_detector: ChordDetector,
    /// Scale/key detector.
    scale_detector: ScaleDetector,
    /// Energy/intensity tracker.
    energy_tracker: EnergyTracker,
    /// Agent brain — maps musical context to modulation outputs.
    agent: Agent,
    /// Combined musical context state, updated each buffer.
    musical_context: MusicalContext,
    /// Synthesized drum kit (8 voices, triggered by MIDI notes).
    drum_kit: DrumKit,

    // --- Intelligence layer (Phase 4) ---
    /// Adaptive dynamics: section-aware drum modifiers.
    adaptive_dynamics: AdaptiveDynamics,
    /// Spectral awareness: self-mixing / frequency clash avoidance.
    spectral_awareness: SpectralAwareness,
    /// Session memory: learned user preferences (JSON-backed).
    session_memory: SessionMemory,
    /// Sample counter for periodic memory snapshots (~every 5 seconds).
    memory_snapshot_counter: u64,
    /// Samples between memory snapshots.
    memory_snapshot_interval: u64,
}

impl Default for TwentyTwentySeven {
    fn default() -> Self {
        let mut wavetable = Wavetable::new();
        wavetable.init_default();

        let default_sr = 44100.0;
        let default_buf = 512;

        let mut voices = Vec::with_capacity(MAX_VOICES);
        for _ in 0..MAX_VOICES {
            voices.push(Voice::new(default_sr));
        }

        // Set up default modulation routes:
        // Slot 0: LFO1 → FilterCutoff (amount controlled by lfo1_depth param)
        // Slot 1: AgentX → FmDepth (AI-driven FM intensity)
        // Slot 2: AgentY → GrainDensity (AI-driven granular density)
        let mut mod_matrix = ModMatrix::new();
        mod_matrix.set_route(0, ModSource::Lfo1, ModDest::FilterCutoff, 0.0, ModSource::None);
        mod_matrix.set_route(1, ModSource::AgentX, ModDest::FmDepth, 1.0, ModSource::None);
        mod_matrix.set_route(2, ModSource::AgentY, ModDest::GrainDensity, 1.0, ModSource::None);

        Self {
            params: Arc::new(SynthParams::default()),
            wavetable,
            voices,
            lfo_bank: LfoBank::new(default_sr),
            mod_matrix,
            sample_rate: default_sr,
            last_fm_algo: -1, // Force initial algorithm setup
            chord_detector: ChordDetector::new(default_sr, default_buf),
            scale_detector: ScaleDetector::new(default_sr, default_buf, 120.0),
            energy_tracker: EnergyTracker::new(default_sr, default_buf),
            agent: Agent::new(default_sr, default_buf),
            musical_context: MusicalContext::default(),
            drum_kit: DrumKit::new(default_sr),

            // Intelligence layer
            adaptive_dynamics: AdaptiveDynamics::new(default_sr, default_buf),
            spectral_awareness: SpectralAwareness::new(default_sr),
            session_memory: SessionMemory::default(),
            memory_snapshot_counter: 0,
            memory_snapshot_interval: (default_sr as u64) * 5, // ~5 seconds
        }
    }
}

impl TwentyTwentySeven {
    /// Find a free voice, or steal the oldest active voice.
    fn allocate_voice(&mut self) -> usize {
        // First: find an inactive voice
        if let Some(idx) = self.voices.iter().position(|v| !v.active) {
            return idx;
        }

        // Voice stealing: pick the oldest active voice
        let mut oldest_idx = 0;
        let mut oldest_age = 0u64;
        for (i, voice) in self.voices.iter().enumerate() {
            if voice.age > oldest_age {
                oldest_age = voice.age;
                oldest_idx = i;
            }
        }
        oldest_idx
    }

    /// Handle a note-on event.
    fn note_on(&mut self, note: u8, velocity: f32, note_id: i32, sample_offset: u32) {
        // Feed musical intelligence detectors
        self.chord_detector.note_on(note, velocity);
        self.scale_detector.note_on(note, velocity);
        self.energy_tracker.note_on(note, velocity, sample_offset);

        // Route drum notes to the drum kit
        if self.drum_kit.note_on(note, velocity) {
            return;
        }

        let idx = self.allocate_voice();
        let voice = &mut self.voices[idx];

        voice.active = true;
        voice.note = note;
        voice.note_id = note_id;
        voice.velocity = velocity;
        voice.age = 0;

        // Compute frequency from MIDI note + pitch offset + fine tuning
        let pitch_offset = self.params.osc_pitch.value() as f32;
        let fine_cents = self.params.osc_fine.value();
        let freq = midi_note_to_freq(note, pitch_offset, fine_cents);

        // Reset all oscillator types (whichever mode is active will be used)
        voice.oscillator.reset();
        voice.oscillator.set_frequency(freq, self.sample_rate);
        voice.fm_osc.reset();
        voice.granular.reset();
        voice.envelope.gate_on();
        voice.filter.reset();

        // Trigger key-triggered LFOs
        self.lfo_bank.note_on();
    }

    /// Handle a note-off event.
    fn note_off(&mut self, note: u8, note_id: i32) {
        // Feed energy tracker
        self.energy_tracker.note_off(note);

        for voice in self.voices.iter_mut() {
            if voice.active && voice.note == note {
                // If note_id is >= 0, match it too (nih-plug convention)
                if note_id >= 0 && voice.note_id != note_id {
                    continue;
                }
                voice.envelope.gate_off();
            }
        }
    }
}

/// Convert MIDI note to frequency with pitch and fine-tune offsets.
#[inline]
fn midi_note_to_freq(note: u8, pitch_semitones: f32, fine_cents: f32) -> f32 {
    let note_f = note as f32 + pitch_semitones + (fine_cents / 100.0);
    440.0 * 2.0f32.powf((note_f - 69.0) / 12.0)
}

/// Map the filter_mode IntParam value to a FilterMode enum.
#[inline]
fn int_to_filter_mode(value: i32) -> FilterMode {
    match value {
        1 => FilterMode::Highpass,
        2 => FilterMode::Bandpass,
        3 => FilterMode::Notch,
        _ => FilterMode::Lowpass,
    }
}

impl Plugin for TwentyTwentySeven {
    const NAME: &'static str = "2027";
    const VENDOR: &'static str = "kernel.chat";
    const URL: &'static str = "https://kernel.chat";
    const EMAIL: &'static str = "kernel.chat@gmail.com";
    const VERSION: &'static str = env!("CARGO_PKG_VERSION");

    // No audio input (synthesizer), stereo output
    const AUDIO_IO_LAYOUTS: &'static [AudioIOLayout] = &[AudioIOLayout {
        main_input_channels: None,
        main_output_channels: NonZeroU32::new(2),
        ..AudioIOLayout::const_default()
    }];

    // Accept MIDI input
    const MIDI_INPUT: MidiConfig = MidiConfig::Basic;
    const SAMPLE_ACCURATE_AUTOMATION: bool = true;

    type SysExMessage = ();
    type BackgroundTask = ();

    fn params(&self) -> Arc<dyn Params> {
        self.params.clone()
    }

    fn initialize(
        &mut self,
        _audio_io_layout: &AudioIOLayout,
        buffer_config: &BufferConfig,
        _context: &mut impl InitContext<Self>,
    ) -> bool {
        self.sample_rate = buffer_config.sample_rate;
        let buf_size = buffer_config.max_buffer_size as usize;

        for voice in self.voices.iter_mut() {
            voice.set_sample_rate(self.sample_rate);
        }

        self.lfo_bank.set_sample_rate(self.sample_rate);
        self.drum_kit.set_sample_rate(self.sample_rate);

        // Initialize musical intelligence with host sample rate and buffer size
        self.chord_detector
            .set_sample_rate(self.sample_rate, buf_size);
        self.scale_detector
            .set_sample_rate(self.sample_rate, buf_size);
        self.energy_tracker
            .set_sample_rate(self.sample_rate, buf_size);
        self.agent.set_sample_rate(self.sample_rate, buf_size);

        // Initialize intelligence layer
        self.adaptive_dynamics
            .set_sample_rate(self.sample_rate, buf_size);
        self.spectral_awareness.set_sample_rate(self.sample_rate);
        self.memory_snapshot_interval = (self.sample_rate as u64) * 5;
        self.memory_snapshot_counter = 0;

        // Load session memory from disk
        self.session_memory = SessionMemory::load();
        self.session_memory.begin_session();

        true
    }

    fn deactivate(&mut self) {
        // Save session memory to disk when plugin is deactivated
        self.session_memory.save();
    }

    fn reset(&mut self) {
        for voice in self.voices.iter_mut() {
            voice.active = false;
            voice.envelope.reset();
            voice.filter.reset();
            voice.oscillator.reset();
            voice.fm_osc.reset();
            voice.granular.reset();
            voice.age = 0;
        }

        self.lfo_bank.reset();
        self.drum_kit.reset();
        self.last_fm_algo = -1;

        // Reset musical intelligence
        self.chord_detector.reset();
        self.scale_detector.reset();
        self.energy_tracker.reset();
        self.agent.reset();
        self.musical_context = MusicalContext::default();

        // Reset intelligence layer
        self.adaptive_dynamics.reset();
        self.spectral_awareness.reset();
    }

    fn process(
        &mut self,
        buffer: &mut Buffer,
        _aux: &mut AuxiliaryBuffers,
        context: &mut impl ProcessContext<Self>,
    ) -> ProcessStatus {
        // --- Update agent mode and reactivity from params (once per buffer) ---
        let agent_mode = int_to_agent_mode(self.params.agent_mode.value());
        self.agent.set_mode(agent_mode);
        self.agent
            .set_reactivity(self.params.agent_reactivity.value() / 100.0);

        // Get tempo from host transport (if available)
        let transport = context.transport();
        if let Some(tempo) = transport.tempo {
            self.musical_context.tempo = tempo;
            self.scale_detector.set_tempo(self.sample_rate, tempo);
            self.lfo_bank.set_host_bpm(tempo as f32);
        }

        let mut next_event = context.next_event();

        for (sample_idx, channel_samples) in buffer.iter_samples().enumerate() {
            // --- Handle MIDI events at this sample ---
            while let Some(event) = next_event {
                if event.timing() > sample_idx as u32 {
                    break;
                }

                match event {
                    NoteEvent::NoteOn {
                        note,
                        velocity,
                        voice_id,
                        timing,
                        ..
                    } => {
                        self.note_on(note, velocity, voice_id.unwrap_or(-1), timing);
                    }
                    NoteEvent::NoteOff {
                        note, voice_id, ..
                    } => {
                        self.note_off(note, voice_id.unwrap_or(-1));
                    }
                    _ => (),
                }

                next_event = context.next_event();
            }

            // --- Read smoothed parameters ---
            let master_gain =
                nih_plug::util::db_to_gain_fast(self.params.master_volume.smoothed.next());
            let drum_gain =
                nih_plug::util::db_to_gain_fast(self.params.drum_level.smoothed.next());
            let wt_position = self.params.wt_position.smoothed.next() / 100.0;
            let filter_cutoff = self.params.filter_cutoff.smoothed.next();
            let filter_reso = self.params.filter_resonance.smoothed.next() / 100.0;
            let filter_mode = int_to_filter_mode(self.params.filter_mode.value());

            let env_attack = self.params.env_attack.value();
            let env_decay = self.params.env_decay.value();
            let env_sustain = self.params.env_sustain.value() / 100.0;
            let env_release = self.params.env_release.value();

            let pitch_offset = self.params.osc_pitch.value() as f32;
            let fine_cents = self.params.osc_fine.value();

            let osc_mode = OscMode::from_int(self.params.osc_mode.value());

            // FM parameters
            let fm_depth = self.params.fm_depth.smoothed.next();
            let fm_algo = self.params.fm_algorithm.value();
            let fm_ratios = [
                self.params.fm_ratio1.value(),
                self.params.fm_ratio2.value(),
                self.params.fm_ratio3.value(),
                self.params.fm_ratio4.value(),
            ];
            let fm_levels = [
                self.params.fm_level1.value(),
                self.params.fm_level2.value(),
                self.params.fm_level3.value(),
                self.params.fm_level4.value(),
            ];

            // Granular parameters
            let grain_pos = self.params.grain_position.smoothed.next() / 100.0;
            let grain_size = self.params.grain_size.value() / 1000.0; // ms to seconds
            let grain_density = self.params.grain_density.value();
            let grain_pitch = self.params.grain_pitch.value();
            let grain_spread = self.params.grain_spread.value() / 100.0;

            // Agent X/Y params (can be driven by host automation or the agent brain)
            let agent_x = self.params.agent_x.smoothed.next();
            let agent_y = self.params.agent_y.smoothed.next();

            // LFO parameters
            let lfo1_rate = self.params.lfo1_rate.value();
            let lfo1_depth = self.params.lfo1_depth.value() / 100.0;

            // --- Process LFOs ---
            self.lfo_bank.lfos[0].rate = lfo1_rate;
            let lfo_outputs = self.lfo_bank.process();

            // --- Update LFO1→FilterCutoff route amount from lfo1_depth ---
            self.mod_matrix.slots[0].amount = lfo1_depth;

            // --- Combine agent brain output with agent params ---
            // The agent brain provides context-aware values; the params allow
            // host automation override. Sum them (clamped later).
            let agent_out = self.agent.output();
            let combined_agent_x = (agent_x + agent_out.x).clamp(-1.0, 1.0);
            let combined_agent_y = (agent_y + agent_out.y).clamp(-1.0, 1.0);

            // --- Build modulation source values ---
            let mod_sources = ModSourceValues {
                lfo: lfo_outputs,
                env: [0.0; 4], // Env2-4 not yet wired; Env1 is the amp env (used directly)
                velocity: 0.0, // Set per-voice below (TODO: per-voice mod processing)
                key_track: 0.0,
                mod_wheel: 0.0,
                aftertouch: 0.0,
                agent_x: combined_agent_x,
                agent_y: combined_agent_y,
            };

            // --- Process modulation matrix ---
            let mod_offsets = self.mod_matrix.process(&mod_sources);

            // --- Apply FM algorithm if it changed ---
            if fm_algo != self.last_fm_algo {
                for voice in self.voices.iter_mut() {
                    voice.fm_osc.set_algorithm(fm_algo as u8, fm_depth);
                }
                self.last_fm_algo = fm_algo;
            }

            // --- Compute modulated filter cutoff ---
            // mod_offsets.filter_cutoff scaled to semitones of cutoff shift
            let cutoff_mod_semitones = mod_offsets.filter_cutoff * 48.0;
            let cutoff_mod_factor = 2.0f32.powf(cutoff_mod_semitones / 12.0);
            let modulated_cutoff = (filter_cutoff * cutoff_mod_factor).clamp(20.0, 20_000.0);

            // --- Update drum kit parameters ---
            self.drum_kit.set_tune(self.params.drum_tune.value());
            self.drum_kit.set_decay(self.params.drum_decay.value());

            // --- Apply adaptive dynamics to drums ---
            let dyn_mods = self.adaptive_dynamics.modifiers();
            let dyn_vel_scale = dyn_mods.velocity_scale;
            let dyn_decay_scale = dyn_mods.decay_scale;

            // Apply dynamics decay scaling on top of user drum_decay param
            self.drum_kit
                .set_decay(self.params.drum_decay.value() * dyn_decay_scale);

            // --- Process drum kit ---
            let drum_out = self.drum_kit.process() * drum_gain * dyn_vel_scale;

            // --- Sum all active voices ---
            let mut mix = 0.0f32;

            for voice in self.voices.iter_mut() {
                if !voice.active {
                    continue;
                }

                // Update envelope parameters (allows live tweaking during sustain)
                voice
                    .envelope
                    .set_params(env_attack, env_decay, env_sustain, env_release);

                // Compute base frequency with pitch modulation from mod matrix
                let base_freq = midi_note_to_freq(voice.note, pitch_offset, fine_cents);
                let pitch_mod_semitones = mod_offsets.osc_pitch;
                let modulated_freq =
                    base_freq * 2.0f32.powf(pitch_mod_semitones / 12.0);

                // Update filter with modulated cutoff + resonance
                let reso_mod = (filter_reso + mod_offsets.filter_resonance).clamp(0.0, 1.0);
                voice.filter.set_params(modulated_cutoff, reso_mod);

                // --- Generate oscillator sample based on mode ---
                let osc_out = match osc_mode {
                    OscMode::Wavetable => {
                        voice
                            .oscillator
                            .set_frequency(modulated_freq, self.sample_rate);
                        let wt_pos_mod =
                            (wt_position + mod_offsets.wt_position).clamp(0.0, 1.0);
                        voice.oscillator.next_sample(&self.wavetable, wt_pos_mod)
                    }
                    OscMode::Fm => {
                        // Update FM operator params from plugin params + mod matrix
                        let effective_depth = (fm_depth + mod_offsets.fm_depth).max(0.0);
                        for (i, op) in voice.fm_osc.params.iter_mut().enumerate() {
                            op.ratio = (fm_ratios[i] + mod_offsets.fm_ratio[i]).max(0.001);
                            op.output_level = fm_levels[i];
                            op.feedback =
                                (op.feedback + mod_offsets.fm_feedback[i]).clamp(0.0, 1.0);
                        }
                        // Scale mod matrix depths by global FM depth
                        for src in 0..4 {
                            for dst in 0..4 {
                                let base = voice.fm_osc.mod_matrix[src][dst];
                                if base != 0.0 {
                                    voice.fm_osc.mod_matrix[src][dst] =
                                        base.signum() * effective_depth;
                                }
                            }
                        }
                        voice.fm_osc.process(modulated_freq)
                    }
                    OscMode::Granular => {
                        voice.granular.params.position =
                            (grain_pos + mod_offsets.grain_position).clamp(0.0, 1.0);
                        voice.granular.params.size =
                            (grain_size + mod_offsets.grain_size).max(0.001);
                        voice.granular.params.density =
                            (grain_density + mod_offsets.grain_density).max(0.1);
                        voice.granular.params.pitch = grain_pitch;
                        voice.granular.params.spread = grain_spread;
                        voice.granular.process()
                    }
                };

                // Apply filter
                let filtered = voice.filter.process_mode(osc_out, filter_mode);

                // Apply envelope
                let env_val = voice.envelope.next();

                // If envelope has finished, deactivate voice
                if voice.envelope.is_idle() {
                    voice.active = false;
                    continue;
                }

                // Apply volume modulation from mod matrix
                let vol_mod = (1.0 + mod_offsets.volume).max(0.0);
                mix += filtered * env_val * voice.velocity * vol_mod;
                voice.age += 1;
            }

            // --- Feed spectral awareness (before final mix) ---
            self.spectral_awareness.process(mix, drum_out);

            // Apply spectral advice: nudge drum level to avoid clashing
            let spec_advice = self.spectral_awareness.advice();
            let drum_adjusted = drum_out * (1.0 + spec_advice.drum_level_nudge);

            // Apply master volume and mix drums + synth → stereo output
            let output = (mix + drum_adjusted) * master_gain;
            for sample in channel_samples {
                *sample = output;
            }

            // --- Periodic memory snapshot (~every 5 seconds) ---
            self.memory_snapshot_counter += 1;
            if self.memory_snapshot_counter >= self.memory_snapshot_interval {
                self.memory_snapshot_counter = 0;
                // Normalize cutoff to 0-1 for memory storage
                let cutoff_norm = ((filter_cutoff / 20_000.0).ln() / (1.0f32).ln())
                    .clamp(0.0, 1.0);
                let lfo_d = self.params.lfo1_depth.value() / 100.0;
                let osc_m = self.params.osc_mode.value();
                // Approximate current hour (not precise without a clock, use 12 as default)
                self.session_memory
                    .record_parameter_snapshot(cutoff_norm, lfo_d, osc_m, 12);
            }
        }

        // --- End-of-buffer: update musical intelligence ---

        // Decay detectors (age out old data)
        self.chord_detector.decay();
        self.scale_detector.decay();

        // Detect chord and scale
        self.musical_context.chord = self
            .chord_detector
            .detect()
            .map(|r| (r.root, r.quality, r.confidence));
        self.musical_context.scale = self
            .scale_detector
            .detect()
            .map(|r| (r.root, r.scale_type, r.confidence));

        // Update energy tracker and read state
        self.energy_tracker.process_buffer();
        let energy_state = self.energy_tracker.state();
        self.musical_context.energy = energy_state.energy;
        self.musical_context.note_density = energy_state.note_density;
        self.musical_context.velocity_avg = energy_state.velocity_avg;

        // Run the agent brain — its output feeds AgentX/AgentY next buffer
        self.agent.process(&self.musical_context);

        // Run adaptive dynamics — its output shapes drum behavior next buffer
        self.adaptive_dynamics.process(&self.musical_context);

        ProcessStatus::KeepAlive
    }
}

impl ClapPlugin for TwentyTwentySeven {
    const CLAP_ID: &'static str = "chat.kernel.2027";
    const CLAP_DESCRIPTION: Option<&'static str> =
        Some("Agentic synthesizer designed for AI control");
    const CLAP_MANUAL_URL: Option<&'static str> = Some("https://kernel.chat");
    const CLAP_SUPPORT_URL: Option<&'static str> = None;
    const CLAP_FEATURES: &'static [ClapFeature] = &[
        ClapFeature::Instrument,
        ClapFeature::Synthesizer,
        ClapFeature::Stereo,
    ];
}

impl Vst3Plugin for TwentyTwentySeven {
    const VST3_CLASS_ID: [u8; 16] = *b"2027KernelSynth!";
    const VST3_SUBCATEGORIES: &'static [Vst3SubCategory] = &[
        Vst3SubCategory::Instrument,
        Vst3SubCategory::Synth,
    ];
}

nih_export_clap!(TwentyTwentySeven);
nih_export_vst3!(TwentyTwentySeven);
