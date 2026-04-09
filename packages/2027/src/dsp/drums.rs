//! Synthesized drum machine with 8 drum voices.
//!
//! Each voice is fully synthesized (no samples):
//! - Kick: sine pitch sweep + click transient + saturation
//! - Snare: tuned body + bandpass noise
//! - HiHat Closed: metallic noise, very short decay
//! - HiHat Open: metallic noise, longer decay
//! - Clap: multiple noise micro-bursts through bandpass
//! - Tom: sine pitch sweep (higher range)
//! - Rim: triangle wave click
//! - Percussion: two detuned sines (cowbell-like)

/// Simple pseudo-random number generator (xorshift32) for noise.
/// Avoids pulling in `rand` as a dependency.
struct Rng {
    state: u32,
}

impl Rng {
    fn new(seed: u32) -> Self {
        Self {
            state: if seed == 0 { 1 } else { seed },
        }
    }

    /// Returns a float in [-1.0, 1.0].
    #[inline]
    fn next_f32(&mut self) -> f32 {
        self.state ^= self.state << 13;
        self.state ^= self.state >> 17;
        self.state ^= self.state << 5;
        // Map u32 to [-1, 1]
        (self.state as f32 / u32::MAX as f32) * 2.0 - 1.0
    }
}

// ---------------------------------------------------------------------------
// One-pole filters (lightweight, suitable for drum voices)
// ---------------------------------------------------------------------------

/// Simple one-pole lowpass filter.
struct OnePole {
    z1: f32,
    a: f32, // coefficient
}

impl OnePole {
    fn new() -> Self {
        Self { z1: 0.0, a: 0.0 }
    }

    fn set_freq(&mut self, freq: f32, sr: f32) {
        let w = (std::f32::consts::TAU * freq / sr).min(1.0);
        self.a = w / (1.0 + w);
    }

    #[inline]
    fn process(&mut self, input: f32) -> f32 {
        self.z1 += self.a * (input - self.z1);
        self.z1
    }

    fn reset(&mut self) {
        self.z1 = 0.0;
    }
}

/// Simple two-pole bandpass (biquad, peaking style).
struct Bandpass {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl Bandpass {
    fn new() -> Self {
        Self {
            b0: 0.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            x1: 0.0,
            x2: 0.0,
            y1: 0.0,
            y2: 0.0,
        }
    }

    fn set_params(&mut self, freq: f32, q: f32, sr: f32) {
        let w0 = std::f32::consts::TAU * freq / sr;
        let sin_w0 = w0.sin();
        let cos_w0 = w0.cos();
        let alpha = sin_w0 / (2.0 * q);

        let a0 = 1.0 + alpha;
        self.b0 = (sin_w0 / 2.0) / a0;
        self.b1 = 0.0;
        self.b2 = -(sin_w0 / 2.0) / a0;
        self.a1 = (-2.0 * cos_w0) / a0;
        self.a2 = (1.0 - alpha) / a0;
    }

    #[inline]
    fn process(&mut self, input: f32) -> f32 {
        let out = self.b0 * input + self.b1 * self.x1 + self.b2 * self.x2
            - self.a1 * self.y1
            - self.a2 * self.y2;
        self.x2 = self.x1;
        self.x1 = input;
        self.y2 = self.y1;
        self.y1 = out;
        out
    }

    fn reset(&mut self) {
        self.x1 = 0.0;
        self.x2 = 0.0;
        self.y1 = 0.0;
        self.y2 = 0.0;
    }
}

/// Simple two-pole highpass (biquad).
struct Highpass {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl Highpass {
    fn new() -> Self {
        Self {
            b0: 0.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            x1: 0.0,
            x2: 0.0,
            y1: 0.0,
            y2: 0.0,
        }
    }

    fn set_params(&mut self, freq: f32, q: f32, sr: f32) {
        let w0 = std::f32::consts::TAU * freq / sr;
        let sin_w0 = w0.sin();
        let cos_w0 = w0.cos();
        let alpha = sin_w0 / (2.0 * q);

        let a0 = 1.0 + alpha;
        self.b0 = ((1.0 + cos_w0) / 2.0) / a0;
        self.b1 = -(1.0 + cos_w0) / a0;
        self.b2 = ((1.0 + cos_w0) / 2.0) / a0;
        self.a1 = (-2.0 * cos_w0) / a0;
        self.a2 = (1.0 - alpha) / a0;
    }

    #[inline]
    fn process(&mut self, input: f32) -> f32 {
        let out = self.b0 * input + self.b1 * self.x1 + self.b2 * self.x2
            - self.a1 * self.y1
            - self.a2 * self.y2;
        self.x2 = self.x1;
        self.x1 = input;
        self.y2 = self.y1;
        self.y1 = out;
        out
    }

    fn reset(&mut self) {
        self.x1 = 0.0;
        self.x2 = 0.0;
        self.y1 = 0.0;
        self.y2 = 0.0;
    }
}

// ---------------------------------------------------------------------------
// Drum voice trait and implementations
// ---------------------------------------------------------------------------

/// Shared state for all drum voices.
trait DrumVoice {
    /// Trigger the drum voice (note on).
    fn trigger(&mut self, velocity: f32);
    /// Set tuning offset in semitones (-24 to +24).
    fn set_tune(&mut self, semitones: f32);
    /// Set decay multiplier (0.1 to 2.0).
    fn set_decay(&mut self, multiplier: f32);
    /// Set level (0.0 to 1.0).
    fn set_level(&mut self, level: f32);
    /// Process one sample, returning mono f32.
    fn process(&mut self) -> f32;
    /// Reset internal state.
    fn reset(&mut self);
    /// Whether the voice is currently producing sound.
    fn is_active(&self) -> bool;
}

// ---- Kick ----

/// Kick drum: sine pitch sweep (200Hz -> 40Hz, ~50ms) + click transient + saturation.
pub struct Kick {
    sample_rate: f32,
    active: bool,
    velocity: f32,
    level: f32,
    /// Phase accumulator for sine oscillator.
    phase: f32,
    /// Current instantaneous frequency.
    freq: f32,
    /// Start frequency (tunable).
    freq_start: f32,
    /// End frequency (tunable).
    freq_end: f32,
    /// Pitch sweep time in samples.
    sweep_samples: f32,
    /// Amplitude envelope time constant (decay).
    amp_decay: f32,
    /// Current amplitude envelope value.
    amp_env: f32,
    /// Click transient duration in samples.
    click_samples: f32,
    /// Elapsed samples since trigger.
    elapsed: f32,
    /// Tune offset in semitones.
    tune: f32,
    /// Decay multiplier.
    decay_mult: f32,
    /// Noise RNG for click.
    rng: Rng,
}

impl Kick {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            active: false,
            velocity: 0.0,
            level: 1.0,
            phase: 0.0,
            freq: 200.0,
            freq_start: 200.0,
            freq_end: 40.0,
            sweep_samples: sample_rate * 0.05, // 50ms
            amp_decay: (-1.0 / (sample_rate * 0.3)).exp(), // ~300ms
            amp_env: 0.0,
            click_samples: sample_rate * 0.002, // 2ms
            elapsed: 0.0,
            tune: 0.0,
            decay_mult: 1.0,
            rng: Rng::new(42),
        }
    }

    fn update_tuning(&mut self) {
        let ratio = 2.0f32.powf(self.tune / 12.0);
        self.freq_start = 200.0 * ratio;
        self.freq_end = 40.0 * ratio;
    }
}

impl DrumVoice for Kick {
    fn trigger(&mut self, velocity: f32) {
        self.velocity = velocity;
        self.phase = 0.0;
        self.elapsed = 0.0;
        self.amp_env = 1.0;
        self.active = true;
        self.update_tuning();
        let decay_time = 0.3 * self.decay_mult;
        self.amp_decay = (-1.0 / (self.sample_rate * decay_time)).exp();
        self.sweep_samples = self.sample_rate * 0.05 * self.decay_mult.max(0.5);
    }

    fn set_tune(&mut self, semitones: f32) {
        self.tune = semitones.clamp(-24.0, 24.0);
    }

    fn set_decay(&mut self, multiplier: f32) {
        self.decay_mult = multiplier.clamp(0.1, 2.0);
    }

    fn set_level(&mut self, level: f32) {
        self.level = level.clamp(0.0, 1.0);
    }

    fn process(&mut self) -> f32 {
        if !self.active {
            return 0.0;
        }

        // Pitch sweep: exponential decay from freq_start to freq_end
        let sweep_t = (self.elapsed / self.sweep_samples).min(1.0);
        self.freq = self.freq_start * (self.freq_end / self.freq_start).powf(sweep_t);

        // Sine oscillator
        let sine = (self.phase * std::f32::consts::TAU).sin();
        self.phase += self.freq / self.sample_rate;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }

        // Click transient (noise burst in first ~2ms)
        let click = if self.elapsed < self.click_samples {
            self.rng.next_f32() * (1.0 - self.elapsed / self.click_samples)
        } else {
            0.0
        };

        // Mix body + click
        let raw = sine + click * 0.5;

        // Soft saturation (tanh approximation)
        let drive = 1.5;
        let driven = (raw * drive).tanh();

        // Amplitude envelope
        self.amp_env *= self.amp_decay;
        self.elapsed += 1.0;

        if self.amp_env < 0.0001 {
            self.active = false;
        }

        driven * self.amp_env * self.velocity * self.level
    }

    fn reset(&mut self) {
        self.active = false;
        self.phase = 0.0;
        self.elapsed = 0.0;
        self.amp_env = 0.0;
    }

    fn is_active(&self) -> bool {
        self.active
    }
}

// ---- Snare ----

/// Snare: tuned body (sine ~180Hz, fast decay) + noise (bandpass ~3kHz, medium decay).
pub struct Snare {
    sample_rate: f32,
    active: bool,
    velocity: f32,
    level: f32,
    /// Sine body phase.
    phase: f32,
    /// Body frequency.
    body_freq: f32,
    /// Body envelope.
    body_env: f32,
    body_decay: f32,
    /// Noise envelope.
    noise_env: f32,
    noise_decay: f32,
    /// Bandpass filter for noise component.
    bp: Bandpass,
    rng: Rng,
    tune: f32,
    decay_mult: f32,
}

impl Snare {
    pub fn new(sample_rate: f32) -> Self {
        let mut bp = Bandpass::new();
        bp.set_params(3000.0, 1.5, sample_rate);
        Self {
            sample_rate,
            active: false,
            velocity: 0.0,
            level: 1.0,
            phase: 0.0,
            body_freq: 180.0,
            body_env: 0.0,
            body_decay: (-1.0 / (sample_rate * 0.08)).exp(),
            noise_env: 0.0,
            noise_decay: (-1.0 / (sample_rate * 0.15)).exp(),
            bp,
            rng: Rng::new(123),
            tune: 0.0,
            decay_mult: 1.0,
        }
    }
}

impl DrumVoice for Snare {
    fn trigger(&mut self, velocity: f32) {
        self.velocity = velocity;
        self.phase = 0.0;
        self.body_env = 1.0;
        self.noise_env = 1.0;
        self.active = true;

        let ratio = 2.0f32.powf(self.tune / 12.0);
        self.body_freq = 180.0 * ratio;
        self.body_decay = (-1.0 / (self.sample_rate * 0.08 * self.decay_mult)).exp();
        self.noise_decay = (-1.0 / (self.sample_rate * 0.15 * self.decay_mult)).exp();

        let bp_freq = 3000.0 * ratio;
        self.bp.set_params(bp_freq, 1.5, self.sample_rate);
        self.bp.reset();
    }

    fn set_tune(&mut self, semitones: f32) {
        self.tune = semitones.clamp(-24.0, 24.0);
    }

    fn set_decay(&mut self, multiplier: f32) {
        self.decay_mult = multiplier.clamp(0.1, 2.0);
    }

    fn set_level(&mut self, level: f32) {
        self.level = level.clamp(0.0, 1.0);
    }

    fn process(&mut self) -> f32 {
        if !self.active {
            return 0.0;
        }

        // Body: sine
        let body = (self.phase * std::f32::consts::TAU).sin();
        self.phase += self.body_freq / self.sample_rate;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }

        // Noise through bandpass
        let noise_raw = self.rng.next_f32();
        let noise = self.bp.process(noise_raw);

        // Envelopes
        self.body_env *= self.body_decay;
        self.noise_env *= self.noise_decay;

        let out = body * self.body_env * 0.6 + noise * self.noise_env * 0.8;

        if self.body_env < 0.0001 && self.noise_env < 0.0001 {
            self.active = false;
        }

        out * self.velocity * self.level
    }

    fn reset(&mut self) {
        self.active = false;
        self.phase = 0.0;
        self.body_env = 0.0;
        self.noise_env = 0.0;
        self.bp.reset();
    }

    fn is_active(&self) -> bool {
        self.active
    }
}

// ---- HiHat ----

/// HiHat: metallic noise (highpass 8kHz + bandpass ~10kHz). Closed = short, Open = long.
pub struct HiHat {
    sample_rate: f32,
    active: bool,
    velocity: f32,
    level: f32,
    /// Whether this is an open hihat (longer decay).
    open: bool,
    /// Amplitude envelope.
    amp_env: f32,
    amp_decay: f32,
    /// Default decay time in seconds.
    default_decay_time: f32,
    hp: Highpass,
    bp: Bandpass,
    rng: Rng,
    tune: f32,
    decay_mult: f32,
}

impl HiHat {
    pub fn new(sample_rate: f32, open: bool) -> Self {
        let decay_time = if open { 0.2 } else { 0.03 };
        let mut hp = Highpass::new();
        hp.set_params(8000.0, 0.7, sample_rate);
        let mut bp = Bandpass::new();
        bp.set_params(10000.0, 2.0, sample_rate);
        Self {
            sample_rate,
            active: false,
            velocity: 0.0,
            level: 1.0,
            open,
            amp_env: 0.0,
            amp_decay: (-1.0 / (sample_rate * decay_time)).exp(),
            default_decay_time: decay_time,
            hp,
            bp,
            rng: Rng::new(if open { 999 } else { 777 }),
            tune: 0.0,
            decay_mult: 1.0,
        }
    }
}

impl DrumVoice for HiHat {
    fn trigger(&mut self, velocity: f32) {
        self.velocity = velocity;
        self.amp_env = 1.0;
        self.active = true;

        let decay_time = self.default_decay_time * self.decay_mult;
        self.amp_decay = (-1.0 / (self.sample_rate * decay_time)).exp();

        let ratio = 2.0f32.powf(self.tune / 12.0);
        self.hp.set_params(8000.0 * ratio, 0.7, self.sample_rate);
        self.bp.set_params(10000.0 * ratio, 2.0, self.sample_rate);
        self.hp.reset();
        self.bp.reset();
    }

    fn set_tune(&mut self, semitones: f32) {
        self.tune = semitones.clamp(-24.0, 24.0);
    }

    fn set_decay(&mut self, multiplier: f32) {
        self.decay_mult = multiplier.clamp(0.1, 2.0);
    }

    fn set_level(&mut self, level: f32) {
        self.level = level.clamp(0.0, 1.0);
    }

    fn process(&mut self) -> f32 {
        if !self.active {
            return 0.0;
        }

        let noise = self.rng.next_f32();
        let filtered = self.hp.process(noise);
        let shaped = self.bp.process(filtered);

        self.amp_env *= self.amp_decay;

        if self.amp_env < 0.0001 {
            self.active = false;
        }

        shaped * self.amp_env * self.velocity * self.level
    }

    fn reset(&mut self) {
        self.active = false;
        self.amp_env = 0.0;
        self.hp.reset();
        self.bp.reset();
    }

    fn is_active(&self) -> bool {
        self.active
    }
}

// ---- Clap ----

/// Clap: multiple noise bursts (3-4 micro-triggers ~5ms apart) through bandpass ~1.5kHz.
pub struct Clap {
    sample_rate: f32,
    active: bool,
    velocity: f32,
    level: f32,
    /// Elapsed samples since trigger.
    elapsed: f32,
    /// Burst envelope (re-triggered for each micro-burst).
    burst_env: f32,
    burst_decay: f32,
    /// Overall tail envelope.
    tail_env: f32,
    tail_decay: f32,
    /// Number of micro-bursts.
    num_bursts: usize,
    /// Spacing between bursts in samples.
    burst_spacing: f32,
    bp: Bandpass,
    rng: Rng,
    tune: f32,
    decay_mult: f32,
    /// Which burst we're on.
    burst_idx: usize,
    /// Sample counter for next burst trigger.
    next_burst_at: f32,
}

impl Clap {
    pub fn new(sample_rate: f32) -> Self {
        let mut bp = Bandpass::new();
        bp.set_params(1500.0, 2.0, sample_rate);
        Self {
            sample_rate,
            active: false,
            velocity: 0.0,
            level: 1.0,
            elapsed: 0.0,
            burst_env: 0.0,
            burst_decay: (-1.0 / (sample_rate * 0.005)).exp(),
            tail_env: 0.0,
            tail_decay: (-1.0 / (sample_rate * 0.15)).exp(),
            num_bursts: 4,
            burst_spacing: sample_rate * 0.005, // 5ms
            bp,
            rng: Rng::new(555),
            tune: 0.0,
            decay_mult: 1.0,
            burst_idx: 0,
            next_burst_at: 0.0,
        }
    }
}

impl DrumVoice for Clap {
    fn trigger(&mut self, velocity: f32) {
        self.velocity = velocity;
        self.elapsed = 0.0;
        self.burst_env = 1.0;
        self.tail_env = 1.0;
        self.active = true;
        self.burst_idx = 0;
        self.next_burst_at = self.burst_spacing;

        let ratio = 2.0f32.powf(self.tune / 12.0);
        self.bp.set_params(1500.0 * ratio, 2.0, self.sample_rate);
        self.bp.reset();

        self.burst_decay = (-1.0 / (self.sample_rate * 0.005)).exp();
        self.tail_decay = (-1.0 / (self.sample_rate * 0.15 * self.decay_mult)).exp();
    }

    fn set_tune(&mut self, semitones: f32) {
        self.tune = semitones.clamp(-24.0, 24.0);
    }

    fn set_decay(&mut self, multiplier: f32) {
        self.decay_mult = multiplier.clamp(0.1, 2.0);
    }

    fn set_level(&mut self, level: f32) {
        self.level = level.clamp(0.0, 1.0);
    }

    fn process(&mut self) -> f32 {
        if !self.active {
            return 0.0;
        }

        // Check if we need to re-trigger a burst
        if self.burst_idx < self.num_bursts && self.elapsed >= self.next_burst_at {
            self.burst_env = 1.0;
            self.burst_idx += 1;
            self.next_burst_at += self.burst_spacing;
        }

        let noise = self.rng.next_f32();
        let filtered = self.bp.process(noise);

        self.burst_env *= self.burst_decay;
        self.tail_env *= self.tail_decay;
        self.elapsed += 1.0;

        // Use the max of burst envelope and tail envelope
        let env = self.burst_env.max(self.tail_env * 0.4);

        if self.tail_env < 0.0001 && self.burst_env < 0.0001 {
            self.active = false;
        }

        filtered * env * self.velocity * self.level
    }

    fn reset(&mut self) {
        self.active = false;
        self.elapsed = 0.0;
        self.burst_env = 0.0;
        self.tail_env = 0.0;
        self.burst_idx = 0;
        self.bp.reset();
    }

    fn is_active(&self) -> bool {
        self.active
    }
}

// ---- Tom ----

/// Tom: sine pitch sweep (~300Hz -> ~120Hz, medium decay).
pub struct Tom {
    sample_rate: f32,
    active: bool,
    velocity: f32,
    level: f32,
    phase: f32,
    freq: f32,
    freq_start: f32,
    freq_end: f32,
    sweep_samples: f32,
    amp_env: f32,
    amp_decay: f32,
    elapsed: f32,
    tune: f32,
    decay_mult: f32,
}

impl Tom {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            active: false,
            velocity: 0.0,
            level: 1.0,
            phase: 0.0,
            freq: 300.0,
            freq_start: 300.0,
            freq_end: 120.0,
            sweep_samples: sample_rate * 0.06,
            amp_env: 0.0,
            amp_decay: (-1.0 / (sample_rate * 0.25)).exp(),
            elapsed: 0.0,
            tune: 0.0,
            decay_mult: 1.0,
        }
    }
}

impl DrumVoice for Tom {
    fn trigger(&mut self, velocity: f32) {
        self.velocity = velocity;
        self.phase = 0.0;
        self.elapsed = 0.0;
        self.amp_env = 1.0;
        self.active = true;

        let ratio = 2.0f32.powf(self.tune / 12.0);
        self.freq_start = 300.0 * ratio;
        self.freq_end = 120.0 * ratio;
        self.amp_decay = (-1.0 / (self.sample_rate * 0.25 * self.decay_mult)).exp();
        self.sweep_samples = self.sample_rate * 0.06 * self.decay_mult.max(0.5);
    }

    fn set_tune(&mut self, semitones: f32) {
        self.tune = semitones.clamp(-24.0, 24.0);
    }

    fn set_decay(&mut self, multiplier: f32) {
        self.decay_mult = multiplier.clamp(0.1, 2.0);
    }

    fn set_level(&mut self, level: f32) {
        self.level = level.clamp(0.0, 1.0);
    }

    fn process(&mut self) -> f32 {
        if !self.active {
            return 0.0;
        }

        let sweep_t = (self.elapsed / self.sweep_samples).min(1.0);
        self.freq = self.freq_start * (self.freq_end / self.freq_start).powf(sweep_t);

        let sine = (self.phase * std::f32::consts::TAU).sin();
        self.phase += self.freq / self.sample_rate;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }

        self.amp_env *= self.amp_decay;
        self.elapsed += 1.0;

        if self.amp_env < 0.0001 {
            self.active = false;
        }

        sine * self.amp_env * self.velocity * self.level
    }

    fn reset(&mut self) {
        self.active = false;
        self.phase = 0.0;
        self.elapsed = 0.0;
        self.amp_env = 0.0;
    }

    fn is_active(&self) -> bool {
        self.active
    }
}

// ---- Rim ----

/// Rim shot: short triangle wave click (~800Hz, very fast decay ~10ms).
pub struct Rim {
    sample_rate: f32,
    active: bool,
    velocity: f32,
    level: f32,
    phase: f32,
    freq: f32,
    amp_env: f32,
    amp_decay: f32,
    tune: f32,
    decay_mult: f32,
}

impl Rim {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            active: false,
            velocity: 0.0,
            level: 1.0,
            phase: 0.0,
            freq: 800.0,
            amp_env: 0.0,
            amp_decay: (-1.0 / (sample_rate * 0.01)).exp(),
            tune: 0.0,
            decay_mult: 1.0,
        }
    }
}

impl DrumVoice for Rim {
    fn trigger(&mut self, velocity: f32) {
        self.velocity = velocity;
        self.phase = 0.0;
        self.amp_env = 1.0;
        self.active = true;

        let ratio = 2.0f32.powf(self.tune / 12.0);
        self.freq = 800.0 * ratio;
        self.amp_decay = (-1.0 / (self.sample_rate * 0.01 * self.decay_mult)).exp();
    }

    fn set_tune(&mut self, semitones: f32) {
        self.tune = semitones.clamp(-24.0, 24.0);
    }

    fn set_decay(&mut self, multiplier: f32) {
        self.decay_mult = multiplier.clamp(0.1, 2.0);
    }

    fn set_level(&mut self, level: f32) {
        self.level = level.clamp(0.0, 1.0);
    }

    fn process(&mut self) -> f32 {
        if !self.active {
            return 0.0;
        }

        // Triangle wave: 4 * |phase - 0.5| - 1
        let tri = 4.0 * (self.phase - 0.5).abs() - 1.0;
        self.phase += self.freq / self.sample_rate;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }

        self.amp_env *= self.amp_decay;

        if self.amp_env < 0.0001 {
            self.active = false;
        }

        tri * self.amp_env * self.velocity * self.level
    }

    fn reset(&mut self) {
        self.active = false;
        self.phase = 0.0;
        self.amp_env = 0.0;
    }

    fn is_active(&self) -> bool {
        self.active
    }
}

// ---- Percussion (Cowbell-like) ----

/// Percussion: two detuned sines with fast decay (cowbell-like metallic hit).
pub struct Percussion {
    sample_rate: f32,
    active: bool,
    velocity: f32,
    level: f32,
    phase1: f32,
    phase2: f32,
    freq1: f32,
    freq2: f32,
    amp_env: f32,
    amp_decay: f32,
    tune: f32,
    decay_mult: f32,
}

impl Percussion {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            active: false,
            velocity: 0.0,
            level: 1.0,
            phase1: 0.0,
            phase2: 0.0,
            freq1: 587.0,  // ~D5
            freq2: 845.0,  // Non-harmonic ratio for metallic timbre
            amp_env: 0.0,
            amp_decay: (-1.0 / (sample_rate * 0.08)).exp(),
            tune: 0.0,
            decay_mult: 1.0,
        }
    }
}

impl DrumVoice for Percussion {
    fn trigger(&mut self, velocity: f32) {
        self.velocity = velocity;
        self.phase1 = 0.0;
        self.phase2 = 0.0;
        self.amp_env = 1.0;
        self.active = true;

        let ratio = 2.0f32.powf(self.tune / 12.0);
        self.freq1 = 587.0 * ratio;
        self.freq2 = 845.0 * ratio;
        self.amp_decay = (-1.0 / (self.sample_rate * 0.08 * self.decay_mult)).exp();
    }

    fn set_tune(&mut self, semitones: f32) {
        self.tune = semitones.clamp(-24.0, 24.0);
    }

    fn set_decay(&mut self, multiplier: f32) {
        self.decay_mult = multiplier.clamp(0.1, 2.0);
    }

    fn set_level(&mut self, level: f32) {
        self.level = level.clamp(0.0, 1.0);
    }

    fn process(&mut self) -> f32 {
        if !self.active {
            return 0.0;
        }

        let sin1 = (self.phase1 * std::f32::consts::TAU).sin();
        let sin2 = (self.phase2 * std::f32::consts::TAU).sin();

        self.phase1 += self.freq1 / self.sample_rate;
        if self.phase1 >= 1.0 {
            self.phase1 -= 1.0;
        }
        self.phase2 += self.freq2 / self.sample_rate;
        if self.phase2 >= 1.0 {
            self.phase2 -= 1.0;
        }

        self.amp_env *= self.amp_decay;

        if self.amp_env < 0.0001 {
            self.active = false;
        }

        (sin1 + sin2) * 0.5 * self.amp_env * self.velocity * self.level
    }

    fn reset(&mut self) {
        self.active = false;
        self.phase1 = 0.0;
        self.phase2 = 0.0;
        self.amp_env = 0.0;
    }

    fn is_active(&self) -> bool {
        self.active
    }
}

// ---------------------------------------------------------------------------
// DrumKit — holds all 8 voices, routes MIDI, mixes output
// ---------------------------------------------------------------------------

/// MIDI note assignments for drum voices.
pub const MIDI_KICK: u8 = 36;        // C1
pub const MIDI_RIM: u8 = 37;         // C#1
pub const MIDI_SNARE: u8 = 38;       // D1
pub const MIDI_CLAP: u8 = 39;        // D#1
pub const MIDI_HIHAT_CLOSED: u8 = 42; // F#1
pub const MIDI_PERCUSSION: u8 = 44;   // G#1
pub const MIDI_HIHAT_OPEN: u8 = 46;   // A#1
pub const MIDI_TOM: u8 = 48;         // C2

/// The highest MIDI note routed to the drum kit.
/// Notes above this go to the synth engine.
pub const DRUM_NOTE_MAX: u8 = MIDI_TOM;

/// Complete drum kit with 8 synthesized voices.
pub struct DrumKit {
    pub kick: Kick,
    pub snare: Snare,
    pub hihat_closed: HiHat,
    pub hihat_open: HiHat,
    pub clap: Clap,
    pub tom: Tom,
    pub rim: Rim,
    pub percussion: Percussion,
}

impl DrumKit {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            kick: Kick::new(sample_rate),
            snare: Snare::new(sample_rate),
            hihat_closed: HiHat::new(sample_rate, false),
            hihat_open: HiHat::new(sample_rate, true),
            clap: Clap::new(sample_rate),
            tom: Tom::new(sample_rate),
            rim: Rim::new(sample_rate),
            percussion: Percussion::new(sample_rate),
        }
    }

    /// Set sample rate on all drum voices (call from plugin initialize).
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        // Recreate voices with new sample rate
        self.kick = Kick::new(sample_rate);
        self.snare = Snare::new(sample_rate);
        self.hihat_closed = HiHat::new(sample_rate, false);
        self.hihat_open = HiHat::new(sample_rate, true);
        self.clap = Clap::new(sample_rate);
        self.tom = Tom::new(sample_rate);
        self.rim = Rim::new(sample_rate);
        self.percussion = Percussion::new(sample_rate);
    }

    /// Set global tune offset for all drum voices (in semitones).
    pub fn set_tune(&mut self, semitones: f32) {
        self.kick.set_tune(semitones);
        self.snare.set_tune(semitones);
        self.hihat_closed.set_tune(semitones);
        self.hihat_open.set_tune(semitones);
        self.clap.set_tune(semitones);
        self.tom.set_tune(semitones);
        self.rim.set_tune(semitones);
        self.percussion.set_tune(semitones);
    }

    /// Set global decay multiplier for all drum voices.
    pub fn set_decay(&mut self, multiplier: f32) {
        self.kick.set_decay(multiplier);
        self.snare.set_decay(multiplier);
        self.hihat_closed.set_decay(multiplier);
        self.hihat_open.set_decay(multiplier);
        self.clap.set_decay(multiplier);
        self.tom.set_decay(multiplier);
        self.rim.set_decay(multiplier);
        self.percussion.set_decay(multiplier);
    }

    /// Trigger a drum voice by MIDI note number with velocity (0.0-1.0).
    /// Returns true if the note was handled by the drum kit.
    pub fn note_on(&mut self, note: u8, velocity: f32) -> bool {
        match note {
            MIDI_KICK => {
                self.kick.trigger(velocity);
                true
            }
            MIDI_SNARE => {
                self.snare.trigger(velocity);
                true
            }
            MIDI_HIHAT_CLOSED => {
                // Close chokes open hihat
                self.hihat_open.reset();
                self.hihat_closed.trigger(velocity);
                true
            }
            MIDI_HIHAT_OPEN => {
                // Open chokes closed hihat
                self.hihat_closed.reset();
                self.hihat_open.trigger(velocity);
                true
            }
            MIDI_CLAP => {
                self.clap.trigger(velocity);
                true
            }
            MIDI_TOM => {
                self.tom.trigger(velocity);
                true
            }
            MIDI_RIM => {
                self.rim.trigger(velocity);
                true
            }
            MIDI_PERCUSSION => {
                self.percussion.trigger(velocity);
                true
            }
            _ => false,
        }
    }

    /// Process one sample: mix all active drum voices into a single mono f32.
    pub fn process(&mut self) -> f32 {
        let mut out = 0.0f32;
        out += self.kick.process();
        out += self.snare.process();
        out += self.hihat_closed.process();
        out += self.hihat_open.process();
        out += self.clap.process();
        out += self.tom.process();
        out += self.rim.process();
        out += self.percussion.process();
        out
    }

    /// Reset all drum voices.
    pub fn reset(&mut self) {
        self.kick.reset();
        self.snare.reset();
        self.hihat_closed.reset();
        self.hihat_open.reset();
        self.clap.reset();
        self.tom.reset();
        self.rim.reset();
        self.percussion.reset();
    }
}
