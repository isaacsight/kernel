//! Spectral Awareness: self-mixing / frequency clash avoidance.
//!
//! Analyzes the synth's own output and the drum output using simple
//! one-pole band-splitting (no FFT) to detect frequency clashes
//! and output mix advice.
//!
//! Three bands tracked:
//! - Low: <200Hz (kick/bass conflict zone)
//! - Mid: 200Hz-4000Hz (body/presence)
//! - High: >4000Hz (hats/brightness)

/// Spectral advice: nudge values the plugin should apply.
#[derive(Debug, Clone, Copy)]
pub struct SpectralAdvice {
    /// Filter cutoff nudge for the synth: positive = nudge up (carve space for kick),
    /// negative = nudge down. Range: -0.1 to 0.1 (applied as cutoff multiplier offset).
    pub filter_nudge: f32,
    /// Drum level nudge: positive = louder, negative = quieter.
    /// Range: -0.15 to 0.15 (applied as gain multiplier offset).
    pub drum_level_nudge: f32,
    /// Current synth RMS by band (for display/debugging).
    pub synth_low: f32,
    pub synth_mid: f32,
    pub synth_high: f32,
    /// Current drum RMS by band.
    pub drum_low: f32,
    pub drum_mid: f32,
    pub drum_high: f32,
}

impl Default for SpectralAdvice {
    fn default() -> Self {
        Self {
            filter_nudge: 0.0,
            drum_level_nudge: 0.0,
            synth_low: 0.0,
            synth_mid: 0.0,
            synth_high: 0.0,
            drum_low: 0.0,
            drum_mid: 0.0,
            drum_high: 0.0,
        }
    }
}

/// Simple one-pole lowpass for band splitting.
struct OnePole {
    z1: f32,
    coeff: f32,
}

impl OnePole {
    fn new() -> Self {
        Self { z1: 0.0, coeff: 0.0 }
    }

    fn set_freq(&mut self, freq: f32, sample_rate: f32) {
        let w = (core::f32::consts::TAU * freq / sample_rate).min(1.0);
        self.coeff = w / (1.0 + w);
    }

    #[inline]
    fn process(&mut self, input: f32) -> f32 {
        self.z1 += self.coeff * (input - self.z1);
        self.z1
    }

    fn reset(&mut self) {
        self.z1 = 0.0;
    }
}

/// RMS tracker with exponential smoothing.
struct RmsTracker {
    squared_avg: f32,
    coeff: f32,
}

impl RmsTracker {
    fn new() -> Self {
        Self {
            squared_avg: 0.0,
            coeff: 0.001, // Will be set properly by set_sample_rate
        }
    }

    fn set_time_constant(&mut self, time_ms: f32, sample_rate: f32) {
        let samples = time_ms * 0.001 * sample_rate;
        if samples > 1.0 {
            self.coeff = 1.0 - (-1.0 / samples).exp();
        } else {
            self.coeff = 1.0;
        }
    }

    #[inline]
    fn process(&mut self, sample: f32) {
        self.squared_avg += self.coeff * (sample * sample - self.squared_avg);
        // Kill denormals
        if self.squared_avg < 1e-12 {
            self.squared_avg = 0.0;
        }
    }

    fn rms(&self) -> f32 {
        self.squared_avg.sqrt()
    }

    fn reset(&mut self) {
        self.squared_avg = 0.0;
    }
}

/// The spectral awareness engine.
///
/// Feed it synth and drum samples per-sample via `process()`,
/// then read `advice()` to get mix nudge values.
pub struct SpectralAwareness {
    // Band-split filters for synth signal
    synth_lp200: OnePole,  // Low band: everything below 200Hz
    synth_lp4k: OnePole,   // Mid split: below 4kHz

    // Band-split filters for drum signal
    drum_lp200: OnePole,
    drum_lp4k: OnePole,

    // RMS trackers per band
    synth_low_rms: RmsTracker,
    synth_mid_rms: RmsTracker,
    synth_high_rms: RmsTracker,
    drum_low_rms: RmsTracker,
    drum_mid_rms: RmsTracker,
    drum_high_rms: RmsTracker,

    // Smoothed advice output
    filter_nudge: f32,
    drum_level_nudge: f32,
    /// Per-buffer update counter (don't compute advice every sample).
    sample_counter: u32,
    advice_interval: u32,
}

impl SpectralAwareness {
    /// Create a new spectral awareness engine.
    pub fn new(sample_rate: f32) -> Self {
        let mut sa = Self {
            synth_lp200: OnePole::new(),
            synth_lp4k: OnePole::new(),
            drum_lp200: OnePole::new(),
            drum_lp4k: OnePole::new(),
            synth_low_rms: RmsTracker::new(),
            synth_mid_rms: RmsTracker::new(),
            synth_high_rms: RmsTracker::new(),
            drum_low_rms: RmsTracker::new(),
            drum_mid_rms: RmsTracker::new(),
            drum_high_rms: RmsTracker::new(),
            filter_nudge: 0.0,
            drum_level_nudge: 0.0,
            sample_counter: 0,
            advice_interval: 0,
        };
        sa.set_sample_rate(sample_rate);
        sa
    }

    /// Update sample rate and recalculate filter coefficients.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.synth_lp200.set_freq(200.0, sample_rate);
        self.synth_lp4k.set_freq(4000.0, sample_rate);
        self.drum_lp200.set_freq(200.0, sample_rate);
        self.drum_lp4k.set_freq(4000.0, sample_rate);

        // RMS tracking with 50ms time constant
        let tc = 50.0;
        self.synth_low_rms.set_time_constant(tc, sample_rate);
        self.synth_mid_rms.set_time_constant(tc, sample_rate);
        self.synth_high_rms.set_time_constant(tc, sample_rate);
        self.drum_low_rms.set_time_constant(tc, sample_rate);
        self.drum_mid_rms.set_time_constant(tc, sample_rate);
        self.drum_high_rms.set_time_constant(tc, sample_rate);

        // Update advice every ~5ms
        self.advice_interval = (sample_rate * 0.005) as u32;
        if self.advice_interval < 1 {
            self.advice_interval = 1;
        }
    }

    /// Process one sample of synth and drum output.
    ///
    /// Call this for every audio sample in the process loop.
    #[inline]
    pub fn process(&mut self, synth_sample: f32, drum_sample: f32) {
        // Band-split synth
        let s_low = self.synth_lp200.process(synth_sample);
        let s_below4k = self.synth_lp4k.process(synth_sample);
        let s_mid = s_below4k - s_low;
        let s_high = synth_sample - s_below4k;

        // Band-split drums
        let d_low = self.drum_lp200.process(drum_sample);
        let d_below4k = self.drum_lp4k.process(drum_sample);
        let d_mid = d_below4k - d_low;
        let d_high = drum_sample - d_below4k;

        // Track RMS
        self.synth_low_rms.process(s_low);
        self.synth_mid_rms.process(s_mid);
        self.synth_high_rms.process(s_high);
        self.drum_low_rms.process(d_low);
        self.drum_mid_rms.process(d_mid);
        self.drum_high_rms.process(d_high);

        // Periodically update advice
        self.sample_counter += 1;
        if self.sample_counter >= self.advice_interval {
            self.sample_counter = 0;
            self.update_advice();
        }
    }

    /// Get the current spectral advice.
    pub fn advice(&self) -> SpectralAdvice {
        SpectralAdvice {
            filter_nudge: self.filter_nudge,
            drum_level_nudge: self.drum_level_nudge,
            synth_low: self.synth_low_rms.rms(),
            synth_mid: self.synth_mid_rms.rms(),
            synth_high: self.synth_high_rms.rms(),
            drum_low: self.drum_low_rms.rms(),
            drum_mid: self.drum_mid_rms.rms(),
            drum_high: self.drum_high_rms.rms(),
        }
    }

    /// Reset all state.
    pub fn reset(&mut self) {
        self.synth_lp200.reset();
        self.synth_lp4k.reset();
        self.drum_lp200.reset();
        self.drum_lp4k.reset();
        self.synth_low_rms.reset();
        self.synth_mid_rms.reset();
        self.synth_high_rms.reset();
        self.drum_low_rms.reset();
        self.drum_mid_rms.reset();
        self.drum_high_rms.reset();
        self.filter_nudge = 0.0;
        self.drum_level_nudge = 0.0;
        self.sample_counter = 0;
    }

    // -----------------------------------------------------------------------
    // Internal advice computation
    // -----------------------------------------------------------------------

    fn update_advice(&mut self) {
        let sl = self.synth_low_rms.rms();
        let sh = self.synth_high_rms.rms();
        let dl = self.drum_low_rms.rms();
        let dh = self.drum_high_rms.rms();

        // Threshold for "loud" in a band
        let loud_threshold = 0.15;

        // --- Low band clash: drums + synth both loud below 200Hz ---
        // Nudge synth filter cutoff UP to carve space for the kick
        let low_clash = if sl > loud_threshold && dl > loud_threshold {
            let clash_amount = (sl * dl).sqrt(); // geometric mean of both levels
            (clash_amount * 0.5).min(0.1) // Max nudge: +0.1
        } else {
            0.0
        };

        // --- High band clash: synth bright + hats active ---
        // Slightly reduce drum level to avoid harshness
        let high_clash = if sh > loud_threshold && dh > loud_threshold * 0.5 {
            let clash_amount = (sh * dh).sqrt();
            -(clash_amount * 0.4).min(0.15) // Negative = reduce drums
        } else {
            0.0
        };

        // Smooth the advice values (don't jump)
        let smooth = 0.1;
        self.filter_nudge += (low_clash - self.filter_nudge) * smooth;
        self.drum_level_nudge += (high_clash - self.drum_level_nudge) * smooth;

        // Kill denormals
        if self.filter_nudge.abs() < 1e-6 {
            self.filter_nudge = 0.0;
        }
        if self.drum_level_nudge.abs() < 1e-6 {
            self.drum_level_nudge = 0.0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let sa = SpectralAwareness::new(44100.0);
        let advice = sa.advice();
        assert_eq!(advice.filter_nudge, 0.0);
        assert_eq!(advice.drum_level_nudge, 0.0);
    }

    #[test]
    fn test_no_clash_when_silent() {
        let mut sa = SpectralAwareness::new(44100.0);
        for _ in 0..4410 {
            sa.process(0.0, 0.0);
        }
        let advice = sa.advice();
        assert_eq!(advice.filter_nudge, 0.0);
        assert_eq!(advice.drum_level_nudge, 0.0);
    }

    #[test]
    fn test_low_clash_nudges_filter_up() {
        let mut sa = SpectralAwareness::new(44100.0);
        // Feed heavy bass on both synth and drums
        // Use a low-frequency sine (~100Hz) to get energy below 200Hz
        let freq = 100.0;
        let sr = 44100.0;
        for i in 0..44100 {
            let t = i as f32 / sr;
            let sample = 0.5 * (core::f32::consts::TAU * freq * t).sin();
            sa.process(sample, sample);
        }
        let advice = sa.advice();
        // Filter nudge should be positive (push synth cutoff up)
        assert!(advice.filter_nudge > 0.0, "Expected positive filter nudge, got {}", advice.filter_nudge);
    }

    #[test]
    fn test_reset() {
        let mut sa = SpectralAwareness::new(44100.0);
        sa.process(0.5, 0.5);
        sa.reset();
        assert_eq!(sa.advice().synth_low, 0.0);
    }
}
