//! The agent brain: maps musical context to synthesis modulation parameters.
//!
//! Outputs AgentX and AgentY values (-1.0 to 1.0) that feed into the
//! synthesizer's modulation matrix. Different behavior modes create
//! different musical relationships between the input context and output.

use super::musical_context::MusicalContext;

/// Agent behavior mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentMode {
    /// Agent is inactive, outputs (0, 0).
    Off,
    /// Darker sound on minor chords, brighter on major.
    /// Lower energy = slower modulation, higher = faster.
    Follow,
    /// Opposite of Follow. Bright on dark sections, dark on bright.
    /// Creates musical tension.
    Contrast,
    /// Random walks influenced by energy. High energy = wider walks.
    Chaos,
    /// Slow sine-like oscillation tied to tempo. Musical breathing.
    Breathe,
}

/// Agent output: two modulation axes that connect to the mod matrix.
#[derive(Debug, Clone, Copy)]
pub struct AgentOutput {
    /// X-axis modulation (-1.0 to 1.0). Typically mapped to timbre/brightness.
    pub x: f32,
    /// Y-axis modulation (-1.0 to 1.0). Typically mapped to movement/depth.
    pub y: f32,
}

/// The agent brain.
///
/// Call [`process`] once per audio buffer with the current musical context.
/// The agent smoothly interpolates toward target values using slew rate limiting.
pub struct Agent {
    /// Current behavior mode.
    mode: AgentMode,
    /// User reactivity setting (0.0 to 1.0). Controls how much the agent affects sound.
    reactivity: f32,

    // --- Current output values (smoothed) ---
    current_x: f32,
    current_y: f32,

    // --- Target values (computed each buffer) ---
    target_x: f32,
    target_y: f32,

    // --- Slew rate (per-buffer interpolation coefficient) ---
    slew: f32,

    // --- Internal state for Chaos mode ---
    /// Pseudo-random state (xorshift32).
    rng_state: u32,
    /// Current chaos walk position X.
    chaos_x: f32,
    /// Current chaos walk position Y.
    chaos_y: f32,

    // --- Internal state for Breathe mode ---
    /// Phase accumulator for the breathing oscillator (0.0 to 1.0).
    breathe_phase: f32,

    // --- Config ---
    sample_rate: f32,
    buffer_size: usize,
}

impl Agent {
    /// Create a new agent.
    pub fn new(sample_rate: f32, buffer_size: usize) -> Self {
        Self {
            mode: AgentMode::Off,
            reactivity: 0.5,
            current_x: 0.0,
            current_y: 0.0,
            target_x: 0.0,
            target_y: 0.0,
            slew: Self::compute_slew(sample_rate, buffer_size),
            rng_state: 0xDEAD_BEEF,
            chaos_x: 0.0,
            chaos_y: 0.0,
            breathe_phase: 0.0,
            sample_rate,
            buffer_size,
        }
    }

    /// Compute the per-buffer slew coefficient (~50ms smoothing).
    fn compute_slew(sample_rate: f32, buffer_size: usize) -> f32 {
        let buffers_per_second = sample_rate / buffer_size.max(1) as f32;
        let tau_buffers = 0.05 * buffers_per_second; // 50ms time constant
        if tau_buffers < 1.0 {
            1.0
        } else {
            1.0 - (-1.0 / tau_buffers).exp()
        }
    }

    /// Update sample rate and buffer size.
    pub fn set_sample_rate(&mut self, sample_rate: f32, buffer_size: usize) {
        self.sample_rate = sample_rate;
        self.buffer_size = buffer_size;
        self.slew = Self::compute_slew(sample_rate, buffer_size);
    }

    /// Set the agent behavior mode.
    pub fn set_mode(&mut self, mode: AgentMode) {
        self.mode = mode;
    }

    /// Set the user reactivity (0.0 to 1.0).
    pub fn set_reactivity(&mut self, reactivity: f32) {
        self.reactivity = reactivity.clamp(0.0, 1.0);
    }

    /// Process one buffer of musical context and update outputs.
    ///
    /// Call this once per audio buffer after updating chord/scale/energy detectors.
    pub fn process(&mut self, ctx: &MusicalContext) {
        match self.mode {
            AgentMode::Off => {
                self.target_x = 0.0;
                self.target_y = 0.0;
            }
            AgentMode::Follow => self.process_follow(ctx),
            AgentMode::Contrast => self.process_contrast(ctx),
            AgentMode::Chaos => self.process_chaos(ctx),
            AgentMode::Breathe => self.process_breathe(ctx),
        }

        // Apply reactivity scaling to targets
        let rx = self.target_x * self.reactivity;
        let ry = self.target_y * self.reactivity;

        // Slew rate limiting: smoothly interpolate toward target
        self.current_x += (rx - self.current_x) * self.slew;
        self.current_y += (ry - self.current_y) * self.slew;

        // Clamp to valid range
        self.current_x = self.current_x.clamp(-1.0, 1.0);
        self.current_y = self.current_y.clamp(-1.0, 1.0);

        // Kill denormals
        if self.current_x.abs() < 1e-7 {
            self.current_x = 0.0;
        }
        if self.current_y.abs() < 1e-7 {
            self.current_y = 0.0;
        }
    }

    /// Get the current agent output.
    pub fn output(&self) -> AgentOutput {
        AgentOutput {
            x: self.current_x,
            y: self.current_y,
        }
    }

    /// Reset all state.
    pub fn reset(&mut self) {
        self.current_x = 0.0;
        self.current_y = 0.0;
        self.target_x = 0.0;
        self.target_y = 0.0;
        self.chaos_x = 0.0;
        self.chaos_y = 0.0;
        self.breathe_phase = 0.0;
        self.rng_state = 0xDEAD_BEEF;
    }

    // --- Mode implementations ---

    /// Follow mode: darker on minor, brighter on major.
    /// X maps to tonal brightness, Y maps to modulation speed.
    fn process_follow(&mut self, ctx: &MusicalContext) {
        // X: tonal character based on chord quality
        //  Minor/dim → negative (darker), Major/aug → positive (brighter)
        let tonal = if ctx.is_minor() {
            -0.6
        } else if ctx.is_major() {
            0.6
        } else {
            // No strong chord → subtle drift toward neutral
            0.0
        };

        // Modulate X by chord confidence
        let chord_conf = ctx.chord.map(|(_, _, c)| c).unwrap_or(0.0);
        self.target_x = tonal * chord_conf;

        // Y: modulation depth/speed tied to energy
        // Low energy → slow/shallow, high energy → fast/deep
        self.target_y = ctx.energy * 2.0 - 1.0; // 0..1 → -1..1
    }

    /// Contrast mode: opposite tonal mapping.
    /// Bright when the music is dark, dark when bright.
    fn process_contrast(&mut self, ctx: &MusicalContext) {
        // Invert the tonal mapping
        let tonal = if ctx.is_minor() {
            0.7 // Bright against dark
        } else if ctx.is_major() {
            -0.5 // Subdued against bright
        } else {
            0.0
        };

        let chord_conf = ctx.chord.map(|(_, _, c)| c).unwrap_or(0.0);
        self.target_x = tonal * chord_conf;

        // Invert energy mapping too: calm when music is intense
        self.target_y = (1.0 - ctx.energy) * 2.0 - 1.0;
    }

    /// Chaos mode: random walk with energy-controlled amplitude.
    fn process_chaos(&mut self, ctx: &MusicalContext) {
        // Step size proportional to energy
        let step = 0.05 + ctx.energy * 0.2;

        // Generate two random values in -1..1
        let rx = self.next_random();
        let ry = self.next_random();

        // Random walk: add step to current position
        self.chaos_x += rx * step;
        self.chaos_y += ry * step;

        // Soft clamp with pullback toward center (prevents getting stuck at edges)
        self.chaos_x *= 0.98;
        self.chaos_y *= 0.98;
        self.chaos_x = self.chaos_x.clamp(-1.0, 1.0);
        self.chaos_y = self.chaos_y.clamp(-1.0, 1.0);

        self.target_x = self.chaos_x;
        self.target_y = self.chaos_y;
    }

    /// Breathe mode: sine-like oscillation tied to tempo.
    fn process_breathe(&mut self, ctx: &MusicalContext) {
        // Oscillation rate: one full cycle per 2 bars (8 beats in 4/4)
        // freq = tempo / (60 * 8) Hz
        let freq = (ctx.tempo / 480.0) as f32; // tempo / (60 * 8)
        let buffer_secs = self.buffer_size as f32 / self.sample_rate;
        self.breathe_phase += freq * buffer_secs;

        // Wrap phase to 0..1
        if self.breathe_phase >= 1.0 {
            self.breathe_phase -= self.breathe_phase.floor();
        }

        // Sine oscillation for X (full cycle)
        let phase_rad = self.breathe_phase * core::f32::consts::TAU;
        self.target_x = phase_rad.sin();

        // Cosine (90 degree offset) for Y — creates circular motion in the XY plane
        self.target_y = phase_rad.cos();

        // Modulate amplitude by energy: more energy → larger breath
        let amplitude = 0.3 + ctx.energy * 0.7;
        self.target_x *= amplitude;
        self.target_y *= amplitude;
    }

    // --- Utilities ---

    /// Xorshift32 PRNG — returns a value in -1.0..1.0.
    /// Allocation-free, deterministic, suitable for audio thread.
    #[inline]
    fn next_random(&mut self) -> f32 {
        let mut x = self.rng_state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng_state = x;

        // Convert u32 to -1.0..1.0
        (x as f32 / (u32::MAX as f32)) * 2.0 - 1.0
    }
}

/// Convert an `AgentMode` integer parameter value to the enum.
/// Matches the IntParam range used in SynthParams.
pub fn int_to_agent_mode(value: i32) -> AgentMode {
    match value {
        1 => AgentMode::Follow,
        2 => AgentMode::Contrast,
        3 => AgentMode::Chaos,
        4 => AgentMode::Breathe,
        _ => AgentMode::Off,
    }
}
