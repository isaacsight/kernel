//! Plugin parameters for the 2027 synthesizer.
//!
//! All parameters use nih-plug's parameter system for host automation,
//! preset saving, and GUI binding.

use nih_plug::prelude::*;
use std::sync::Arc;

/// All user-facing parameters.
#[derive(Params)]
pub struct SynthParams {
    // --- Oscillator ---
    /// Coarse pitch offset in semitones (-24 to +24).
    #[id = "osc_pitch"]
    pub osc_pitch: IntParam,

    /// Fine pitch detune in cents (-100 to +100).
    #[id = "osc_fine"]
    pub osc_fine: FloatParam,

    /// Wavetable position (morph between frames), 0% to 100%.
    #[id = "wt_pos"]
    pub wt_position: FloatParam,

    // --- Filter ---
    /// Filter cutoff frequency in Hz.
    #[id = "flt_cutoff"]
    pub filter_cutoff: FloatParam,

    /// Filter resonance, 0% to 100%.
    #[id = "flt_reso"]
    pub filter_resonance: FloatParam,

    /// Filter mode: 0 = LP, 1 = HP, 2 = BP, 3 = Notch.
    #[id = "flt_mode"]
    pub filter_mode: IntParam,

    // --- Amplitude Envelope ---
    /// Attack time in seconds.
    #[id = "env_a"]
    pub env_attack: FloatParam,

    /// Decay time in seconds.
    #[id = "env_d"]
    pub env_decay: FloatParam,

    /// Sustain level, 0% to 100%.
    #[id = "env_s"]
    pub env_sustain: FloatParam,

    /// Release time in seconds.
    #[id = "env_r"]
    pub env_release: FloatParam,

    // --- Master ---
    /// Master output volume in dB.
    #[id = "master"]
    pub master_volume: FloatParam,
}

impl Default for SynthParams {
    fn default() -> Self {
        Self {
            // Oscillator
            osc_pitch: IntParam::new("Pitch", 0, IntRange::Linear { min: -24, max: 24 }),

            osc_fine: FloatParam::new(
                "Fine Tune",
                0.0,
                FloatRange::Linear {
                    min: -100.0,
                    max: 100.0,
                },
            )
            .with_unit(" ct")
            .with_step_size(1.0),

            wt_position: FloatParam::new(
                "WT Position",
                0.0,
                FloatRange::Linear {
                    min: 0.0,
                    max: 100.0,
                },
            )
            .with_unit("%")
            .with_smoother(SmoothingStyle::Linear(5.0))
            .with_step_size(0.1),

            // Filter
            filter_cutoff: FloatParam::new(
                "Cutoff",
                20_000.0,
                FloatRange::Skewed {
                    min: 20.0,
                    max: 20_000.0,
                    factor: FloatRange::skew_factor(-2.0),
                },
            )
            .with_smoother(SmoothingStyle::Logarithmic(5.0))
            .with_value_to_string(formatters::v2s_f32_hz_then_khz(0))
            .with_string_to_value(formatters::s2v_f32_hz_then_khz()),

            filter_resonance: FloatParam::new(
                "Resonance",
                0.0,
                FloatRange::Linear {
                    min: 0.0,
                    max: 100.0,
                },
            )
            .with_unit("%")
            .with_smoother(SmoothingStyle::Linear(5.0))
            .with_step_size(0.1),

            filter_mode: IntParam::new("Filter Mode", 0, IntRange::Linear { min: 0, max: 3 })
                .with_value_to_string(Arc::new(|value| {
                    match value {
                        0 => "Lowpass".to_string(),
                        1 => "Highpass".to_string(),
                        2 => "Bandpass".to_string(),
                        3 => "Notch".to_string(),
                        _ => "Lowpass".to_string(),
                    }
                }))
                .with_string_to_value(Arc::new(|s| {
                    match s.to_lowercase().as_str() {
                        "lowpass" | "lp" => Some(0),
                        "highpass" | "hp" => Some(1),
                        "bandpass" | "bp" => Some(2),
                        "notch" => Some(3),
                        _ => None,
                    }
                })),

            // Envelope
            env_attack: FloatParam::new(
                "Attack",
                0.01,
                FloatRange::Skewed {
                    min: 0.001,
                    max: 10.0,
                    factor: FloatRange::skew_factor(-2.0),
                },
            )
            .with_unit(" s")
            .with_step_size(0.001),

            env_decay: FloatParam::new(
                "Decay",
                0.1,
                FloatRange::Skewed {
                    min: 0.001,
                    max: 10.0,
                    factor: FloatRange::skew_factor(-2.0),
                },
            )
            .with_unit(" s")
            .with_step_size(0.001),

            env_sustain: FloatParam::new(
                "Sustain",
                70.0,
                FloatRange::Linear {
                    min: 0.0,
                    max: 100.0,
                },
            )
            .with_unit("%")
            .with_step_size(0.1),

            env_release: FloatParam::new(
                "Release",
                0.3,
                FloatRange::Skewed {
                    min: 0.001,
                    max: 10.0,
                    factor: FloatRange::skew_factor(-2.0),
                },
            )
            .with_unit(" s")
            .with_step_size(0.001),

            // Master
            master_volume: FloatParam::new(
                "Master",
                -6.0,
                FloatRange::Linear {
                    min: -60.0,
                    max: 6.0,
                },
            )
            .with_smoother(SmoothingStyle::Linear(3.0))
            .with_unit(" dB")
            .with_step_size(0.1),
        }
    }
}
