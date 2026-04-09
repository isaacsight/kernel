//! # 2027 — Agentic Synthesizer
//!
//! A VST3/CLAP wavetable synthesizer designed for AI-driven control.
//! Built with nih-plug.
//!
//! - 16-voice polyphony with oldest-voice stealing
//! - Wavetable oscillator: 2048-sample frames, 256-frame table, linear interpolation
//! - ZDF State Variable Filter (Zavalishin TPT): LP/HP/BP/Notch
//! - Exponential ADSR envelope
//! - Stereo output

use nih_plug::prelude::*;
use std::sync::Arc;

mod dsp;
mod params;

use dsp::envelope::Adsr;
use dsp::filter::{FilterMode, ZdfSvf};
use dsp::wavetable::{Wavetable, WavetableOscillator};
use params::SynthParams;

/// Maximum number of simultaneous voices.
const MAX_VOICES: usize = 16;

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
            envelope: Adsr::new(sample_rate),
            filter: ZdfSvf::new(sample_rate),
            age: 0,
        }
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.envelope.set_sample_rate(sample_rate);
        self.filter.set_sample_rate(sample_rate);
    }
}

/// The 2027 synthesizer plugin.
pub struct TwentyTwentySeven {
    params: Arc<SynthParams>,
    /// Shared wavetable (all voices read from the same table).
    wavetable: Wavetable,
    /// Polyphonic voice pool.
    voices: Vec<Voice>,
    /// Sample rate, set during initialization.
    sample_rate: f32,
}

impl Default for TwentyTwentySeven {
    fn default() -> Self {
        let mut wavetable = Wavetable::new();
        wavetable.init_default();

        let mut voices = Vec::with_capacity(MAX_VOICES);
        for _ in 0..MAX_VOICES {
            voices.push(Voice::new(44100.0));
        }

        Self {
            params: Arc::new(SynthParams::default()),
            wavetable,
            voices,
            sample_rate: 44100.0,
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
    fn note_on(&mut self, note: u8, velocity: f32, note_id: i32) {
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

        voice.oscillator.reset();
        voice.oscillator.set_frequency(freq, self.sample_rate);
        voice.envelope.gate_on();
        voice.filter.reset();
    }

    /// Handle a note-off event.
    fn note_off(&mut self, note: u8, note_id: i32) {
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

        for voice in self.voices.iter_mut() {
            voice.set_sample_rate(self.sample_rate);
        }

        true
    }

    fn reset(&mut self) {
        for voice in self.voices.iter_mut() {
            voice.active = false;
            voice.envelope.reset();
            voice.filter.reset();
            voice.oscillator.reset();
            voice.age = 0;
        }
    }

    fn process(
        &mut self,
        buffer: &mut Buffer,
        _aux: &mut AuxiliaryBuffers,
        context: &mut impl ProcessContext<Self>,
    ) -> ProcessStatus {
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
                        ..
                    } => {
                        self.note_on(note, velocity, voice_id.unwrap_or(-1));
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
            let wt_position = self.params.wt_position.smoothed.next() / 100.0; // 0..100% → 0..1
            let filter_cutoff = self.params.filter_cutoff.smoothed.next();
            let filter_reso = self.params.filter_resonance.smoothed.next() / 100.0; // 0..100% → 0..1
            let filter_mode = int_to_filter_mode(self.params.filter_mode.value());

            let env_attack = self.params.env_attack.value();
            let env_decay = self.params.env_decay.value();
            let env_sustain = self.params.env_sustain.value() / 100.0; // 0..100% → 0..1
            let env_release = self.params.env_release.value();

            // Pitch parameters (applied per-sample for pitch bend responsiveness)
            let pitch_offset = self.params.osc_pitch.value() as f32;
            let fine_cents = self.params.osc_fine.value();

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

                // Update oscillator frequency (pitch knob changes affect playing notes)
                let freq = midi_note_to_freq(voice.note, pitch_offset, fine_cents);
                voice.oscillator.set_frequency(freq, self.sample_rate);

                // Update filter
                voice.filter.set_params(filter_cutoff, filter_reso);

                // Generate oscillator sample
                let osc_out = voice.oscillator.next_sample(&self.wavetable, wt_position);

                // Apply filter
                let filtered = voice.filter.process_mode(osc_out, filter_mode);

                // Apply envelope
                let env_val = voice.envelope.next();

                // If envelope has finished, deactivate voice
                if voice.envelope.is_idle() {
                    voice.active = false;
                    continue;
                }

                mix += filtered * env_val * voice.velocity;
                voice.age += 1;
            }

            // Apply master volume and write to all output channels (mono → stereo)
            let output = mix * master_gain;
            for sample in channel_samples {
                *sample = output;
            }
        }

        ProcessStatus::KeepAlive
    }
}

impl ClapPlugin for TwentyTwentySeven {
    const CLAP_ID: &'static str = "chat.kernel.2027";
    const CLAP_DESCRIPTION: Option<&'static str> =
        Some("Agentic wavetable synthesizer designed for AI control");
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
