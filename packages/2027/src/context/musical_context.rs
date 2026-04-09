//! Combined musical context state.
//!
//! A single struct that aggregates all detected musical information,
//! passed to the agent brain each buffer.

use super::chord_detector::ChordQuality;
use super::scale_detector::ScaleType;

/// Complete musical context for the current moment.
///
/// Updated once per audio buffer from the chord detector, scale detector,
/// and energy tracker outputs.
#[derive(Debug, Clone, Copy)]
pub struct MusicalContext {
    /// Detected chord: (root pitch class 0-11, quality, confidence 0-1).
    /// `None` if no chord is detected.
    pub chord: Option<(u8, ChordQuality, f32)>,

    /// Detected scale/key: (root pitch class 0-11, scale type, confidence 0-1).
    /// `None` if not enough data to determine key.
    pub scale: Option<(u8, ScaleType, f32)>,

    /// Composite energy level (0.0 = silence, 1.0 = maximum intensity).
    pub energy: f32,

    /// Host tempo in BPM.
    pub tempo: f64,

    /// Smoothed note density (notes per second).
    pub note_density: f32,

    /// Exponentially weighted average velocity (0.0 to 1.0).
    pub velocity_avg: f32,
}

impl Default for MusicalContext {
    fn default() -> Self {
        Self {
            chord: None,
            scale: None,
            energy: 0.0,
            tempo: 120.0,
            note_density: 0.0,
            velocity_avg: 0.0,
        }
    }
}

impl MusicalContext {
    /// Returns true if a minor-quality chord is detected with reasonable confidence.
    pub fn is_minor(&self) -> bool {
        match self.chord {
            Some((_, quality, confidence)) if confidence > 0.4 => matches!(
                quality,
                ChordQuality::Minor | ChordQuality::Min7 | ChordQuality::Diminished
            ),
            _ => false,
        }
    }

    /// Returns true if a major-quality chord is detected with reasonable confidence.
    pub fn is_major(&self) -> bool {
        match self.chord {
            Some((_, quality, confidence)) if confidence > 0.4 => matches!(
                quality,
                ChordQuality::Major | ChordQuality::Maj7 | ChordQuality::Dom7
            ),
            _ => false,
        }
    }
}
