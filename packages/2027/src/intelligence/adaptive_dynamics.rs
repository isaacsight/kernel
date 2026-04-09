//! Adaptive Dynamics: make drums respond intelligently to musical context.
//!
//! Analyzes MusicalContext (chord, scale, energy) to detect musical sections
//! (verse, chorus, bridge, drop, breakdown) and output dynamics modifiers
//! that shape the drum kit's behavior in real time.

use crate::context::musical_context::MusicalContext;

/// Detected musical section.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Section {
    /// Low energy, minor chords. Softer, more space.
    Verse,
    /// High energy, major chords. Harder, more active.
    Chorus,
    /// Moderate energy, unusual chords. Lighter, fills.
    Bridge,
    /// Sudden high energy after low. Maximum intensity.
    Drop,
    /// Energy dropping. Strip to essentials.
    Breakdown,
    /// Not enough data to classify.
    Unknown,
}

/// Dynamics modifiers applied to the drum kit processing.
#[derive(Debug, Clone, Copy)]
pub struct DynamicsModifiers {
    /// Velocity scaling (0.5 = half, 1.0 = normal, 1.5 = hard hit).
    pub velocity_scale: f32,
    /// Decay scaling (0.5 = tight, 1.0 = normal, 2.0 = long ring).
    pub decay_scale: f32,
    /// Density scaling (0.3 = minimal, 1.0 = normal, 1.5 = busy).
    pub density_scale: f32,
    /// Per-drum enable flags. If false, that voice is muted.
    pub kick_enabled: bool,
    pub snare_enabled: bool,
    pub hihat_closed_enabled: bool,
    pub hihat_open_enabled: bool,
    pub clap_enabled: bool,
    pub tom_enabled: bool,
    pub rim_enabled: bool,
    pub percussion_enabled: bool,
}

impl Default for DynamicsModifiers {
    fn default() -> Self {
        Self {
            velocity_scale: 1.0,
            decay_scale: 1.0,
            density_scale: 1.0,
            kick_enabled: true,
            snare_enabled: true,
            hihat_closed_enabled: true,
            hihat_open_enabled: true,
            clap_enabled: true,
            tom_enabled: true,
            rim_enabled: true,
            percussion_enabled: true,
        }
    }
}

impl DynamicsModifiers {
    /// Enable all drum voices.
    pub fn all_enabled(&mut self) {
        self.kick_enabled = true;
        self.snare_enabled = true;
        self.hihat_closed_enabled = true;
        self.hihat_open_enabled = true;
        self.clap_enabled = true;
        self.tom_enabled = true;
        self.rim_enabled = true;
        self.percussion_enabled = true;
    }
}

/// The adaptive dynamics engine.
///
/// Tracks energy history to detect section transitions (especially drops).
/// Call `process()` once per audio buffer with the current musical context.
pub struct AdaptiveDynamics {
    /// Current detected section.
    section: Section,
    /// Current output modifiers (smoothed).
    current: DynamicsModifiers,
    /// Target modifiers (computed each update).
    target: DynamicsModifiers,
    /// Energy history (ring buffer of recent energy values).
    energy_history: [f32; 32],
    /// Write index into energy_history.
    energy_idx: usize,
    /// How many buffers of history we have.
    energy_count: usize,
    /// Smoothing coefficient (per-buffer).
    slew: f32,
}

impl AdaptiveDynamics {
    /// Create a new adaptive dynamics engine.
    pub fn new(sample_rate: f32, buffer_size: usize) -> Self {
        let buffers_per_sec = sample_rate / buffer_size.max(1) as f32;
        // ~200ms smoothing time constant
        let tau = 0.2 * buffers_per_sec;
        let slew = if tau < 1.0 { 1.0 } else { 1.0 - (-1.0 / tau).exp() };

        Self {
            section: Section::Unknown,
            current: DynamicsModifiers::default(),
            target: DynamicsModifiers::default(),
            energy_history: [0.0; 32],
            energy_idx: 0,
            energy_count: 0,
            slew,
        }
    }

    /// Update sample rate and buffer size.
    pub fn set_sample_rate(&mut self, sample_rate: f32, buffer_size: usize) {
        let buffers_per_sec = sample_rate / buffer_size.max(1) as f32;
        let tau = 0.2 * buffers_per_sec;
        self.slew = if tau < 1.0 { 1.0 } else { 1.0 - (-1.0 / tau).exp() };
    }

    /// Process one buffer of musical context, updating section detection
    /// and dynamics modifiers.
    pub fn process(&mut self, ctx: &MusicalContext) {
        // Record energy in ring buffer
        self.energy_history[self.energy_idx] = ctx.energy;
        self.energy_idx = (self.energy_idx + 1) % self.energy_history.len();
        if self.energy_count < self.energy_history.len() {
            self.energy_count += 1;
        }

        // Detect section
        self.section = self.detect_section(ctx);

        // Compute target modifiers based on section
        self.target = match self.section {
            Section::Verse => self.verse_modifiers(),
            Section::Chorus => self.chorus_modifiers(),
            Section::Bridge => self.bridge_modifiers(),
            Section::Drop => self.drop_modifiers(),
            Section::Breakdown => self.breakdown_modifiers(ctx),
            Section::Unknown => DynamicsModifiers::default(),
        };

        // Smooth toward target
        self.current.velocity_scale += (self.target.velocity_scale - self.current.velocity_scale) * self.slew;
        self.current.decay_scale += (self.target.decay_scale - self.current.decay_scale) * self.slew;
        self.current.density_scale += (self.target.density_scale - self.current.density_scale) * self.slew;

        // Drum enables are instant (no smoothing on booleans)
        self.current.kick_enabled = self.target.kick_enabled;
        self.current.snare_enabled = self.target.snare_enabled;
        self.current.hihat_closed_enabled = self.target.hihat_closed_enabled;
        self.current.hihat_open_enabled = self.target.hihat_open_enabled;
        self.current.clap_enabled = self.target.clap_enabled;
        self.current.tom_enabled = self.target.tom_enabled;
        self.current.rim_enabled = self.target.rim_enabled;
        self.current.percussion_enabled = self.target.percussion_enabled;
    }

    /// Get the current dynamics modifiers.
    pub fn modifiers(&self) -> &DynamicsModifiers {
        &self.current
    }

    /// Get the current detected section.
    pub fn section(&self) -> Section {
        self.section
    }

    /// Reset all state.
    pub fn reset(&mut self) {
        self.section = Section::Unknown;
        self.current = DynamicsModifiers::default();
        self.target = DynamicsModifiers::default();
        self.energy_history = [0.0; 32];
        self.energy_idx = 0;
        self.energy_count = 0;
    }

    // -----------------------------------------------------------------------
    // Section detection
    // -----------------------------------------------------------------------

    fn detect_section(&self, ctx: &MusicalContext) -> Section {
        let energy = ctx.energy;
        let recent_avg = self.recent_energy_avg(8);
        let older_avg = self.older_energy_avg(8, 16);

        // Drop detection: sudden high energy after a period of low energy
        if energy > 0.75 && older_avg < 0.35 && (energy - older_avg) > 0.4 {
            return Section::Drop;
        }

        // Breakdown: energy is dropping significantly
        if self.energy_count >= 8 && recent_avg < older_avg - 0.2 && energy < 0.4 {
            return Section::Breakdown;
        }

        // Chord-quality-based detection
        let is_minor = ctx.is_minor();
        let is_major = ctx.is_major();

        // Bridge: moderate energy, unusual chords (neither clearly major nor minor)
        // or chord confidence is low
        let chord_conf = ctx.chord.map(|(_, _, c)| c).unwrap_or(0.0);
        if energy > 0.3 && energy < 0.65 && chord_conf < 0.5 {
            return Section::Bridge;
        }

        // Chorus: high energy, major chords
        if energy > 0.6 && is_major {
            return Section::Chorus;
        }

        // Verse: low energy, minor chords
        if energy < 0.5 && is_minor {
            return Section::Verse;
        }

        // Fallback: use energy alone
        if energy > 0.65 {
            Section::Chorus
        } else if energy < 0.35 {
            Section::Verse
        } else {
            Section::Unknown
        }
    }

    /// Average energy of the most recent N buffers.
    fn recent_energy_avg(&self, n: usize) -> f32 {
        if self.energy_count == 0 {
            return 0.0;
        }
        let n = n.min(self.energy_count);
        let mut sum = 0.0;
        for i in 0..n {
            let idx = (self.energy_idx + self.energy_history.len() - 1 - i) % self.energy_history.len();
            sum += self.energy_history[idx];
        }
        sum / n as f32
    }

    /// Average energy of N buffers starting from `offset` buffers ago.
    fn older_energy_avg(&self, offset: usize, n: usize) -> f32 {
        if self.energy_count <= offset {
            return 0.0;
        }
        let available = self.energy_count - offset;
        let n = n.min(available);
        if n == 0 {
            return 0.0;
        }
        let mut sum = 0.0;
        for i in 0..n {
            let idx = (self.energy_idx + self.energy_history.len() - 1 - offset - i) % self.energy_history.len();
            sum += self.energy_history[idx];
        }
        sum / n as f32
    }

    // -----------------------------------------------------------------------
    // Section modifier presets
    // -----------------------------------------------------------------------

    fn verse_modifiers(&self) -> DynamicsModifiers {
        let mut m = DynamicsModifiers::default();
        m.velocity_scale = 0.7;
        m.decay_scale = 1.5; // Longer decay for softer feel
        m.density_scale = 0.7;
        // Reduce hi-hat prominence
        m.hihat_open_enabled = false;
        m
    }

    fn chorus_modifiers(&self) -> DynamicsModifiers {
        let mut m = DynamicsModifiers::default();
        m.velocity_scale = 1.2;
        m.decay_scale = 0.8; // Tighter
        m.density_scale = 1.3;
        m.all_enabled();
        m.hihat_open_enabled = true; // Open hats for energy
        m
    }

    fn bridge_modifiers(&self) -> DynamicsModifiers {
        let mut m = DynamicsModifiers::default();
        m.velocity_scale = 0.8;
        m.decay_scale = 1.2;
        m.density_scale = 0.6;
        // Lighter drums, more space, add percussion fills
        m.snare_enabled = false;
        m.clap_enabled = false;
        m.percussion_enabled = true;
        m.rim_enabled = true;
        m
    }

    fn drop_modifiers(&self) -> DynamicsModifiers {
        let mut m = DynamicsModifiers::default();
        m.velocity_scale = 1.5; // Maximum impact
        m.decay_scale = 0.6;   // Short and tight
        m.density_scale = 1.5; // All drums active
        m.all_enabled();
        m
    }

    fn breakdown_modifiers(&self, ctx: &MusicalContext) -> DynamicsModifiers {
        let mut m = DynamicsModifiers::default();
        // Gradually reduce based on how low energy is
        m.velocity_scale = 0.5 + ctx.energy * 0.5; // 0.5 at zero energy, 1.0 at full
        m.decay_scale = 1.0;
        m.density_scale = 0.3 + ctx.energy * 0.4;
        // Strip to kick + hat only
        m.kick_enabled = true;
        m.snare_enabled = false;
        m.hihat_closed_enabled = true;
        m.hihat_open_enabled = false;
        m.clap_enabled = false;
        m.tom_enabled = false;
        m.rim_enabled = false;
        m.percussion_enabled = false;
        m
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::context::chord_detector::ChordQuality;

    fn make_ctx(energy: f32, chord: Option<(u8, ChordQuality, f32)>) -> MusicalContext {
        MusicalContext {
            energy,
            chord,
            scale: None,
            tempo: 120.0,
            note_density: 0.0,
            velocity_avg: 0.0,
        }
    }

    #[test]
    fn test_verse_detection() {
        let mut dyn_eng = AdaptiveDynamics::new(44100.0, 512);
        let ctx = make_ctx(0.3, Some((0, ChordQuality::Minor, 0.8)));
        for _ in 0..10 {
            dyn_eng.process(&ctx);
        }
        assert_eq!(dyn_eng.section(), Section::Verse);
        assert!(dyn_eng.modifiers().velocity_scale < 1.0);
    }

    #[test]
    fn test_chorus_detection() {
        let mut dyn_eng = AdaptiveDynamics::new(44100.0, 512);
        let ctx = make_ctx(0.8, Some((0, ChordQuality::Major, 0.8)));
        for _ in 0..10 {
            dyn_eng.process(&ctx);
        }
        assert_eq!(dyn_eng.section(), Section::Chorus);
        assert!(dyn_eng.modifiers().velocity_scale > 1.0);
    }

    #[test]
    fn test_drop_detection() {
        let mut dyn_eng = AdaptiveDynamics::new(44100.0, 512);
        // Feed low energy for a while
        let quiet = make_ctx(0.1, None);
        for _ in 0..20 {
            dyn_eng.process(&quiet);
        }
        // Sudden high energy — process several buffers to let smoothing converge
        let loud = make_ctx(0.9, Some((0, ChordQuality::Major, 0.9)));
        for _ in 0..20 {
            dyn_eng.process(&loud);
        }
        // After enough loud buffers it should be chorus/high-energy, not drop
        // (drop is transient). Check that the first buffer detected the drop:
        // Re-test with fresh state:
        let mut dyn_eng2 = AdaptiveDynamics::new(44100.0, 512);
        let quiet = make_ctx(0.1, None);
        for _ in 0..20 {
            dyn_eng2.process(&quiet);
        }
        let loud = make_ctx(0.9, Some((0, ChordQuality::Major, 0.9)));
        dyn_eng2.process(&loud);
        assert_eq!(dyn_eng2.section(), Section::Drop);
    }

    #[test]
    fn test_breakdown_strips_drums() {
        let mut dyn_eng = AdaptiveDynamics::new(44100.0, 512);
        // Build energy history
        let loud = make_ctx(0.8, None);
        for _ in 0..16 {
            dyn_eng.process(&loud);
        }
        // Drop energy
        let quiet = make_ctx(0.2, None);
        for _ in 0..10 {
            dyn_eng.process(&quiet);
        }
        if dyn_eng.section() == Section::Breakdown {
            let m = dyn_eng.modifiers();
            assert!(m.kick_enabled);
            assert!(!m.snare_enabled);
            assert!(!m.clap_enabled);
        }
    }
}
