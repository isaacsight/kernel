//! Low-frequency oscillators (LFOs) with multiple waveform shapes.
//!
//! Supports sine, triangle, saw, square, sample-and-hold (random),
//! and a chaotic Lorenz attractor shape. Can operate from sub-audio
//! rates (0.01 Hz) up to audio rate (100 Hz) for vibrato, tremolo,
//! and FM-like effects.

use std::f32::consts::TAU;

/// Number of LFOs available.
pub const NUM_LFOS: usize = 4;

/// LFO waveform shapes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LfoShape {
    Sine,
    Triangle,
    Saw,
    Square,
    /// Sample and hold: random value at each cycle reset.
    SampleAndHold,
    /// Lorenz attractor: deterministic chaos. Produces smooth but
    /// unpredictable modulation.
    Chaos,
}

/// Trigger mode for the LFO.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LfoTriggerMode {
    /// LFO runs continuously, ignoring note events.
    FreeRunning,
    /// LFO resets phase to 0 on each note-on.
    KeyTriggered,
}

/// A single LFO.
pub struct Lfo {
    /// Current phase in [0, 1).
    phase: f32,
    /// Waveform shape.
    pub shape: LfoShape,
    /// Rate in Hz (0.01 to 100).
    pub rate: f32,
    /// Trigger mode.
    pub trigger_mode: LfoTriggerMode,
    /// Whether to sync to host tempo (BPM-locked rates).
    pub tempo_sync: bool,
    /// Host tempo in BPM (set externally).
    host_bpm: f32,
    /// Sample rate.
    sample_rate: f32,
    /// Current output value [-1, 1].
    output: f32,
    /// Sample-and-hold: stored random value.
    sah_value: f32,
    /// Previous phase (for detecting zero-crossings in S&H).
    prev_phase: f32,
    /// Simple PRNG state for S&H.
    rng_state: u32,
    /// Lorenz attractor state (x, y, z).
    lorenz: [f32; 3],
}

impl Lfo {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            phase: 0.0,
            shape: LfoShape::Sine,
            rate: 1.0,
            trigger_mode: LfoTriggerMode::FreeRunning,
            tempo_sync: false,
            host_bpm: 120.0,
            sample_rate,
            output: 0.0,
            sah_value: 0.0,
            prev_phase: 0.0,
            rng_state: 0xDEADBEEF,
            lorenz: [0.1, 0.0, 0.0],
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate;
    }

    pub fn set_host_bpm(&mut self, bpm: f32) {
        self.host_bpm = bpm.max(20.0);
    }

    /// Reset phase to 0. Called on note-on if key-triggered.
    pub fn reset(&mut self) {
        self.phase = 0.0;
        self.prev_phase = 0.0;
        self.lorenz = [0.1, 0.0, 0.0];
    }

    /// Trigger: reset phase if in KeyTriggered mode.
    pub fn note_on(&mut self) {
        if self.trigger_mode == LfoTriggerMode::KeyTriggered {
            self.reset();
        }
    }

    /// Simple xorshift32 PRNG. Returns a value in [-1, 1].
    #[inline]
    fn rand_bipolar(&mut self) -> f32 {
        let mut x = self.rng_state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng_state = x;
        (x as f32 / (u32::MAX as f32)) * 2.0 - 1.0
    }

    /// Compute the effective rate in Hz, accounting for tempo sync.
    #[inline]
    fn effective_rate(&self) -> f32 {
        if self.tempo_sync {
            // In tempo sync mode, `rate` is interpreted as a beat division.
            // rate = 1.0 → 1 cycle per beat → freq = bpm / 60
            // rate = 0.5 → 1 cycle per 2 beats → freq = bpm / 120
            // rate = 2.0 → 2 cycles per beat → freq = bpm / 30
            (self.host_bpm / 60.0) * self.rate
        } else {
            self.rate
        }
    }

    /// Process one sample. Returns the LFO output in [-1, +1].
    #[inline]
    pub fn process(&mut self) -> f32 {
        if self.shape == LfoShape::Chaos {
            return self.process_lorenz();
        }

        let rate = self.effective_rate().clamp(0.001, self.sample_rate * 0.49);
        let phase_inc = rate / self.sample_rate;

        self.prev_phase = self.phase;
        self.phase += phase_inc;

        // Detect phase wrap for sample-and-hold.
        if self.phase >= 1.0 {
            self.phase -= 1.0;
            if self.shape == LfoShape::SampleAndHold {
                self.sah_value = self.rand_bipolar();
            }
        }

        self.output = match self.shape {
            LfoShape::Sine => (self.phase * TAU).sin(),
            LfoShape::Triangle => {
                // Triangle: ramps up 0→1 in first half, down 1→0 in second half.
                // Bipolar: map [0,1] → [-1,+1].
                let tri = if self.phase < 0.5 {
                    self.phase * 4.0 - 1.0
                } else {
                    3.0 - self.phase * 4.0
                };
                tri
            }
            LfoShape::Saw => {
                // Saw: ramps from -1 to +1 over one cycle.
                2.0 * self.phase - 1.0
            }
            LfoShape::Square => {
                if self.phase < 0.5 {
                    1.0
                } else {
                    -1.0
                }
            }
            LfoShape::SampleAndHold => self.sah_value,
            LfoShape::Chaos => unreachable!(), // Handled above.
        };

        self.output
    }

    /// Lorenz attractor for chaotic modulation.
    /// We integrate the Lorenz system and normalize the x output to [-1, +1].
    #[inline]
    fn process_lorenz(&mut self) -> f32 {
        // Lorenz parameters (classic chaotic regime).
        let sigma = 10.0;
        let rho = 28.0;
        let beta = 8.0 / 3.0;

        // Integration step size scaled by rate.
        // At rate=1Hz, we want moderate chaos speed; scale dt accordingly.
        let rate = self.rate.clamp(0.01, 100.0);
        let dt = rate * 0.0005; // Tuned for musical speeds.

        let [x, y, z] = self.lorenz;

        // Lorenz equations.
        let dx = sigma * (y - x);
        let dy = x * (rho - z) - y;
        let dz = x * y - beta * z;

        self.lorenz[0] = x + dx * dt;
        self.lorenz[1] = y + dy * dt;
        self.lorenz[2] = z + dz * dt;

        // Normalize x to roughly [-1, +1].
        // The Lorenz x variable oscillates roughly in [-20, 20].
        self.output = (self.lorenz[0] / 20.0).clamp(-1.0, 1.0);
        self.output
    }

    /// Get the current output without advancing.
    pub fn value(&self) -> f32 {
        self.output
    }
}

/// Bank of 4 LFOs.
pub struct LfoBank {
    pub lfos: [Lfo; NUM_LFOS],
}

impl LfoBank {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            lfos: [
                Lfo::new(sample_rate),
                Lfo::new(sample_rate),
                Lfo::new(sample_rate),
                Lfo::new(sample_rate),
            ],
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        for lfo in &mut self.lfos {
            lfo.set_sample_rate(sample_rate);
        }
    }

    pub fn set_host_bpm(&mut self, bpm: f32) {
        for lfo in &mut self.lfos {
            lfo.set_host_bpm(bpm);
        }
    }

    /// Trigger note-on on all LFOs (resets key-triggered ones).
    pub fn note_on(&mut self) {
        for lfo in &mut self.lfos {
            lfo.note_on();
        }
    }

    /// Process all 4 LFOs and return their outputs.
    #[inline]
    pub fn process(&mut self) -> [f32; NUM_LFOS] {
        [
            self.lfos[0].process(),
            self.lfos[1].process(),
            self.lfos[2].process(),
            self.lfos[3].process(),
        ]
    }

    pub fn reset(&mut self) {
        for lfo in &mut self.lfos {
            lfo.reset();
        }
    }
}
