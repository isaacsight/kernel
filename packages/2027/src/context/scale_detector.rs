//! Scale and key detection using the Krumhansl-Schmuckler key-finding algorithm.
//!
//! Accumulates pitch class distributions over a longer window (~4 bars)
//! and correlates them against key profiles to determine the current key
//! and scale type.

/// Scale types recognized by the detector.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScaleType {
    Major,
    NaturalMinor,
    HarmonicMinor,
    Dorian,
    Mixolydian,
    Phrygian,
    Lydian,
    PentatonicMajor,
    PentatonicMinor,
    Blues,
    Chromatic,
}

/// Detected scale/key result.
#[derive(Debug, Clone, Copy)]
pub struct ScaleResult {
    /// Key root pitch class (0 = C, 1 = C#, ... 11 = B).
    pub root: u8,
    /// Scale type.
    pub scale_type: ScaleType,
    /// Confidence level (0.0 to 1.0).
    pub confidence: f32,
}

/// Krumhansl-Kessler major key profile.
/// Correlates with pitch class frequency distributions in major-key music.
const KK_MAJOR: [f32; 12] = [
    6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];

/// Krumhansl-Kessler minor key profile.
const KK_MINOR: [f32; 12] = [
    6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

/// Scale templates: which pitch classes are in each scale (relative to root).
/// Used after key detection to identify the specific scale type.
struct ScaleTemplate {
    scale_type: ScaleType,
    intervals: &'static [u8],
}

const SCALE_TEMPLATES: &[ScaleTemplate] = &[
    ScaleTemplate { scale_type: ScaleType::Major,           intervals: &[0, 2, 4, 5, 7, 9, 11] },
    ScaleTemplate { scale_type: ScaleType::NaturalMinor,    intervals: &[0, 2, 3, 5, 7, 8, 10] },
    ScaleTemplate { scale_type: ScaleType::HarmonicMinor,   intervals: &[0, 2, 3, 5, 7, 8, 11] },
    ScaleTemplate { scale_type: ScaleType::Dorian,          intervals: &[0, 2, 3, 5, 7, 9, 10] },
    ScaleTemplate { scale_type: ScaleType::Mixolydian,      intervals: &[0, 2, 4, 5, 7, 9, 10] },
    ScaleTemplate { scale_type: ScaleType::Phrygian,        intervals: &[0, 1, 3, 5, 7, 8, 10] },
    ScaleTemplate { scale_type: ScaleType::Lydian,          intervals: &[0, 2, 4, 6, 7, 9, 11] },
    ScaleTemplate { scale_type: ScaleType::PentatonicMajor, intervals: &[0, 2, 4, 7, 9] },
    ScaleTemplate { scale_type: ScaleType::PentatonicMinor, intervals: &[0, 3, 5, 7, 10] },
    ScaleTemplate { scale_type: ScaleType::Blues,           intervals: &[0, 3, 5, 6, 7, 10] },
    ScaleTemplate { scale_type: ScaleType::Chromatic,       intervals: &[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

/// Scale detector using the Krumhansl-Schmuckler key-finding algorithm.
///
/// Accumulates pitch class data over a longer window (~4 bars at current tempo).
/// Call [`note_on`] for each MIDI event. Call [`detect`] to get the current key.
/// Call [`decay`] once per buffer to age out old data.
pub struct ScaleDetector {
    /// Accumulated pitch class distribution (C through B).
    distribution: [f32; 12],
    /// Decay coefficient per sample.
    decay_per_sample: f32,
    /// Samples per process buffer.
    samples_per_buffer: usize,
    /// Total accumulated weight (for determining if we have enough data).
    total_weight: f32,
}

impl ScaleDetector {
    /// Create a new scale detector.
    ///
    /// - `sample_rate`: audio sample rate
    /// - `buffer_size`: samples per process buffer
    /// - `tempo`: initial tempo in BPM (used to compute ~4 bar window)
    pub fn new(sample_rate: f32, buffer_size: usize, tempo: f64) -> Self {
        let decay_per_sample = Self::compute_decay(sample_rate, tempo);
        Self {
            distribution: [0.0; 12],
            decay_per_sample,
            samples_per_buffer: buffer_size,
            total_weight: 0.0,
        }
    }

    /// Compute per-sample decay coefficient for ~4 bars half-life.
    fn compute_decay(sample_rate: f32, tempo: f64) -> f32 {
        // 4 bars in 4/4 = 16 beats. At the given tempo, that's:
        let four_bars_secs = (16.0 * 60.0 / tempo) as f32;
        // Half-life = 4 bars
        let half_life_samples = sample_rate * four_bars_secs;
        0.5f32.powf(1.0 / half_life_samples.max(1.0))
    }

    /// Update sample rate and buffer size.
    pub fn set_sample_rate(&mut self, sample_rate: f32, buffer_size: usize) {
        self.samples_per_buffer = buffer_size;
        // Recompute with a default 120 BPM; tempo updates come via set_tempo
        self.decay_per_sample = Self::compute_decay(sample_rate, 120.0);
    }

    /// Update the decay window based on current tempo.
    pub fn set_tempo(&mut self, sample_rate: f32, tempo: f64) {
        self.decay_per_sample = Self::compute_decay(sample_rate, tempo.max(20.0));
    }

    /// Register a note-on event.
    #[inline]
    pub fn note_on(&mut self, note: u8, velocity: f32) {
        let pc = (note % 12) as usize;
        self.distribution[pc] += velocity;
        self.total_weight += velocity;
    }

    /// Apply exponential decay for one buffer.
    #[inline]
    pub fn decay(&mut self) {
        let buffer_decay = self.decay_per_sample.powi(self.samples_per_buffer as i32);
        self.total_weight = 0.0;
        for bin in self.distribution.iter_mut() {
            *bin *= buffer_decay;
            if *bin < 1e-7 {
                *bin = 0.0;
            }
            self.total_weight += *bin;
        }
    }

    /// Reset all accumulated data.
    pub fn reset(&mut self) {
        self.distribution = [0.0; 12];
        self.total_weight = 0.0;
    }

    /// Detect the current key and scale using Krumhansl-Schmuckler.
    ///
    /// Returns `None` if not enough data has been accumulated.
    pub fn detect(&self) -> Option<ScaleResult> {
        // Need some minimum data
        if self.total_weight < 0.5 {
            return None;
        }

        // Step 1: Find the best key (root) using K-S correlation with major/minor profiles
        let mut best_corr = -2.0f32;
        let mut best_root = 0u8;
        let mut best_is_minor = false;

        for root in 0u8..12 {
            let major_corr = self.correlate_profile(root, &KK_MAJOR);
            let minor_corr = self.correlate_profile(root, &KK_MINOR);

            if major_corr > best_corr {
                best_corr = major_corr;
                best_root = root;
                best_is_minor = false;
            }
            if minor_corr > best_corr {
                best_corr = minor_corr;
                best_root = root;
                best_is_minor = true;
            }
        }

        // Step 2: Determine specific scale type by template matching
        let scale_type = self.match_scale_type(best_root, best_is_minor);

        // Convert correlation (-1..1) to confidence (0..1).
        // Pearson r of 0.8+ is a strong match; below 0.4 is weak.
        let confidence = ((best_corr + 1.0) / 2.0).clamp(0.0, 1.0);

        if confidence < 0.3 {
            return None;
        }

        Some(ScaleResult {
            root: best_root,
            scale_type,
            confidence,
        })
    }

    /// Pearson correlation between the rotated distribution and a key profile.
    fn correlate_profile(&self, root: u8, profile: &[f32; 12]) -> f32 {
        // Rotate distribution so that `root` is at index 0
        let mut rotated = [0.0f32; 12];
        for i in 0..12 {
            rotated[i] = self.distribution[(i + root as usize) % 12];
        }

        // Compute means
        let mean_dist = rotated.iter().sum::<f32>() / 12.0;
        let mean_prof = profile.iter().sum::<f32>() / 12.0;

        // Pearson correlation
        let mut cov = 0.0f32;
        let mut var_dist = 0.0f32;
        let mut var_prof = 0.0f32;

        for i in 0..12 {
            let d = rotated[i] - mean_dist;
            let p = profile[i] - mean_prof;
            cov += d * p;
            var_dist += d * d;
            var_prof += p * p;
        }

        let denom = (var_dist * var_prof).sqrt();
        if denom < 1e-10 {
            return 0.0;
        }

        cov / denom
    }

    /// After determining the key root and major/minor tendency, find the
    /// best-matching specific scale type by comparing which scale template
    /// best covers the active pitch classes.
    fn match_scale_type(&self, root: u8, is_minor: bool) -> ScaleType {
        let mut best_score = -1.0f32;
        let mut best_type = if is_minor {
            ScaleType::NaturalMinor
        } else {
            ScaleType::Major
        };

        // Normalize distribution
        let sum: f32 = self.distribution.iter().sum();
        if sum < 1e-6 {
            return best_type;
        }

        let mut normalized = [0.0f32; 12];
        for i in 0..12 {
            normalized[i] = self.distribution[i] / sum;
        }

        for template in SCALE_TEMPLATES {
            // Skip chromatic — it matches everything and is the fallback
            if template.scale_type == ScaleType::Chromatic {
                continue;
            }

            let mut in_scale = 0.0f32;
            let mut out_scale = 0.0f32;

            let mut mask = [false; 12];
            for &interval in template.intervals {
                mask[((root + interval) % 12) as usize] = true;
            }

            for pc in 0..12 {
                if mask[pc] {
                    in_scale += normalized[pc];
                } else {
                    out_scale += normalized[pc];
                }
            }

            // Penalize shorter scales less (pentatonic has 5 notes, should still win
            // if all notes fall within it).
            let coverage = in_scale - 0.3 * out_scale;
            if coverage > best_score {
                best_score = coverage;
                best_type = template.scale_type;
            }
        }

        best_type
    }
}
