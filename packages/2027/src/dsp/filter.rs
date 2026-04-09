//! Zero-Delay Feedback State Variable Filter (ZDF-SVF).
//!
//! Implements the Topology-Preserving Transform (TPT) method from
//! Vadim Zavalishin's "The Art of VA Filter Design."
//!
//! Provides simultaneous lowpass, highpass, bandpass, and notch outputs.

use std::f32::consts::PI;

/// Filter output mode selector.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilterMode {
    Lowpass,
    Highpass,
    Bandpass,
    Notch,
}

/// Simultaneous filter outputs from a single processing step.
#[derive(Debug, Clone, Copy)]
pub struct FilterOutput {
    pub lp: f32,
    pub hp: f32,
    pub bp: f32,
    pub notch: f32,
}

/// ZDF State Variable Filter using the Topology-Preserving Transform.
///
/// Two integrators (s1, s2) hold the filter state. The TPT approach
/// resolves the implicit delay-free loop analytically, so the filter
/// is stable and accurate at all frequencies up to Nyquist.
pub struct ZdfSvf {
    // Integrator states
    s1: f32,
    s2: f32,

    // Coefficients (recomputed when cutoff or resonance changes)
    g: f32,  // tan(pi * fc / fs) — the integrator gain
    r2: f32, // 2 * R, where R controls resonance (R = 1/Q)

    // Cached for coefficient computation
    sample_rate: f32,
}

impl ZdfSvf {
    pub fn new(sample_rate: f32) -> Self {
        let mut filter = Self {
            s1: 0.0,
            s2: 0.0,
            g: 0.0,
            r2: 0.0,
            sample_rate,
        };
        filter.set_params(1000.0, 0.0);
        filter
    }

    /// Update filter coefficients.
    ///
    /// - `cutoff_hz`: filter cutoff frequency in Hz
    /// - `resonance`: resonance amount in `[0.0, 1.0]` (0 = no resonance, 1 = self-oscillation)
    pub fn set_params(&mut self, cutoff_hz: f32, resonance: f32) {
        // Clamp cutoff to just below Nyquist to avoid NaN from tan()
        let fc = cutoff_hz.clamp(20.0, self.sample_rate * 0.49);
        let resonance = resonance.clamp(0.0, 1.0);

        // g = tan(pi * fc / fs) — the bilinear-transform-derived integrator coefficient
        self.g = (PI * fc / self.sample_rate).tan();

        // R2 = 2 * R where R = 1 - resonance.
        // At resonance = 0: R2 = 2 (heavily damped, Q = 0.5)
        // At resonance = 1: R2 = 0 (self-oscillation, infinite Q)
        self.r2 = 2.0 * (1.0 - resonance);
    }

    /// Set the sample rate (call from `initialize`).
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate;
    }

    /// Reset integrator states (call on note-on or `reset`).
    pub fn reset(&mut self) {
        self.s1 = 0.0;
        self.s2 = 0.0;
    }

    /// Process a single sample through the filter.
    ///
    /// Returns all four outputs simultaneously. Pick the one you need
    /// based on the current `FilterMode`.
    #[inline]
    pub fn process(&mut self, input: f32) -> FilterOutput {
        // TPT SVF tick — Zavalishin's direct form:
        //
        //   hp = (input - r2*s1 - g*s1 - s2) / (1 + r2*g + g*g)
        //   bp = g*hp + s1
        //   lp = g*bp + s2
        //   notch = hp + lp
        //
        // Then update integrator states:
        //   s1 = g*hp + bp
        //   s2 = g*bp + lp

        let g = self.g;
        let r2 = self.r2;

        let hp = (input - r2 * self.s1 - g * self.s1 - self.s2) / (1.0 + r2 * g + g * g);
        let bp = g * hp + self.s1;
        let lp = g * bp + self.s2;
        let notch = hp + lp;

        // Update integrator states (trapezoidal integration)
        self.s1 = g * hp + bp;
        self.s2 = g * bp + lp;

        FilterOutput { lp, hp, bp, notch }
    }

    /// Convenience: process one sample and return only the selected mode's output.
    #[inline]
    pub fn process_mode(&mut self, input: f32, mode: FilterMode) -> f32 {
        let out = self.process(input);
        match mode {
            FilterMode::Lowpass => out.lp,
            FilterMode::Highpass => out.hp,
            FilterMode::Bandpass => out.bp,
            FilterMode::Notch => out.notch,
        }
    }
}
