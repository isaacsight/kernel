//! Real-time chord detection from MIDI note-on events.
//!
//! Maintains a 12-element pitch class histogram with exponential decay.
//! Template-matches against common chord types to identify the current chord.

/// Chord quality types recognized by the detector.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChordQuality {
    Major,
    Minor,
    Diminished,
    Augmented,
    Dom7,
    Maj7,
    Min7,
    Sus2,
    Sus4,
}

/// Detected chord result.
#[derive(Debug, Clone, Copy)]
pub struct ChordResult {
    /// Root pitch class (0 = C, 1 = C#, ... 11 = B).
    pub root: u8,
    /// Chord quality.
    pub quality: ChordQuality,
    /// Confidence level (0.0 to 1.0).
    pub confidence: f32,
}

/// Chord templates: intervals relative to root for each chord quality.
/// Each template is a fixed-size array of pitch class offsets.
struct ChordTemplate {
    quality: ChordQuality,
    intervals: &'static [u8],
}

const CHORD_TEMPLATES: &[ChordTemplate] = &[
    ChordTemplate { quality: ChordQuality::Major,      intervals: &[0, 4, 7] },
    ChordTemplate { quality: ChordQuality::Minor,      intervals: &[0, 3, 7] },
    ChordTemplate { quality: ChordQuality::Diminished,  intervals: &[0, 3, 6] },
    ChordTemplate { quality: ChordQuality::Augmented,   intervals: &[0, 4, 8] },
    ChordTemplate { quality: ChordQuality::Dom7,        intervals: &[0, 4, 7, 10] },
    ChordTemplate { quality: ChordQuality::Maj7,        intervals: &[0, 4, 7, 11] },
    ChordTemplate { quality: ChordQuality::Min7,        intervals: &[0, 3, 7, 10] },
    ChordTemplate { quality: ChordQuality::Sus2,        intervals: &[0, 2, 7] },
    ChordTemplate { quality: ChordQuality::Sus4,        intervals: &[0, 5, 7] },
];

/// Real-time chord detector using pitch class histograms and template matching.
///
/// Feed MIDI note-on events via [`note_on`]. Call [`detect`] after processing
/// events to get the current chord. Call [`decay`] once per buffer to age out
/// old notes (exponential decay over ~500ms).
pub struct ChordDetector {
    /// Pitch class histogram (C through B). Each bin accumulates velocity-weighted hits.
    histogram: [f32; 12],
    /// Decay coefficient per sample (computed from sample rate and window time).
    decay_per_sample: f32,
    /// Number of samples in a process buffer (for per-buffer decay).
    samples_per_buffer: usize,
}

impl ChordDetector {
    /// Create a new chord detector.
    ///
    /// - `sample_rate`: audio sample rate (e.g. 44100.0)
    /// - `buffer_size`: samples per process buffer (e.g. 512)
    pub fn new(sample_rate: f32, buffer_size: usize) -> Self {
        // We want ~500ms half-life for the histogram decay.
        // decay^(samples_in_500ms) = 0.5
        // decay = 0.5^(1 / (sample_rate * 0.5))
        let half_life_samples = sample_rate * 0.5;
        let decay_per_sample = 0.5f32.powf(1.0 / half_life_samples);

        Self {
            histogram: [0.0; 12],
            decay_per_sample,
            samples_per_buffer: buffer_size,
        }
    }

    /// Update sample rate and buffer size (call from plugin `initialize`).
    pub fn set_sample_rate(&mut self, sample_rate: f32, buffer_size: usize) {
        let half_life_samples = sample_rate * 0.5;
        self.decay_per_sample = 0.5f32.powf(1.0 / half_life_samples);
        self.samples_per_buffer = buffer_size;
    }

    /// Register a note-on event.
    ///
    /// - `note`: MIDI note number (0-127)
    /// - `velocity`: note velocity (0.0 to 1.0)
    #[inline]
    pub fn note_on(&mut self, note: u8, velocity: f32) {
        let pitch_class = (note % 12) as usize;
        self.histogram[pitch_class] += velocity;
    }

    /// Apply exponential decay to the histogram for one buffer's worth of samples.
    /// Call this once per process buffer, before [`detect`].
    #[inline]
    pub fn decay(&mut self) {
        // Compute the combined decay for the entire buffer at once
        // to avoid per-sample iteration of the histogram.
        let buffer_decay = self.decay_per_sample.powi(self.samples_per_buffer as i32);
        for bin in self.histogram.iter_mut() {
            *bin *= buffer_decay;
            // Zero out negligible values to prevent denormals
            if *bin < 1e-7 {
                *bin = 0.0;
            }
        }
    }

    /// Reset the histogram.
    pub fn reset(&mut self) {
        self.histogram = [0.0; 12];
    }

    /// Detect the current chord from the pitch class histogram.
    ///
    /// Returns `None` if fewer than 3 pitch classes are active (above threshold)
    /// or if confidence is too low.
    pub fn detect(&self) -> Option<ChordResult> {
        // Count how many pitch classes are active
        let threshold = 0.05;
        let active_count = self.histogram.iter().filter(|&&v| v > threshold).count();
        if active_count < 2 {
            return None;
        }

        // Normalize the histogram to sum to 1.0
        let sum: f32 = self.histogram.iter().sum();
        if sum < 1e-6 {
            return None;
        }

        let mut normalized = [0.0f32; 12];
        for i in 0..12 {
            normalized[i] = self.histogram[i] / sum;
        }

        // Try every root (0-11) against every template, find the best match
        let mut best_score = 0.0f32;
        let mut best_root = 0u8;
        let mut best_quality = ChordQuality::Major;

        for root in 0u8..12 {
            for template in CHORD_TEMPLATES {
                let score = self.score_template(root, template, &normalized);
                if score > best_score {
                    best_score = score;
                    best_root = root;
                    best_quality = template.quality;
                }
            }
        }

        // Minimum confidence threshold
        if best_score < 0.3 {
            return None;
        }

        Some(ChordResult {
            root: best_root,
            quality: best_quality,
            confidence: best_score.min(1.0),
        })
    }

    /// Score a chord template against the normalized histogram.
    ///
    /// The score is the sum of histogram values at the template's pitch classes,
    /// minus a penalty for energy in non-template pitch classes.
    #[inline]
    fn score_template(&self, root: u8, template: &ChordTemplate, normalized: &[f32; 12]) -> f32 {
        let mut template_energy = 0.0f32;
        let mut non_template_energy = 0.0f32;

        // Build a mask of which pitch classes belong to this template
        let mut mask = [false; 12];
        for &interval in template.intervals {
            let pc = ((root + interval) % 12) as usize;
            mask[pc] = true;
        }

        for pc in 0..12 {
            if mask[pc] {
                template_energy += normalized[pc];
            } else {
                non_template_energy += normalized[pc];
            }
        }

        // Score: how much energy lands on template notes vs. off them.
        // A perfect match would have template_energy = 1.0, non_template_energy = 0.0.
        // We weight non-template energy as a penalty.
        let score = template_energy - 0.5 * non_template_energy;
        score.max(0.0)
    }
}
