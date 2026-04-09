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
    /// Oscillator mode: 0 = Wavetable, 1 = FM, 2 = Granular.
    #[id = "osc_mode"]
    pub osc_mode: IntParam,

    /// Coarse pitch offset in semitones (-24 to +24).
    #[id = "osc_pitch"]
    pub osc_pitch: IntParam,

    /// Fine pitch detune in cents (-100 to +100).
    #[id = "osc_fine"]
    pub osc_fine: FloatParam,

    /// Wavetable position (morph between frames), 0% to 100%.
    #[id = "wt_pos"]
    pub wt_position: FloatParam,

    // --- FM ---
    /// FM operator 1 frequency ratio.
    #[id = "fm_ratio1"]
    pub fm_ratio1: FloatParam,

    /// FM operator 2 frequency ratio.
    #[id = "fm_ratio2"]
    pub fm_ratio2: FloatParam,

    /// FM operator 3 frequency ratio.
    #[id = "fm_ratio3"]
    pub fm_ratio3: FloatParam,

    /// FM operator 4 frequency ratio.
    #[id = "fm_ratio4"]
    pub fm_ratio4: FloatParam,

    /// FM operator 1 output level.
    #[id = "fm_level1"]
    pub fm_level1: FloatParam,

    /// FM operator 2 output level.
    #[id = "fm_level2"]
    pub fm_level2: FloatParam,

    /// FM operator 3 output level.
    #[id = "fm_level3"]
    pub fm_level3: FloatParam,

    /// FM operator 4 output level.
    #[id = "fm_level4"]
    pub fm_level4: FloatParam,

    /// FM modulation depth (global scaling for the mod matrix).
    #[id = "fm_depth"]
    pub fm_depth: FloatParam,

    /// FM algorithm selector (0-4, quick presets).
    #[id = "fm_algo"]
    pub fm_algorithm: IntParam,

    // --- Granular ---
    /// Granular playback position (0-100%).
    #[id = "gr_pos"]
    pub grain_position: FloatParam,

    /// Granular grain size in ms (1-500).
    #[id = "gr_size"]
    pub grain_size: FloatParam,

    /// Granular density in grains/sec (1-500).
    #[id = "gr_density"]
    pub grain_density: FloatParam,

    /// Granular pitch shift in semitones (-24 to +24).
    #[id = "gr_pitch"]
    pub grain_pitch: FloatParam,

    /// Granular spread (random position variation, 0-100%).
    #[id = "gr_spread"]
    pub grain_spread: FloatParam,

    // --- Mod Matrix: Agent outputs ---
    /// Agent X parameter (-1 to +1). Driven by AI context engine.
    #[id = "agent_x"]
    pub agent_x: FloatParam,

    /// Agent Y parameter (-1 to +1). Driven by AI context engine.
    #[id = "agent_y"]
    pub agent_y: FloatParam,

    // --- LFO 1 ---
    /// LFO 1 rate in Hz.
    #[id = "lfo1_rate"]
    pub lfo1_rate: FloatParam,

    /// LFO 1 depth (amount of modulation, 0-100%).
    #[id = "lfo1_depth"]
    pub lfo1_depth: FloatParam,

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

    // --- Drums ---
    /// Drum kit output level in dB (-30 to +6).
    #[id = "drum_level"]
    pub drum_level: FloatParam,

    /// Drum kit global tune offset in semitones (-24 to +24).
    #[id = "drum_tune"]
    pub drum_tune: FloatParam,

    /// Drum kit global decay multiplier (0.1 to 2.0).
    #[id = "drum_decay"]
    pub drum_decay: FloatParam,

    // --- Master ---
    /// Master output volume in dB.
    #[id = "master"]
    pub master_volume: FloatParam,

    // --- Agent ---
    /// Agent mode: 0 = Off, 1 = Follow, 2 = Contrast, 3 = Chaos, 4 = Breathe.
    #[id = "agent_mode"]
    pub agent_mode: IntParam,

    /// Agent reactivity: how much the agent affects the sound, 0% to 100%.
    #[id = "agent_react"]
    pub agent_reactivity: FloatParam,
}

impl Default for SynthParams {
    fn default() -> Self {
        Self {
            // Oscillator mode
            osc_mode: IntParam::new("Osc Mode", 0, IntRange::Linear { min: 0, max: 2 })
                .with_value_to_string(Arc::new(|value| {
                    match value {
                        0 => "Wavetable".to_string(),
                        1 => "FM".to_string(),
                        2 => "Granular".to_string(),
                        _ => "Wavetable".to_string(),
                    }
                }))
                .with_string_to_value(Arc::new(|s| {
                    match s.to_lowercase().as_str() {
                        "wavetable" | "wt" => Some(0),
                        "fm" => Some(1),
                        "granular" | "grain" => Some(2),
                        _ => None,
                    }
                })),

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

            // FM parameters
            fm_ratio1: FloatParam::new(
                "FM Ratio 1",
                1.0,
                FloatRange::Linear { min: 0.125, max: 16.0 },
            )
            .with_step_size(0.001),

            fm_ratio2: FloatParam::new(
                "FM Ratio 2",
                2.0,
                FloatRange::Linear { min: 0.125, max: 16.0 },
            )
            .with_step_size(0.001),

            fm_ratio3: FloatParam::new(
                "FM Ratio 3",
                1.0,
                FloatRange::Linear { min: 0.125, max: 16.0 },
            )
            .with_step_size(0.001),

            fm_ratio4: FloatParam::new(
                "FM Ratio 4",
                1.0,
                FloatRange::Linear { min: 0.125, max: 16.0 },
            )
            .with_step_size(0.001),

            fm_level1: FloatParam::new(
                "FM Level 1",
                1.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_step_size(0.01),

            fm_level2: FloatParam::new(
                "FM Level 2",
                0.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_step_size(0.01),

            fm_level3: FloatParam::new(
                "FM Level 3",
                0.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_step_size(0.01),

            fm_level4: FloatParam::new(
                "FM Level 4",
                0.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_step_size(0.01),

            fm_depth: FloatParam::new(
                "FM Depth",
                1.0,
                FloatRange::Skewed {
                    min: 0.0,
                    max: 10.0,
                    factor: FloatRange::skew_factor(-1.0),
                },
            )
            .with_smoother(SmoothingStyle::Linear(5.0))
            .with_step_size(0.01),

            fm_algorithm: IntParam::new("FM Algorithm", 0, IntRange::Linear { min: 0, max: 4 })
                .with_value_to_string(Arc::new(|value| {
                    match value {
                        0 => "2>1".to_string(),
                        1 => "3>2>1".to_string(),
                        2 => "4>3>2>1".to_string(),
                        3 => "(2+3)>1".to_string(),
                        4 => "2>1 + 4>3".to_string(),
                        _ => "2>1".to_string(),
                    }
                })),

            // Granular parameters
            grain_position: FloatParam::new(
                "Grain Pos",
                0.0,
                FloatRange::Linear { min: 0.0, max: 100.0 },
            )
            .with_unit("%")
            .with_smoother(SmoothingStyle::Linear(5.0))
            .with_step_size(0.1),

            grain_size: FloatParam::new(
                "Grain Size",
                50.0,
                FloatRange::Skewed {
                    min: 1.0,
                    max: 500.0,
                    factor: FloatRange::skew_factor(-1.5),
                },
            )
            .with_unit(" ms")
            .with_step_size(0.1),

            grain_density: FloatParam::new(
                "Grain Density",
                20.0,
                FloatRange::Skewed {
                    min: 1.0,
                    max: 500.0,
                    factor: FloatRange::skew_factor(-1.5),
                },
            )
            .with_unit(" g/s")
            .with_step_size(0.1),

            grain_pitch: FloatParam::new(
                "Grain Pitch",
                0.0,
                FloatRange::Linear { min: -24.0, max: 24.0 },
            )
            .with_unit(" st")
            .with_step_size(0.1),

            grain_spread: FloatParam::new(
                "Grain Spread",
                10.0,
                FloatRange::Linear { min: 0.0, max: 100.0 },
            )
            .with_unit("%")
            .with_step_size(0.1),

            // Agent mod matrix outputs
            agent_x: FloatParam::new(
                "Agent X",
                0.0,
                FloatRange::Linear { min: -1.0, max: 1.0 },
            )
            .with_smoother(SmoothingStyle::Linear(10.0))
            .with_step_size(0.001),

            agent_y: FloatParam::new(
                "Agent Y",
                0.0,
                FloatRange::Linear { min: -1.0, max: 1.0 },
            )
            .with_smoother(SmoothingStyle::Linear(10.0))
            .with_step_size(0.001),

            // LFO 1
            lfo1_rate: FloatParam::new(
                "LFO1 Rate",
                1.0,
                FloatRange::Skewed {
                    min: 0.01,
                    max: 100.0,
                    factor: FloatRange::skew_factor(-2.0),
                },
            )
            .with_unit(" Hz")
            .with_step_size(0.01),

            lfo1_depth: FloatParam::new(
                "LFO1 Depth",
                0.0,
                FloatRange::Linear { min: 0.0, max: 100.0 },
            )
            .with_unit("%")
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

            // Drums
            drum_level: FloatParam::new(
                "Drum Level",
                0.0,
                FloatRange::Linear {
                    min: -30.0,
                    max: 6.0,
                },
            )
            .with_smoother(SmoothingStyle::Linear(5.0))
            .with_unit(" dB")
            .with_step_size(0.1),

            drum_tune: FloatParam::new(
                "Drum Tune",
                0.0,
                FloatRange::Linear {
                    min: -24.0,
                    max: 24.0,
                },
            )
            .with_unit(" st")
            .with_step_size(0.1),

            drum_decay: FloatParam::new(
                "Drum Decay",
                1.0,
                FloatRange::Linear {
                    min: 0.1,
                    max: 2.0,
                },
            )
            .with_step_size(0.01),

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

            // Agent
            agent_mode: IntParam::new("Agent Mode", 0, IntRange::Linear { min: 0, max: 4 })
                .with_value_to_string(Arc::new(|value| {
                    match value {
                        0 => "Off".to_string(),
                        1 => "Follow".to_string(),
                        2 => "Contrast".to_string(),
                        3 => "Chaos".to_string(),
                        4 => "Breathe".to_string(),
                        _ => "Off".to_string(),
                    }
                }))
                .with_string_to_value(Arc::new(|s| {
                    match s.to_lowercase().as_str() {
                        "off" => Some(0),
                        "follow" => Some(1),
                        "contrast" => Some(2),
                        "chaos" => Some(3),
                        "breathe" => Some(4),
                        _ => None,
                    }
                })),

            agent_reactivity: FloatParam::new(
                "Reactivity",
                50.0,
                FloatRange::Linear {
                    min: 0.0,
                    max: 100.0,
                },
            )
            .with_unit("%")
            .with_step_size(1.0),
        }
    }
}
