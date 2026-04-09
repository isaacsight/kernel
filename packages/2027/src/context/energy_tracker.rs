//! Musical energy and intensity analysis from MIDI events.
//!
//! Tracks note density, average velocity, pitch range, and rhythmic
//! regularity to produce a composite energy level from 0.0 to 1.0.

/// Energy analysis result.
#[derive(Debug, Clone, Copy)]
pub struct EnergyState {
    /// Composite energy level (0.0 = silence, 1.0 = maximum intensity).
    pub energy: f32,
    /// Smoothed notes per second.
    pub note_density: f32,
    /// Exponentially weighted average velocity (0.0 to 1.0).
    pub velocity_avg: f32,
    /// Pitch range of currently active notes (semitones).
    pub pitch_range: f32,
    /// Rhythmic regularity (0.0 = irregular, 1.0 = perfectly regular).
    pub rhythmic_regularity: f32,
}

/// Maximum number of active notes to track for pitch range calculation.
const MAX_ACTIVE_NOTES: usize = 32;

/// Maximum number of inter-onset intervals to store for regularity analysis.
const MAX_IOI_HISTORY: usize = 16;

/// Tracks musical energy from MIDI data.
///
/// Feed note-on/off events and call [`process_buffer`] once per audio buffer
/// to update the smoothed energy state.
pub struct EnergyTracker {
    // --- Note density ---
    /// Number of note-on events accumulated since last buffer.
    note_count_accum: u32,
    /// Smoothed notes per second (exponentially weighted).
    note_density: f32,

    // --- Velocity ---
    /// Exponentially weighted average velocity.
    velocity_avg: f32,

    // --- Pitch range ---
    /// Currently active MIDI note numbers.
    active_notes: [u8; MAX_ACTIVE_NOTES],
    /// Number of currently active notes.
    active_count: usize,

    // --- Rhythmic regularity ---
    /// Recent inter-onset intervals in samples.
    ioi_history: [f64; MAX_IOI_HISTORY],
    /// Write position into ioi_history (circular).
    ioi_write_pos: usize,
    /// Number of valid IOI entries.
    ioi_count: usize,
    /// Sample position of the last note-on event.
    last_note_on_sample: f64,
    /// Running total sample position (accumulated across buffers).
    total_samples: f64,

    // --- Composite ---
    /// Current composite energy (smoothed).
    energy: f32,

    // --- Config ---
    sample_rate: f32,
    buffer_size: usize,

    /// Smoothing coefficient for the energy output (one-pole lowpass).
    smoothing: f32,
}

impl EnergyTracker {
    /// Create a new energy tracker.
    pub fn new(sample_rate: f32, buffer_size: usize) -> Self {
        Self {
            note_count_accum: 0,
            note_density: 0.0,
            velocity_avg: 0.0,
            active_notes: [0; MAX_ACTIVE_NOTES],
            active_count: 0,
            ioi_history: [0.0; MAX_IOI_HISTORY],
            ioi_write_pos: 0,
            ioi_count: 0,
            last_note_on_sample: -1.0,
            total_samples: 0.0,
            energy: 0.0,
            sample_rate,
            buffer_size,
            // Smoothing: ~100ms time constant
            smoothing: Self::compute_smoothing(sample_rate, buffer_size),
        }
    }

    fn compute_smoothing(sample_rate: f32, buffer_size: usize) -> f32 {
        // One-pole lowpass coefficient for ~100ms smoothing, applied per-buffer.
        let buffers_per_second = sample_rate / buffer_size.max(1) as f32;
        let tau_buffers = 0.1 * buffers_per_second; // 100ms in buffers
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
        self.smoothing = Self::compute_smoothing(sample_rate, buffer_size);
    }

    /// Register a note-on event.
    ///
    /// - `note`: MIDI note number (0-127)
    /// - `velocity`: velocity (0.0 to 1.0)
    /// - `sample_offset`: sample position within the current buffer
    #[inline]
    pub fn note_on(&mut self, note: u8, velocity: f32, sample_offset: u32) {
        self.note_count_accum += 1;

        // Update velocity average (exponentially weighted, alpha ~0.3 for responsiveness)
        self.velocity_avg = self.velocity_avg * 0.7 + velocity * 0.3;

        // Track active notes for pitch range
        if self.active_count < MAX_ACTIVE_NOTES {
            self.active_notes[self.active_count] = note;
            self.active_count += 1;
        }

        // Record inter-onset interval
        let current_sample = self.total_samples + sample_offset as f64;
        if self.last_note_on_sample >= 0.0 {
            let ioi = current_sample - self.last_note_on_sample;
            if ioi > 0.0 {
                self.ioi_history[self.ioi_write_pos] = ioi;
                self.ioi_write_pos = (self.ioi_write_pos + 1) % MAX_IOI_HISTORY;
                if self.ioi_count < MAX_IOI_HISTORY {
                    self.ioi_count += 1;
                }
            }
        }
        self.last_note_on_sample = current_sample;
    }

    /// Register a note-off event.
    #[inline]
    pub fn note_off(&mut self, note: u8) {
        // Remove the note from active notes (swap with last)
        for i in 0..self.active_count {
            if self.active_notes[i] == note {
                self.active_count -= 1;
                self.active_notes[i] = self.active_notes[self.active_count];
                break;
            }
        }
    }

    /// Process one buffer and update the smoothed energy state.
    /// Call this once at the end of each process buffer.
    pub fn process_buffer(&mut self) {
        let buffer_secs = self.buffer_size as f32 / self.sample_rate;

        // --- Note density (notes per second, smoothed) ---
        let instant_density = if buffer_secs > 0.0 {
            self.note_count_accum as f32 / buffer_secs
        } else {
            0.0
        };
        // Smooth the density (slow decay, fast attack)
        if instant_density > self.note_density {
            self.note_density += (instant_density - self.note_density) * 0.4;
        } else {
            self.note_density += (instant_density - self.note_density) * 0.1;
        }
        self.note_count_accum = 0;

        // --- Pitch range ---
        let pitch_range = if self.active_count >= 2 {
            let mut lo = 127u8;
            let mut hi = 0u8;
            for i in 0..self.active_count {
                let n = self.active_notes[i];
                if n < lo { lo = n; }
                if n > hi { hi = n; }
            }
            (hi - lo) as f32
        } else {
            0.0
        };

        // --- Rhythmic regularity ---
        let regularity = self.compute_regularity();

        // --- Composite energy ---
        // Each component is normalized to roughly 0..1, then combined.
        //
        // note_density: 0 notes/s = 0, 12+ notes/s = 1.0
        let density_norm = (self.note_density / 12.0).clamp(0.0, 1.0);
        // velocity_avg: already 0..1
        let vel_norm = self.velocity_avg;
        // pitch_range: 0 semitones = 0, 48+ semitones = 1.0
        let range_norm = (pitch_range / 48.0).clamp(0.0, 1.0);
        // regularity: 0..1 (regular playing adds energy)
        let reg_norm = regularity;

        // Weighted combination
        let raw_energy = 0.35 * density_norm
            + 0.30 * vel_norm
            + 0.20 * range_norm
            + 0.15 * reg_norm;

        // Smooth the composite energy
        self.energy += (raw_energy - self.energy) * self.smoothing;

        // Advance total sample count
        self.total_samples += self.buffer_size as f64;

        // Decay velocity average slowly when no notes are playing
        if self.active_count == 0 {
            self.velocity_avg *= 0.995;
        }
    }

    /// Compute rhythmic regularity from inter-onset interval variance.
    /// Returns 0.0 (irregular) to 1.0 (perfectly regular).
    fn compute_regularity(&self) -> f32 {
        if self.ioi_count < 3 {
            return 0.5; // Not enough data — neutral
        }

        let n = self.ioi_count;

        // Compute mean IOI
        let mut sum = 0.0f64;
        for i in 0..n {
            sum += self.ioi_history[i];
        }
        let mean = sum / n as f64;

        if mean < 1.0 {
            return 0.5;
        }

        // Compute coefficient of variation (CV = stddev / mean)
        let mut var_sum = 0.0f64;
        for i in 0..n {
            let diff = self.ioi_history[i] - mean;
            var_sum += diff * diff;
        }
        let cv = (var_sum / n as f64).sqrt() / mean;

        // CV = 0 means perfectly regular, higher means more irregular.
        // Map to 0..1 where 1 = regular.
        // CV of 0 → regularity 1.0, CV of 1.0+ → regularity near 0.0
        (1.0 - cv as f32).clamp(0.0, 1.0)
    }

    /// Get the current energy state.
    pub fn state(&self) -> EnergyState {
        let pitch_range = if self.active_count >= 2 {
            let mut lo = 127u8;
            let mut hi = 0u8;
            for i in 0..self.active_count {
                let n = self.active_notes[i];
                if n < lo { lo = n; }
                if n > hi { hi = n; }
            }
            (hi - lo) as f32
        } else {
            0.0
        };

        EnergyState {
            energy: self.energy,
            note_density: self.note_density,
            velocity_avg: self.velocity_avg,
            pitch_range,
            rhythmic_regularity: self.compute_regularity(),
        }
    }

    /// Reset all state.
    pub fn reset(&mut self) {
        self.note_count_accum = 0;
        self.note_density = 0.0;
        self.velocity_avg = 0.0;
        self.active_count = 0;
        self.ioi_count = 0;
        self.ioi_write_pos = 0;
        self.last_note_on_sample = -1.0;
        self.total_samples = 0.0;
        self.energy = 0.0;
    }
}
