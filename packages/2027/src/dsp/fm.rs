//! Through-zero FM oscillator with 4 operators and free-routing matrix.
//!
//! Each operator is a sine oscillator with configurable frequency ratio,
//! detune, feedback, and output level. Any operator can modulate any other
//! operator's phase via a 4x4 modulation depth matrix.
//!
//! True through-zero FM: modulation is integrated into a *signed* phase
//! accumulator wrapped symmetrically in [-0.5, 0.5). When the instantaneous
//! phase increment (base + modulator + feedback) goes negative, the
//! accumulator moves backward — the oscillator literally plays through zero.
//! This is the distinguishing property versus classic Chowning PM, whose
//! accumulator is strictly monotonic and whose modulation only appears as
//! a phase offset at the output. Under TZFM, the long-term phase integral
//! depends on modulator history, producing spectra that reflect cleanly
//! around DC without the asymmetry of one-sided FM.

use std::f32::consts::{PI, TAU};

/// Number of FM operators.
pub const NUM_OPERATORS: usize = 4;

/// A single FM operator (sine oscillator with feedback).
struct Operator {
    /// Signed phase accumulator in [-0.5, 0.5). Signed so the oscillator
    /// can reverse through zero when modulation drives the instantaneous
    /// increment negative.
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

    /// Advance phase and compute output using true TZFM.
    ///
    /// - `base_phase_inc`: base phase increment per sample, cycles/sample
    ///   (freq_ratio * base_freq / sample_rate). Always positive.
    /// - `phase_mod`: total modulation signal from other operators, radians
    ///   (PM-compatible unit). Converted here to frequency-domain contribution
    ///   by /TAU so it integrates into the phase accumulator.
    /// - `feedback`: self-feedback amount in [0.0, 1.0]. Scaled to ±0.5
    ///   cycles/sample max — the Nyquist cap for a stable feedback oscillator.
    ///
    /// Returns the operator output in [-1, 1].
    #[inline]
    fn tick(&mut self, base_phase_inc: f32, phase_mod: f32, feedback: f32) -> f32 {
        // Self-feedback contributes to the instantaneous frequency.
        // Scale by PI/TAU = 0.5 so max |fb| matches the Nyquist bound.
        let fb = self.prev_output * feedback * (PI / TAU);

        // TZFM: integrate modulation + feedback into the phase accumulator.
        // phase_mod is in radians; /TAU converts to cycles/sample to match
        // base_phase_inc units. When this sum goes negative, the accumulator
        // moves backward — the defining through-zero behavior.
        let phase_inc = base_phase_inc + phase_mod / TAU + fb;
        self.phase += phase_inc;

        // Symmetric wrap to [-0.5, 0.5). Unlike a [0, 1) floor-wrap, round-wrap
        // preserves the direction of travel across the zero crossing — a forward
        // step at phase=0.49 and a backward step at phase=-0.49 both stay near
        // zero rather than teleporting to the opposite end of the interval.
        self.phase -= self.phase.round();

        let output = (self.phase * TAU).sin();

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
