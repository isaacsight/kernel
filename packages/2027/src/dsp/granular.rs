//! Granular synthesis engine.
//!
//! Splits a source buffer into tiny grains, each windowed with a Hann function,
//! and overlap-adds them to produce the output. At low densities this creates
//! cloud-like textures; at audio-rate densities (>100 Hz) the grain rate
//! becomes the fundamental frequency, producing a pitched oscillator.

use std::f32::consts::PI;

/// Maximum source buffer length: 10 seconds at 44100 Hz.
pub const MAX_BUFFER_SAMPLES: usize = 44100 * 10;

/// Maximum simultaneous grains.
const MAX_GRAINS: usize = 128;

/// A single active grain.
struct Grain {
    /// Whether this grain slot is in use.
    active: bool,
    /// Start position in the source buffer (sample index, fractional).
    start_pos: f32,
    /// Current playback position within the grain (0 to grain_length).
    cursor: f32,
    /// Total length of this grain in samples.
    length: f32,
    /// Playback rate (1.0 = original pitch, 2.0 = octave up, etc.).
    rate: f32,
}

impl Grain {
    fn new() -> Self {
        Self {
            active: false,
            start_pos: 0.0,
            cursor: 0.0,
            length: 0.0,
            rate: 1.0,
        }
    }
}

/// Parameters controlling the granular engine.
#[derive(Clone, Copy)]
pub struct GranularParams {
    /// Position in the source buffer, normalized [0, 1].
    pub position: f32,
    /// Grain size in seconds (0.001 to 0.5).
    pub size: f32,
    /// Grain density in grains per second (1 to 500+).
    pub density: f32,
    /// Pitch shift in semitones (-24 to +24).
    pub pitch: f32,
    /// Random spread applied to grain start position [0, 1].
    /// 0 = all grains start at exactly `position`, 1 = full random scatter.
    pub spread: f32,
}

impl Default for GranularParams {
    fn default() -> Self {
        Self {
            position: 0.0,
            size: 0.05,     // 50ms
            density: 20.0,  // 20 grains/sec
            pitch: 0.0,     // no pitch shift
            spread: 0.1,    // slight random spread
        }
    }
}

/// Granular synthesis engine.
pub struct GranularEngine {
    /// Source audio buffer (mono).
    buffer: Vec<f32>,
    /// Length of valid data in the buffer.
    buffer_len: usize,
    /// Pool of grain slots.
    grains: Vec<Grain>,
    /// Sample rate.
    sample_rate: f32,
    /// Accumulator for grain triggering: counts up to (sample_rate / density),
    /// then spawns a new grain.
    trigger_phase: f32,
    /// Simple pseudo-random state for spread.
    rng_state: u32,
    /// Current parameters.
    pub params: GranularParams,
}

impl GranularEngine {
    pub fn new(sample_rate: f32) -> Self {
        let mut engine = Self {
            buffer: vec![0.0; MAX_BUFFER_SAMPLES],
            buffer_len: 0,
            grains: Vec::with_capacity(MAX_GRAINS),
            sample_rate,
            trigger_phase: 0.0,
            rng_state: 0x12345678,
            params: GranularParams::default(),
        };

        // Pre-allocate grain slots.
        for _ in 0..MAX_GRAINS {
            engine.grains.push(Grain::new());
        }

        // Fill default buffer with a single-cycle saw wave so it works out of the box.
        engine.init_default_buffer();

        engine
    }

    /// Fill the source buffer with a single-cycle sawtooth wave (2048 samples),
    /// repeated to fill a reasonable length for granular use.
    fn init_default_buffer(&mut self) {
        let cycle_len = 2048;
        for i in 0..cycle_len {
            let phase = i as f32 / cycle_len as f32;
            self.buffer[i] = 2.0 * phase - 1.0; // saw: -1 to +1
        }
        self.buffer_len = cycle_len;
    }

    /// Load a source buffer. Truncates to MAX_BUFFER_SAMPLES if needed.
    pub fn load_buffer(&mut self, data: &[f32]) {
        let len = data.len().min(MAX_BUFFER_SAMPLES);
        self.buffer[..len].copy_from_slice(&data[..len]);
        self.buffer_len = len;
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate;
    }

    pub fn reset(&mut self) {
        for grain in &mut self.grains {
            grain.active = false;
        }
        self.trigger_phase = 0.0;
    }

    /// Simple xorshift32 PRNG. Returns a value in [0, 1).
    #[inline]
    fn rand(&mut self) -> f32 {
        let mut x = self.rng_state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng_state = x;
        // Map to [0, 1)
        (x as f32) / (u32::MAX as f32)
    }

    /// Spawn a new grain.
    fn spawn_grain(&mut self) {
        if self.buffer_len == 0 {
            return;
        }

        // Find a free grain slot.
        let slot = match self.grains.iter().position(|g| !g.active) {
            Some(idx) => idx,
            None => return, // All slots full, skip this grain.
        };

        // Read params before mutable borrow for rand()
        let spread = self.params.spread;
        let position = self.params.position;
        let size = self.params.size;
        let pitch = self.params.pitch;

        // Compute grain start position with random spread.
        let spread_offset = (self.rand() - 0.5) * spread;
        let pos = (position + spread_offset).clamp(0.0, 1.0);
        let start_sample = pos * (self.buffer_len.saturating_sub(1)) as f32;

        // Grain length in samples.
        let grain_length = (size * self.sample_rate).max(1.0);

        // Playback rate from pitch shift (semitones).
        let rate = 2.0f32.powf(pitch / 12.0);

        let grain = &mut self.grains[slot];
        grain.active = true;
        grain.start_pos = start_sample;
        grain.cursor = 0.0;
        grain.length = grain_length;
        grain.rate = rate;
    }

    /// Hann window function. `t` is normalized position in [0, 1].
    #[inline]
    fn hann(t: f32) -> f32 {
        0.5 * (1.0 - (2.0 * PI * t).cos())
    }

    /// Read from the source buffer with linear interpolation and wrapping.
    #[inline]
    fn read_buffer(&self, pos: f32) -> f32 {
        if self.buffer_len == 0 {
            return 0.0;
        }

        // Wrap position into buffer range.
        let len = self.buffer_len as f32;
        let wrapped = ((pos % len) + len) % len;
        let idx = wrapped as usize;
        let frac = wrapped - idx as f32;
        let next_idx = (idx + 1) % self.buffer_len;

        self.buffer[idx] + (self.buffer[next_idx] - self.buffer[idx]) * frac
    }

    /// Process one sample. Call this per-sample in the audio loop.
    #[inline]
    pub fn process(&mut self) -> f32 {
        let density = self.params.density.max(0.1);

        // Trigger new grains based on density.
        // trigger_phase accumulates; when it reaches 1.0, spawn a grain.
        let trigger_inc = density / self.sample_rate;
        self.trigger_phase += trigger_inc;

        while self.trigger_phase >= 1.0 {
            self.trigger_phase -= 1.0;
            self.spawn_grain();
        }

        // Sum all active grains (overlap-add).
        let mut output = 0.0f32;

        // Borrow buffer data before mutably iterating grains
        let buf = &self.buffer;
        let buf_len = self.buffer_len;

        for grain in &mut self.grains {
            if !grain.active {
                continue;
            }

            // Normalized position within the grain [0, 1].
            let t = grain.cursor / grain.length;

            if t >= 1.0 {
                grain.active = false;
                continue;
            }

            // Hann window.
            let window = Self::hann(t);

            // Read from source buffer at the grain's current read position (inline).
            let read_pos = grain.start_pos + grain.cursor * grain.rate;
            let sample = if buf_len == 0 {
                0.0
            } else {
                let len = buf_len as f32;
                let wrapped = ((read_pos % len) + len) % len;
                let idx = wrapped as usize;
                let frac = wrapped - idx as f32;
                let next_idx = (idx + 1) % buf_len;
                buf[idx] + (buf[next_idx] - buf[idx]) * frac
            };

            output += sample * window;

            // Advance grain cursor.
            grain.cursor += 1.0;
        }

        // Normalize by a rough estimate of overlapping grains to prevent clipping.
        // At high densities, many grains overlap; the Hann window averages to 0.5,
        // so the expected overlap count is ~(density * grain_size).
        let expected_overlap = (density * self.params.size).max(1.0);
        output / expected_overlap.sqrt()
    }
}
