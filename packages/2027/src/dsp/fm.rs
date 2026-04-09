//! Through-zero FM oscillator with 4 operators and free-routing matrix.
//!
//! Each operator is a sine oscillator with configurable frequency ratio,
//! detune, feedback, and output level. Any operator can modulate any other
//! operator's phase via a 4x4 modulation depth matrix.
//!
//! Through-zero FM means the modulation signal is bipolar — it can push
//! the instantaneous frequency negative, which produces the characteristic
//! "DX" timbres without the asymmetric spectrum of one-sided FM.

use std::f32::consts::{PI, TAU};

/// Number of FM operators.
pub const NUM_OPERATORS: usize = 4;

/// A single FM operator (sine oscillator with feedback).
struct Operator {
    /// Current phase accumulator in [0, 1).
    phase: f32,
    /// Previous output sample, used for feedback.
    prev_output: f32,
}

impl Operator {
    fn new() -> Self {
        Self {
            phase: 0.0,
            prev_output: 0.0,
        }
    }

    /// Advance phase and compute output.
    ///
    /// - `base_phase_inc`: the base phase increment (freq_ratio * base_freq / sample_rate)
    /// - `phase_mod`: total phase modulation from other operators (radians, bipolar)
    /// - `feedback`: self-feedback amount (0.0 = none, 1.0 = full)
    ///
    /// Returns the operator output in [-1, 1].
    #[inline]
    fn tick(&mut self, base_phase_inc: f32, phase_mod: f32, feedback: f32) -> f32 {
        // Self-feedback: mix previous output into phase modulation.
        // Attenuate feedback to keep it stable (pi is the stability limit for
        // a sine oscillator with feedback; we scale to stay well within it).
        let fb_mod = self.prev_output * feedback * PI;

        // Compute instantaneous phase including modulation.
        // Through-zero: phase_mod is bipolar, so negative modulation
        // reverses the phase direction momentarily.
        let total_phase = self.phase * TAU + phase_mod + fb_mod;
        let output = total_phase.sin();

        // Advance phase (through-zero: base_phase_inc can effectively go negative
        // via the modulation, but we keep the accumulator positive).
        self.phase += base_phase_inc;
        // Wrap phase to [0, 1) to prevent floating-point drift.
        self.phase -= self.phase.floor();

        // Low-pass the feedback path slightly to prevent runaway high frequencies.
        // Simple one-pole: y = 0.5 * (current + previous)
        self.prev_output = 0.5 * (output + self.prev_output);

        output
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.prev_output = 0.0;
    }
}

/// Parameters for a single FM operator.
#[derive(Clone, Copy)]
pub struct OperatorParams {
    /// Frequency ratio relative to the base frequency (e.g. 1.0, 2.0, 0.5).
    pub ratio: f32,
    /// Detune in cents (-100 to +100).
    pub detune_cents: f32,
    /// Self-feedback amount (0.0 to 1.0).
    pub feedback: f32,
    /// Output level (0.0 to 1.0). Controls how much this operator
    /// contributes to the final mix (carrier level).
    pub output_level: f32,
}

impl Default for OperatorParams {
    fn default() -> Self {
        Self {
            ratio: 1.0,
            detune_cents: 0.0,
            feedback: 0.0,
            output_level: 0.0,
        }
    }
}

/// 4-operator FM synthesizer with free-routing modulation matrix.
pub struct FmOscillator {
    /// The 4 operators.
    operators: [Operator; NUM_OPERATORS],
    /// Per-operator parameters.
    pub params: [OperatorParams; NUM_OPERATORS],
    /// 4x4 modulation depth matrix.
    /// `mod_matrix[src][dst]` = how much operator `src` modulates operator `dst`'s phase.
    /// Values are in radians of phase deviation. Typical range: 0.0 to ~10.0.
    pub mod_matrix: [[f32; NUM_OPERATORS]; NUM_OPERATORS],
    /// Cached operator outputs from the previous tick (used to compute modulation
    /// without order-dependency within a single sample).
    prev_outputs: [f32; NUM_OPERATORS],
    /// Sample rate.
    sample_rate: f32,
}

impl FmOscillator {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            operators: [
                Operator::new(),
                Operator::new(),
                Operator::new(),
                Operator::new(),
            ],
            params: [
                // Op 1: carrier at fundamental, full output
                OperatorParams {
                    ratio: 1.0,
                    output_level: 1.0,
                    ..Default::default()
                },
                // Op 2: modulator at 2x, no output (modulates op 1)
                OperatorParams {
                    ratio: 2.0,
                    output_level: 0.0,
                    ..Default::default()
                },
                // Op 3-4: inactive by default
                OperatorParams::default(),
                OperatorParams::default(),
            ],
            mod_matrix: [[0.0; NUM_OPERATORS]; NUM_OPERATORS],
            prev_outputs: [0.0; NUM_OPERATORS],
            sample_rate,
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate;
    }

    pub fn reset(&mut self) {
        for op in &mut self.operators {
            op.reset();
        }
        self.prev_outputs = [0.0; NUM_OPERATORS];
    }

    /// Set a quick algorithm preset. Common DX-style configurations:
    /// - 0: Op2 → Op1 (simple 2-op FM)
    /// - 1: Op3 → Op2 → Op1 (3-op chain)
    /// - 2: Op4 → Op3 → Op2 → Op1 (4-op chain)
    /// - 3: (Op2 + Op3) → Op1 (two modulators into one carrier)
    /// - 4: Op2 → Op1, Op4 → Op3, both output (two parallel 2-op pairs)
    pub fn set_algorithm(&mut self, algo: u8, depth: f32) {
        // Clear the matrix first
        self.mod_matrix = [[0.0; NUM_OPERATORS]; NUM_OPERATORS];

        // Reset output levels
        for p in &mut self.params {
            p.output_level = 0.0;
        }

        match algo {
            0 => {
                // Op2 → Op1 (carrier)
                self.mod_matrix[1][0] = depth;
                self.params[0].output_level = 1.0;
            }
            1 => {
                // Op3 → Op2 → Op1
                self.mod_matrix[2][1] = depth;
                self.mod_matrix[1][0] = depth;
                self.params[0].output_level = 1.0;
            }
            2 => {
                // Op4 → Op3 → Op2 → Op1
                self.mod_matrix[3][2] = depth;
                self.mod_matrix[2][1] = depth;
                self.mod_matrix[1][0] = depth;
                self.params[0].output_level = 1.0;
            }
            3 => {
                // (Op2 + Op3) → Op1
                self.mod_matrix[1][0] = depth;
                self.mod_matrix[2][0] = depth;
                self.params[0].output_level = 1.0;
            }
            4 => {
                // Op2 → Op1, Op4 → Op3, both carriers output
                self.mod_matrix[1][0] = depth;
                self.mod_matrix[3][2] = depth;
                self.params[0].output_level = 1.0;
                self.params[2].output_level = 1.0;
            }
            _ => {
                // Default: all carriers, no modulation
                self.params[0].output_level = 1.0;
            }
        }
    }

    /// Process one sample.
    ///
    /// - `base_freq`: the fundamental frequency in Hz (from MIDI note)
    ///
    /// Returns the mixed output of all operators weighted by their output levels.
    #[inline]
    pub fn process(&mut self, base_freq: f32) -> f32 {
        let mut new_outputs = [0.0f32; NUM_OPERATORS];

        for dst in 0..NUM_OPERATORS {
            let p = &self.params[dst];

            // Compute the operator's actual frequency: base * ratio * detune
            let detune_factor = 2.0f32.powf(p.detune_cents / 1200.0);
            let freq = base_freq * p.ratio * detune_factor;
            let phase_inc = freq / self.sample_rate;

            // Sum phase modulation from all sources (using previous tick's outputs
            // to avoid order-dependency).
            let mut phase_mod = 0.0f32;
            for src in 0..NUM_OPERATORS {
                let depth = self.mod_matrix[src][dst];
                if depth != 0.0 {
                    phase_mod += self.prev_outputs[src] * depth;
                }
            }

            // Tick the operator
            new_outputs[dst] = self.operators[dst].tick(phase_inc, phase_mod, p.feedback);
        }

        // Store outputs for next tick's modulation computation.
        self.prev_outputs = new_outputs;

        // Mix carriers: sum operator outputs weighted by their output levels.
        let mut mix = 0.0f32;
        for i in 0..NUM_OPERATORS {
            mix += new_outputs[i] * self.params[i].output_level;
        }

        mix
    }
}
