//! ADSR envelope generator with exponential curves.
//!
//! Each stage uses an exponential approach toward its target value,
//! which produces natural-sounding attack and decay curves.

/// Envelope stages.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Stage {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}

/// ADSR envelope generator.
///
/// All time parameters are in seconds. Sustain is a level (0.0..1.0).
/// The envelope outputs values in `[0.0, 1.0]`.
pub struct Adsr {
    stage: Stage,
    /// Current envelope output value.
    value: f32,

    // Time parameters (seconds)
    attack: f32,
    decay: f32,
    sustain: f32,
    release: f32,

    // Per-sample coefficients (computed from times + sample rate)
    attack_coeff: f32,
    decay_coeff: f32,
    release_coeff: f32,

    sample_rate: f32,
}

impl Adsr {
    pub fn new(sample_rate: f32) -> Self {
        let mut env = Self {
            stage: Stage::Idle,
            value: 0.0,
            attack: 0.01,
            decay: 0.1,
            sustain: 0.7,
            release: 0.3,
            attack_coeff: 0.0,
            decay_coeff: 0.0,
            release_coeff: 0.0,
            sample_rate,
        };
        env.recompute_coefficients();
        env
    }

    /// Set ADSR parameters.
    ///
    /// - `attack`: attack time in seconds (minimum 0.001)
    /// - `decay`: decay time in seconds (minimum 0.001)
    /// - `sustain`: sustain level, 0.0..1.0
    /// - `release`: release time in seconds (minimum 0.001)
    pub fn set_params(&mut self, attack: f32, decay: f32, sustain: f32, release: f32) {
        self.attack = attack.max(0.001);
        self.decay = decay.max(0.001);
        self.sustain = sustain.clamp(0.0, 1.0);
        self.release = release.max(0.001);
        self.recompute_coefficients();
    }

    /// Set the sample rate (call from `initialize`).
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate;
        self.recompute_coefficients();
    }

    /// Recompute exponential coefficients from current parameters.
    ///
    /// For an exponential envelope approaching a target:
    ///   value = value + (target - value) * coeff
    ///
    /// We want to reach ~99.3% of the target in `time` seconds,
    /// so coeff = 1 - exp(-1 / (time * sample_rate)).
    /// The -1 exponent gives us roughly 5 time constants in `time` seconds.
    fn recompute_coefficients(&mut self) {
        let sr = self.sample_rate;
        // Using a time constant that reaches ~99.3% in the specified time
        // (approximately 5 * tau where tau = time / 5)
        self.attack_coeff = compute_coeff(self.attack, sr);
        self.decay_coeff = compute_coeff(self.decay, sr);
        self.release_coeff = compute_coeff(self.release, sr);
    }

    /// Trigger the envelope (note-on).
    pub fn gate_on(&mut self) {
        self.stage = Stage::Attack;
        // Don't reset value to 0 — allows retriggering mid-release without clicks.
    }

    /// Release the envelope (note-off).
    pub fn gate_off(&mut self) {
        if self.stage != Stage::Idle {
            self.stage = Stage::Release;
        }
    }

    /// Force the envelope to idle immediately.
    pub fn reset(&mut self) {
        self.stage = Stage::Idle;
        self.value = 0.0;
    }

    /// Returns true if the envelope has finished (idle state).
    pub fn is_idle(&self) -> bool {
        self.stage == Stage::Idle
    }

    /// Generate the next envelope sample.
    #[inline]
    pub fn next(&mut self) -> f32 {
        match self.stage {
            Stage::Idle => {
                self.value = 0.0;
            }
            Stage::Attack => {
                // Exponential approach toward 1.0.
                // We overshoot the target slightly (1.2) so the curve
                // reaches 1.0 faster and doesn't asymptotically crawl.
                self.value += (1.2 - self.value) * self.attack_coeff;
                if self.value >= 1.0 {
                    self.value = 1.0;
                    self.stage = Stage::Decay;
                }
            }
            Stage::Decay => {
                // Exponential approach toward sustain level.
                self.value += (self.sustain - self.value) * self.decay_coeff;
                // Transition when close enough to sustain
                if (self.value - self.sustain).abs() < 1e-5 {
                    self.value = self.sustain;
                    self.stage = Stage::Sustain;
                }
            }
            Stage::Sustain => {
                self.value = self.sustain;
                // Stay here until gate_off() is called.
            }
            Stage::Release => {
                // Exponential approach toward 0.
                // Undershoot target slightly (-0.001) to ensure we reach zero.
                self.value += (-0.001 - self.value) * self.release_coeff;
                if self.value <= 1e-5 {
                    self.value = 0.0;
                    self.stage = Stage::Idle;
                }
            }
        }

        self.value
    }
}

/// Compute an exponential coefficient for a given time and sample rate.
///
/// This produces a one-pole filter coefficient that reaches ~99.3% of
/// the target value in `time_secs` seconds.
#[inline]
fn compute_coeff(time_secs: f32, sample_rate: f32) -> f32 {
    // 5 time constants in the given time → reaches e^-5 ≈ 0.67% remaining
    let tau = time_secs / 5.0;
    1.0 - (-1.0 / (tau * sample_rate)).exp()
}
