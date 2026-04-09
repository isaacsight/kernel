//! Wavetable oscillator with anti-aliased playback.
//!
//! - 2048 samples per frame
//! - 256 frames per table
//! - Linear interpolation between samples (within a frame)
//! - Linear interpolation between frames (morphing via `position` 0.0..1.0)

/// Samples per wavetable frame.
pub const FRAME_SIZE: usize = 2048;

/// Number of frames in a wavetable.
pub const NUM_FRAMES: usize = 256;

/// A wavetable: 256 frames of 2048 samples each.
pub struct Wavetable {
    /// Flat storage: `frames[frame_index][sample_index]`.
    frames: Vec<[f32; FRAME_SIZE]>,
}

impl Wavetable {
    /// Create a wavetable filled with zeros.
    pub fn new() -> Self {
        Self {
            frames: vec![[0.0; FRAME_SIZE]; NUM_FRAMES],
        }
    }

    /// Initialize with a default saw-to-sine morph.
    /// Frame 0 = sawtooth, frame 255 = sine, linear crossfade between.
    pub fn init_default(&mut self) {
        // Generate a single-cycle sawtooth
        let mut saw = [0.0f32; FRAME_SIZE];
        for i in 0..FRAME_SIZE {
            let phase = i as f32 / FRAME_SIZE as f32;
            saw[i] = 2.0 * phase - 1.0;
        }

        // Generate a single-cycle sine
        let mut sine = [0.0f32; FRAME_SIZE];
        for i in 0..FRAME_SIZE {
            let phase = i as f32 / FRAME_SIZE as f32;
            sine[i] = (phase * std::f32::consts::TAU).sin();
        }

        // Morph: frame 0 = pure saw, frame 255 = pure sine
        for f in 0..NUM_FRAMES {
            let mix = f as f32 / (NUM_FRAMES - 1) as f32;
            for s in 0..FRAME_SIZE {
                self.frames[f][s] = saw[s] * (1.0 - mix) + sine[s] * mix;
            }
        }
    }

    /// Write a complete frame into the table.
    pub fn set_frame(&mut self, index: usize, data: &[f32; FRAME_SIZE]) {
        if index < NUM_FRAMES {
            self.frames[index] = *data;
        }
    }

    /// Read a sample with linear interpolation between samples and between frames.
    ///
    /// - `phase`: oscillator phase in `[0.0, 1.0)`
    /// - `position`: wavetable position in `[0.0, 1.0]` (morph between frames)
    #[inline]
    pub fn sample(&self, phase: f32, position: f32) -> f32 {
        // --- Frame interpolation ---
        let pos_scaled = position.clamp(0.0, 1.0) * (NUM_FRAMES - 1) as f32;
        let frame_lo = pos_scaled as usize;
        let frame_hi = (frame_lo + 1).min(NUM_FRAMES - 1);
        let frame_frac = pos_scaled - frame_lo as f32;

        // --- Sample interpolation within each frame ---
        let sample_lo = self.sample_frame(frame_lo, phase);
        let sample_hi = self.sample_frame(frame_hi, phase);

        // Linear crossfade between frames
        sample_lo + (sample_hi - sample_lo) * frame_frac
    }

    /// Read a sample from a single frame with linear interpolation between samples.
    #[inline]
    fn sample_frame(&self, frame_index: usize, phase: f32) -> f32 {
        let phase = phase.clamp(0.0, 1.0 - f32::EPSILON);
        let pos = phase * FRAME_SIZE as f32;
        let idx_lo = pos as usize;
        let idx_hi = (idx_lo + 1) % FRAME_SIZE; // wrap around for seamless looping
        let frac = pos - idx_lo as f32;

        let frame = &self.frames[frame_index];
        frame[idx_lo] + (frame[idx_hi] - frame[idx_lo]) * frac
    }
}

/// Per-voice wavetable oscillator state.
pub struct WavetableOscillator {
    /// Current phase, always in `[0.0, 1.0)`.
    phase: f32,
    /// Phase increment per sample (frequency / sample_rate).
    phase_delta: f32,
}

impl WavetableOscillator {
    pub fn new() -> Self {
        Self {
            phase: 0.0,
            phase_delta: 0.0,
        }
    }

    /// Set the oscillator frequency.
    pub fn set_frequency(&mut self, freq_hz: f32, sample_rate: f32) {
        self.phase_delta = freq_hz / sample_rate;
    }

    /// Generate the next sample from the given wavetable at the given morph position.
    #[inline]
    pub fn next_sample(&mut self, table: &Wavetable, position: f32) -> f32 {
        let out = table.sample(self.phase, position);

        // Advance phase
        self.phase += self.phase_delta;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }

        out
    }

    /// Reset phase to zero (used on note-on).
    pub fn reset(&mut self) {
        self.phase = 0.0;
    }
}
