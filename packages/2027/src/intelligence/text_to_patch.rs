//! Text-to-Patch Engine: parse natural language into synthesis parameters.
//!
//! Rule-based NLP with keyword extraction — no neural networks.
//! Each keyword category maps to specific parameter adjustments.
//! Multiple keywords compound additively, then clamp to valid ranges.

/// Oscillator type selection.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OscType {
    Wavetable,
    Fm,
    Granular,
}

impl OscType {
    /// Convert to the integer value used by `osc_mode` IntParam.
    pub fn to_param(self) -> i32 {
        match self {
            OscType::Wavetable => 0,
            OscType::Fm => 1,
            OscType::Granular => 2,
        }
    }
}

/// Filter type selection.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilterType {
    Lowpass,
    Highpass,
    Bandpass,
    Notch,
}

impl FilterType {
    pub fn to_param(self) -> i32 {
        match self {
            FilterType::Lowpass => 0,
            FilterType::Highpass => 1,
            FilterType::Bandpass => 2,
            FilterType::Notch => 3,
        }
    }
}

/// Complete patch description: all synth parameters derived from text.
///
/// Values are normalized 0.0-1.0 unless otherwise noted.
#[derive(Debug, Clone)]
pub struct PatchDescription {
    // --- Oscillator ---
    /// Oscillator type.
    pub osc_type: OscType,
    /// Pitch offset in semitones (-24 to +24).
    pub pitch_offset: f32,

    // --- Filter ---
    /// Filter cutoff (0.0 = 20Hz, 1.0 = 20kHz, logarithmic).
    pub filter_cutoff: f32,
    /// Filter resonance (0.0 to 1.0).
    pub filter_resonance: f32,
    /// Filter type.
    pub filter_type: FilterType,

    // --- Envelope (ADSR) ---
    /// Attack time (0.0 = instant, 1.0 = 10s).
    pub attack: f32,
    /// Decay time (0.0 = instant, 1.0 = 10s).
    pub decay: f32,
    /// Sustain level (0.0 to 1.0).
    pub sustain: f32,
    /// Release time (0.0 = instant, 1.0 = 10s).
    pub release: f32,

    // --- Modulation ---
    /// LFO rate (0.0 = 0.01Hz, 1.0 = 100Hz).
    pub lfo_rate: f32,
    /// LFO depth (0.0 to 1.0).
    pub lfo_depth: f32,

    // --- Character ---
    /// Fine detune in cents (0 = clean, up to 50 = detuned).
    pub detune: f32,
    /// Stereo spread / grain spread (0.0 to 1.0).
    pub spread: f32,

    // --- FM ---
    /// FM depth (0.0 to 1.0 normalized).
    pub fm_depth: f32,

    // --- Wavetable ---
    /// Wavetable position (0.0 to 1.0).
    pub wt_position: f32,

    // --- Text that generated this patch ---
    pub source_text: String,
    /// Confidence: how many keywords matched (0.0 = none, 1.0 = saturated).
    pub confidence: f32,
}

impl Default for PatchDescription {
    fn default() -> Self {
        Self {
            osc_type: OscType::Wavetable,
            pitch_offset: 0.0,
            filter_cutoff: 0.7,
            filter_resonance: 0.15,
            filter_type: FilterType::Lowpass,
            attack: 0.01,
            decay: 0.15,
            sustain: 0.7,
            release: 0.15,
            lfo_rate: 0.1,
            lfo_depth: 0.0,
            detune: 0.0,
            spread: 0.0,
            fm_depth: 0.0,
            wt_position: 0.0,
            source_text: String::new(),
            confidence: 0.0,
        }
    }
}

impl PatchDescription {
    /// Convert filter_cutoff (0-1 normalized) to Hz (20-20000, log scale).
    pub fn cutoff_hz(&self) -> f32 {
        20.0 * (1000.0f32).powf(self.filter_cutoff)
    }

    /// Convert attack (0-1 normalized) to seconds.
    pub fn attack_secs(&self) -> f32 {
        0.001 + self.attack * 9.999
    }

    /// Convert decay (0-1 normalized) to seconds.
    pub fn decay_secs(&self) -> f32 {
        0.001 + self.decay * 9.999
    }

    /// Convert release (0-1 normalized) to seconds.
    pub fn release_secs(&self) -> f32 {
        0.001 + self.release * 9.999
    }

    /// Convert lfo_rate (0-1 normalized) to Hz.
    pub fn lfo_rate_hz(&self) -> f32 {
        0.01 * (10000.0f32).powf(self.lfo_rate)
    }
}

// ---------------------------------------------------------------------------
// Keyword → parameter mappings
// ---------------------------------------------------------------------------

/// A keyword match: the word, which category it belongs to, and its effect.
struct KeywordRule {
    word: &'static str,
    apply: fn(&mut PatchDescription),
}

/// All keyword rules, grouped logically.
const RULES: &[KeywordRule] = &[
    // --- Brightness ---
    KeywordRule { word: "bright", apply: |p| { p.filter_cutoff += 0.25; p.filter_resonance += 0.05; } },
    KeywordRule { word: "brilliant", apply: |p| { p.filter_cutoff += 0.3; p.filter_resonance += 0.1; } },
    KeywordRule { word: "dark", apply: |p| { p.filter_cutoff -= 0.3; } },
    KeywordRule { word: "warm", apply: |p| { p.filter_cutoff -= 0.15; p.filter_resonance -= 0.05; p.detune += 5.0; } },
    KeywordRule { word: "cold", apply: |p| { p.filter_cutoff += 0.1; p.filter_resonance += 0.15; } },
    KeywordRule { word: "mellow", apply: |p| { p.filter_cutoff -= 0.2; p.filter_resonance -= 0.05; } },
    KeywordRule { word: "harsh", apply: |p| { p.filter_cutoff += 0.2; p.filter_resonance += 0.3; } },

    // --- Movement ---
    KeywordRule { word: "slow", apply: |p| { p.lfo_rate -= 0.15; p.lfo_depth += 0.3; } },
    KeywordRule { word: "fast", apply: |p| { p.lfo_rate += 0.3; p.lfo_depth += 0.3; } },
    KeywordRule { word: "evolving", apply: |p| { p.lfo_rate += 0.05; p.lfo_depth += 0.5; p.wt_position += 0.3; } },
    KeywordRule { word: "static", apply: |p| { p.lfo_depth = 0.0; p.lfo_rate = 0.0; } },
    KeywordRule { word: "pulsing", apply: |p| { p.lfo_rate += 0.25; p.lfo_depth += 0.6; } },
    KeywordRule { word: "breathing", apply: |p| { p.lfo_rate += 0.05; p.lfo_depth += 0.4; } },
    KeywordRule { word: "wobble", apply: |p| { p.lfo_rate += 0.2; p.lfo_depth += 0.7; } },

    // --- Character ---
    KeywordRule { word: "fat", apply: |p| { p.detune += 20.0; p.spread += 0.3; p.filter_cutoff -= 0.1; } },
    KeywordRule { word: "thick", apply: |p| { p.detune += 15.0; p.spread += 0.2; } },
    KeywordRule { word: "thin", apply: |p| { p.detune = 0.0; p.spread = 0.0; p.filter_cutoff += 0.1; } },
    KeywordRule { word: "wide", apply: |p| { p.spread += 0.5; p.detune += 10.0; } },
    KeywordRule { word: "narrow", apply: |p| { p.spread = 0.0; } },
    KeywordRule { word: "detuned", apply: |p| { p.detune += 30.0; p.spread += 0.2; } },
    KeywordRule { word: "clean", apply: |p| { p.detune = 0.0; p.fm_depth = 0.0; } },
    KeywordRule { word: "stereo", apply: |p| { p.spread += 0.4; } },
    KeywordRule { word: "mono", apply: |p| { p.spread = 0.0; } },

    // --- Texture ---
    KeywordRule { word: "smooth", apply: |p| { p.filter_resonance -= 0.1; p.filter_cutoff -= 0.05; } },
    KeywordRule { word: "gritty", apply: |p| { p.fm_depth += 0.3; p.filter_resonance += 0.15; } },
    KeywordRule { word: "noisy", apply: |p| { p.fm_depth += 0.5; p.filter_type = FilterType::Bandpass; } },
    KeywordRule { word: "pure", apply: |p| { p.fm_depth = 0.0; p.detune = 0.0; p.filter_resonance = 0.0; } },
    KeywordRule { word: "distorted", apply: |p| { p.fm_depth += 0.6; p.filter_resonance += 0.3; } },
    KeywordRule { word: "glassy", apply: |p| { p.filter_cutoff += 0.2; p.filter_resonance += 0.2; p.attack += 0.02; } },
    KeywordRule { word: "metallic", apply: |p| { p.fm_depth += 0.4; p.filter_resonance += 0.25; p.filter_cutoff += 0.1; } },
    KeywordRule { word: "hollow", apply: |p| { p.filter_type = FilterType::Bandpass; p.filter_resonance += 0.3; } },

    // --- Envelope ---
    KeywordRule { word: "plucky", apply: |p| { p.attack = 0.0; p.decay = 0.08; p.sustain = 0.0; p.release = 0.05; } },
    KeywordRule { word: "pluck", apply: |p| { p.attack = 0.0; p.decay = 0.08; p.sustain = 0.0; p.release = 0.05; } },
    KeywordRule { word: "pad", apply: |p| { p.attack = 0.3; p.decay = 0.4; p.sustain = 0.8; p.release = 0.5; } },
    KeywordRule { word: "stab", apply: |p| { p.attack = 0.0; p.decay = 0.05; p.sustain = 0.0; p.release = 0.02; } },
    KeywordRule { word: "sustained", apply: |p| { p.sustain = 1.0; p.release = 0.3; } },
    KeywordRule { word: "percussive", apply: |p| { p.attack = 0.0; p.decay = 0.06; p.sustain = 0.0; p.release = 0.03; } },
    KeywordRule { word: "swelling", apply: |p| { p.attack = 0.6; p.decay = 0.2; p.sustain = 0.9; } },
    KeywordRule { word: "snappy", apply: |p| { p.attack = 0.0; p.decay = 0.04; p.sustain = 0.1; p.release = 0.03; } },
    KeywordRule { word: "long", apply: |p| { p.release += 0.4; p.decay += 0.3; } },
    KeywordRule { word: "short", apply: |p| { p.release = 0.02; p.decay = 0.04; } },

    // --- Engine ---
    KeywordRule { word: "analog", apply: |p| { p.osc_type = OscType::Wavetable; p.detune += 8.0; p.filter_cutoff -= 0.1; } },
    KeywordRule { word: "analogue", apply: |p| { p.osc_type = OscType::Wavetable; p.detune += 8.0; p.filter_cutoff -= 0.1; } },
    KeywordRule { word: "digital", apply: |p| { p.osc_type = OscType::Wavetable; p.detune = 0.0; p.filter_cutoff += 0.1; } },
    KeywordRule { word: "fm", apply: |p| { p.osc_type = OscType::Fm; p.fm_depth = 0.5; } },
    KeywordRule { word: "granular", apply: |p| { p.osc_type = OscType::Granular; } },
    KeywordRule { word: "wavetable", apply: |p| { p.osc_type = OscType::Wavetable; p.wt_position = 0.5; } },
    KeywordRule { word: "grain", apply: |p| { p.osc_type = OscType::Granular; } },

    // --- Pitch ---
    KeywordRule { word: "sub", apply: |p| { p.pitch_offset = -24.0; p.filter_cutoff -= 0.2; } },
    KeywordRule { word: "bass", apply: |p| { p.pitch_offset = -12.0; p.filter_cutoff -= 0.15; } },
    KeywordRule { word: "mid", apply: |p| { p.pitch_offset = 0.0; } },
    KeywordRule { word: "high", apply: |p| { p.pitch_offset = 12.0; p.filter_cutoff += 0.1; } },
    KeywordRule { word: "lead", apply: |p| { p.pitch_offset = 12.0; p.filter_cutoff += 0.15; p.filter_resonance += 0.1; } },

    // --- Mood (composite adjustments) ---
    KeywordRule { word: "aggressive", apply: |p| {
        p.filter_cutoff += 0.15; p.filter_resonance += 0.2; p.fm_depth += 0.3;
        p.attack = 0.0; p.decay = 0.1;
    }},
    KeywordRule { word: "gentle", apply: |p| {
        p.filter_cutoff -= 0.15; p.filter_resonance -= 0.1;
        p.attack += 0.15; p.lfo_depth += 0.1; p.lfo_rate -= 0.05;
    }},
    KeywordRule { word: "ethereal", apply: |p| {
        p.attack = 0.3; p.release = 0.6; p.filter_cutoff += 0.1;
        p.lfo_depth += 0.3; p.lfo_rate -= 0.05; p.spread += 0.4;
        p.osc_type = OscType::Granular;
    }},
    KeywordRule { word: "heavy", apply: |p| {
        p.pitch_offset -= 12.0; p.filter_cutoff -= 0.2; p.fm_depth += 0.2;
        p.detune += 10.0;
    }},
    KeywordRule { word: "dreamy", apply: |p| {
        p.attack = 0.25; p.release = 0.5; p.lfo_depth += 0.3;
        p.lfo_rate -= 0.05; p.filter_cutoff -= 0.05; p.spread += 0.3;
    }},
    KeywordRule { word: "industrial", apply: |p| {
        p.fm_depth += 0.6; p.filter_resonance += 0.3; p.filter_cutoff += 0.1;
        p.attack = 0.0; p.decay = 0.05; p.osc_type = OscType::Fm;
    }},
    KeywordRule { word: "ambient", apply: |p| {
        p.attack = 0.4; p.release = 0.7; p.sustain = 0.8;
        p.lfo_depth += 0.2; p.lfo_rate -= 0.1; p.spread += 0.3;
        p.filter_cutoff -= 0.1;
    }},
    KeywordRule { word: "cinematic", apply: |p| {
        p.attack = 0.3; p.sustain = 0.9; p.release = 0.5;
        p.spread += 0.4; p.lfo_depth += 0.2;
    }},
];

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/// Parse a natural language description and produce synthesis parameters.
///
/// The parser lowercases the input, tokenizes on whitespace/punctuation,
/// and matches each token against the keyword rules. Multiple matches
/// compound additively, then values are clamped to valid ranges.
pub fn text_to_patch(description: &str) -> PatchDescription {
    let mut patch = PatchDescription::default();
    patch.source_text = description.to_string();

    let lower = description.to_lowercase();
    let mut match_count = 0u32;

    for rule in RULES {
        if lower.contains(rule.word) {
            (rule.apply)(&mut patch);
            match_count += 1;
        }
    }

    // Clamp all values to valid ranges
    patch.filter_cutoff = patch.filter_cutoff.clamp(0.0, 1.0);
    patch.filter_resonance = patch.filter_resonance.clamp(0.0, 1.0);
    patch.attack = patch.attack.clamp(0.0, 1.0);
    patch.decay = patch.decay.clamp(0.0, 1.0);
    patch.sustain = patch.sustain.clamp(0.0, 1.0);
    patch.release = patch.release.clamp(0.0, 1.0);
    patch.lfo_rate = patch.lfo_rate.clamp(0.0, 1.0);
    patch.lfo_depth = patch.lfo_depth.clamp(0.0, 1.0);
    patch.detune = patch.detune.clamp(0.0, 50.0);
    patch.spread = patch.spread.clamp(0.0, 1.0);
    patch.fm_depth = patch.fm_depth.clamp(0.0, 1.0);
    patch.wt_position = patch.wt_position.clamp(0.0, 1.0);
    patch.pitch_offset = patch.pitch_offset.clamp(-24.0, 24.0);

    // Confidence: saturates around 6+ keyword matches
    patch.confidence = (match_count as f32 / 6.0).min(1.0);

    patch
}

/// Generate a human-readable description from current parameter values.
///
/// Reverse of `text_to_patch` — examines parameter ranges and produces
/// descriptive words. Useful for UI display or agent communication.
pub fn describe_patch(
    filter_cutoff_norm: f32,
    filter_resonance: f32,
    attack: f32,
    decay: f32,
    sustain: f32,
    release: f32,
    lfo_depth: f32,
    lfo_rate: f32,
    detune: f32,
    fm_depth: f32,
    osc_mode: i32,
    pitch_offset: f32,
) -> String {
    let mut words: Vec<&str> = Vec::new();

    // Brightness
    if filter_cutoff_norm > 0.85 {
        words.push("bright");
    } else if filter_cutoff_norm < 0.35 {
        words.push("dark");
    } else if filter_cutoff_norm < 0.55 {
        words.push("warm");
    }

    // Resonance character
    if filter_resonance > 0.6 {
        words.push("resonant");
    }

    // Movement
    if lfo_depth > 0.5 && lfo_rate > 0.3 {
        words.push("pulsing");
    } else if lfo_depth > 0.3 && lfo_rate < 0.15 {
        words.push("breathing");
    } else if lfo_depth > 0.3 {
        words.push("evolving");
    } else if lfo_depth < 0.05 {
        words.push("static");
    }

    // Character
    if detune > 20.0 {
        words.push("detuned");
    } else if detune > 10.0 {
        words.push("fat");
    } else if detune < 2.0 && fm_depth < 0.1 {
        words.push("clean");
    }

    // Texture
    if fm_depth > 0.5 {
        words.push("gritty");
    } else if fm_depth > 0.2 {
        words.push("metallic");
    }

    // Envelope shape
    if attack < 0.02 && decay < 0.1 && sustain < 0.15 {
        words.push("plucky");
    } else if attack > 0.2 && sustain > 0.6 && release > 0.3 {
        words.push("pad");
    } else if attack < 0.02 && decay < 0.06 {
        words.push("percussive");
    } else if attack > 0.3 {
        words.push("swelling");
    }

    // Engine
    match osc_mode {
        1 => words.push("FM"),
        2 => words.push("granular"),
        _ => {
            if detune > 5.0 {
                words.push("analog");
            } else {
                words.push("wavetable");
            }
        }
    }

    // Pitch range
    if pitch_offset <= -18.0 {
        words.push("sub");
    } else if pitch_offset <= -6.0 {
        words.push("bass");
    } else if pitch_offset >= 6.0 {
        words.push("lead");
    }

    if words.is_empty() {
        "neutral init patch".to_string()
    } else {
        words.join(" ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bright_pad() {
        let patch = text_to_patch("bright evolving pad");
        assert!(patch.filter_cutoff > 0.7);
        assert!(patch.attack > 0.2);
        assert!(patch.lfo_depth > 0.3);
        assert!(patch.confidence > 0.0);
    }

    #[test]
    fn test_sub_bass() {
        let patch = text_to_patch("fat sub bass");
        assert!(patch.pitch_offset < -10.0);
        assert!(patch.detune > 15.0);
    }

    #[test]
    fn test_fm_metallic() {
        let patch = text_to_patch("metallic fm stab");
        assert_eq!(patch.osc_type, OscType::Fm);
        assert!(patch.fm_depth > 0.3);
        assert!(patch.decay < 0.1);
    }

    #[test]
    fn test_empty_input() {
        let patch = text_to_patch("");
        assert_eq!(patch.confidence, 0.0);
    }

    #[test]
    fn test_describe_roundtrip() {
        let desc = describe_patch(0.9, 0.2, 0.01, 0.08, 0.0, 0.05, 0.0, 0.0, 0.0, 0.0, 0, 0.0);
        assert!(desc.contains("bright"));
        assert!(desc.contains("plucky"));
    }
}
