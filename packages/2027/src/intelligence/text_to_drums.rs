//! Text-to-Drum-Pattern Engine: parse natural language into drum sequences.
//!
//! Rule-based genre detection and pattern generation — no neural networks.
//! Produces 16- or 32-step patterns with velocity, swing, and humanization.

/// Drum voice identifiers (maps to DrumKit MIDI notes).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DrumVoice {
    Kick,
    Snare,
    HiHatClosed,
    HiHatOpen,
    Clap,
    Tom,
    Rim,
    Percussion,
}

impl DrumVoice {
    /// Convert to MIDI note number matching `dsp::drums` constants.
    pub fn midi_note(self) -> u8 {
        match self {
            DrumVoice::Kick => 36,
            DrumVoice::Snare => 38,
            DrumVoice::HiHatClosed => 42,
            DrumVoice::HiHatOpen => 46,
            DrumVoice::Clap => 39,
            DrumVoice::Tom => 48,
            DrumVoice::Rim => 37,
            DrumVoice::Percussion => 44,
        }
    }
}

/// A single hit in a drum pattern.
#[derive(Debug, Clone, Copy)]
pub struct DrumHit {
    /// Step index (0-based, within the pattern length).
    pub step: u8,
    /// Which drum voice to trigger.
    pub voice: DrumVoice,
    /// Velocity 0.0-1.0.
    pub velocity: f32,
}

/// A complete drum pattern.
#[derive(Debug, Clone)]
pub struct DrumPattern {
    /// Pattern name / genre tag.
    pub name: String,
    /// Number of steps (typically 16 or 32).
    pub steps: u8,
    /// Tempo in BPM (suggestion; host may override).
    pub tempo: f32,
    /// Swing amount: 0.0 = straight, 1.0 = full triplet swing.
    pub swing: f32,
    /// Humanize: random velocity variation amount (0.0 to 0.3).
    pub humanize: f32,
    /// All hits in the pattern.
    pub hits: Vec<DrumHit>,
}

impl DrumPattern {
    /// Get all hits at a specific step.
    pub fn hits_at_step(&self, step: u8) -> Vec<&DrumHit> {
        self.hits.iter().filter(|h| h.step == step).collect()
    }

    /// Count how many distinct steps have at least one hit.
    pub fn active_steps(&self) -> usize {
        let mut seen = [false; 64];
        for hit in &self.hits {
            if (hit.step as usize) < 64 {
                seen[hit.step as usize] = true;
            }
        }
        seen.iter().filter(|&&v| v).count()
    }
}

/// Detected genre from text input.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Genre {
    Trap,
    House,
    Dnb,
    LoFi,
    Drill,
    Ambient,
    Industrial,
    HipHop,
    Techno,
}

// ---------------------------------------------------------------------------
// Genre detection
// ---------------------------------------------------------------------------

/// Detect genre from text description. Returns (genre, confidence).
fn detect_genre(text: &str) -> (Genre, f32) {
    let lower = text.to_lowercase();

    // Direct genre mentions (highest confidence)
    let checks: &[(&[&str], Genre)] = &[
        (&["trap"], Genre::Trap),
        (&["house", "four on the floor", "4 on the floor", "4otf"], Genre::House),
        (&["drum and bass", "dnb", "drum n bass", "jungle"], Genre::Dnb),
        (&["lo-fi", "lofi", "lo fi", "chillhop"], Genre::LoFi),
        (&["drill", "uk drill"], Genre::Drill),
        (&["ambient", "atmospheric", "spacious"], Genre::Ambient),
        (&["industrial", "noise", "harsh"], Genre::Industrial),
        (&["hip hop", "hip-hop", "hiphop", "boom bap"], Genre::HipHop),
        (&["techno", "rave", "warehouse"], Genre::Techno),
    ];

    for (keywords, genre) in checks {
        for kw in *keywords {
            if lower.contains(kw) {
                return (*genre, 1.0);
            }
        }
    }

    // Indirect cues (lower confidence)
    if lower.contains("808") || lower.contains("hi-hat roll") {
        return (Genre::Trap, 0.7);
    }
    if lower.contains("kick on every beat") || lower.contains("four to the floor") {
        return (Genre::House, 0.7);
    }
    if lower.contains("breakbeat") || lower.contains("fast") {
        return (Genre::Dnb, 0.6);
    }
    if lower.contains("chill") || lower.contains("lazy") || lower.contains("relaxed") {
        return (Genre::LoFi, 0.6);
    }
    if lower.contains("sparse") || lower.contains("minimal") {
        return (Genre::Ambient, 0.5);
    }
    if lower.contains("heavy") || lower.contains("aggressive") || lower.contains("distorted") {
        return (Genre::Industrial, 0.6);
    }

    // Default to trap (most commonly requested)
    (Genre::Trap, 0.2)
}

// ---------------------------------------------------------------------------
// Genre pattern templates
// ---------------------------------------------------------------------------

fn make_trap() -> DrumPattern {
    let mut hits = Vec::new();
    // Kick on beat 1 (step 0) and a syncopated hit
    hits.push(DrumHit { step: 0, voice: DrumVoice::Kick, velocity: 1.0 });
    hits.push(DrumHit { step: 6, voice: DrumVoice::Kick, velocity: 0.85 });
    hits.push(DrumHit { step: 10, voice: DrumVoice::Kick, velocity: 0.75 });

    // Clap on beat 3 (step 8)
    hits.push(DrumHit { step: 8, voice: DrumVoice::Clap, velocity: 0.9 });

    // 16th note hi-hats
    for i in 0..16u8 {
        let vel = if i % 4 == 0 { 0.8 } else { 0.5 };
        hits.push(DrumHit { step: i, voice: DrumVoice::HiHatClosed, velocity: vel });
    }

    // Hi-hat rolls on beat 4 (steps 12-15, double velocity pattern)
    hits.push(DrumHit { step: 12, voice: DrumVoice::HiHatClosed, velocity: 0.9 });
    hits.push(DrumHit { step: 13, voice: DrumVoice::HiHatClosed, velocity: 0.95 });
    hits.push(DrumHit { step: 14, voice: DrumVoice::HiHatClosed, velocity: 1.0 });
    hits.push(DrumHit { step: 15, voice: DrumVoice::HiHatClosed, velocity: 0.85 });

    // Rim fill
    hits.push(DrumHit { step: 4, voice: DrumVoice::Rim, velocity: 0.4 });
    hits.push(DrumHit { step: 14, voice: DrumVoice::Rim, velocity: 0.35 });

    DrumPattern {
        name: "Trap".to_string(),
        steps: 16,
        tempo: 140.0,
        swing: 0.0,
        humanize: 0.05,
        hits,
    }
}

fn make_house() -> DrumPattern {
    let mut hits = Vec::new();

    // 4-on-floor kick
    for i in (0..16).step_by(4) {
        hits.push(DrumHit { step: i as u8, voice: DrumVoice::Kick, velocity: 1.0 });
    }

    // Clap on 2 & 4 (steps 4 and 12)
    hits.push(DrumHit { step: 4, voice: DrumVoice::Clap, velocity: 0.85 });
    hits.push(DrumHit { step: 12, voice: DrumVoice::Clap, velocity: 0.85 });

    // Closed hats on 8ths
    for i in (0..16).step_by(2) {
        hits.push(DrumHit { step: i as u8, voice: DrumVoice::HiHatClosed, velocity: 0.6 });
    }

    // Open hat on offbeats (between kicks)
    hits.push(DrumHit { step: 2, voice: DrumVoice::HiHatOpen, velocity: 0.7 });
    hits.push(DrumHit { step: 6, voice: DrumVoice::HiHatOpen, velocity: 0.7 });
    hits.push(DrumHit { step: 10, voice: DrumVoice::HiHatOpen, velocity: 0.7 });
    hits.push(DrumHit { step: 14, voice: DrumVoice::HiHatOpen, velocity: 0.7 });

    DrumPattern {
        name: "House".to_string(),
        steps: 16,
        tempo: 124.0,
        swing: 0.1,
        humanize: 0.02,
        hits,
    }
}

fn make_dnb() -> DrumPattern {
    let mut hits = Vec::new();

    // Breakbeat kick (syncopated)
    hits.push(DrumHit { step: 0, voice: DrumVoice::Kick, velocity: 1.0 });
    hits.push(DrumHit { step: 9, voice: DrumVoice::Kick, velocity: 0.9 });
    hits.push(DrumHit { step: 14, voice: DrumVoice::Kick, velocity: 0.8 });

    // Snare on 2 & 4
    hits.push(DrumHit { step: 4, voice: DrumVoice::Snare, velocity: 1.0 });
    hits.push(DrumHit { step: 12, voice: DrumVoice::Snare, velocity: 1.0 });

    // Fast hats (16th notes)
    for i in 0..16u8 {
        let vel = if i % 2 == 0 { 0.7 } else { 0.45 };
        hits.push(DrumHit { step: i, voice: DrumVoice::HiHatClosed, velocity: vel });
    }

    // Ghost snare hits
    hits.push(DrumHit { step: 7, voice: DrumVoice::Snare, velocity: 0.3 });
    hits.push(DrumHit { step: 11, voice: DrumVoice::Snare, velocity: 0.25 });

    DrumPattern {
        name: "DnB".to_string(),
        steps: 16,
        tempo: 174.0,
        swing: 0.0,
        humanize: 0.03,
        hits,
    }
}

fn make_lofi() -> DrumPattern {
    let mut hits = Vec::new();

    // Lazy kick (slightly late feel via humanize, not step-shifted)
    hits.push(DrumHit { step: 0, voice: DrumVoice::Kick, velocity: 0.75 });
    hits.push(DrumHit { step: 7, voice: DrumVoice::Kick, velocity: 0.65 });

    // Side-stick ghost notes
    hits.push(DrumHit { step: 4, voice: DrumVoice::Rim, velocity: 0.5 });
    hits.push(DrumHit { step: 12, voice: DrumVoice::Rim, velocity: 0.5 });
    hits.push(DrumHit { step: 6, voice: DrumVoice::Rim, velocity: 0.2 });
    hits.push(DrumHit { step: 10, voice: DrumVoice::Rim, velocity: 0.15 });
    hits.push(DrumHit { step: 14, voice: DrumVoice::Rim, velocity: 0.2 });

    // Brushed hat (very soft)
    for i in (0..16).step_by(2) {
        hits.push(DrumHit { step: i as u8, voice: DrumVoice::HiHatClosed, velocity: 0.3 });
    }

    DrumPattern {
        name: "Lo-Fi".to_string(),
        steps: 16,
        tempo: 85.0,
        swing: 0.4,
        humanize: 0.2,
        hits,
    }
}

fn make_drill() -> DrumPattern {
    let mut hits = Vec::new();

    // Sliding 808 pattern
    hits.push(DrumHit { step: 0, voice: DrumVoice::Kick, velocity: 1.0 });
    hits.push(DrumHit { step: 3, voice: DrumVoice::Kick, velocity: 0.85 });
    hits.push(DrumHit { step: 7, voice: DrumVoice::Kick, velocity: 0.9 });
    hits.push(DrumHit { step: 11, voice: DrumVoice::Kick, velocity: 0.8 });

    // Sparse clap
    hits.push(DrumHit { step: 8, voice: DrumVoice::Clap, velocity: 0.95 });

    // Double-time hats (every step)
    for i in 0..16u8 {
        let vel = match i % 4 {
            0 => 0.7,
            2 => 0.6,
            _ => 0.4,
        };
        hits.push(DrumHit { step: i, voice: DrumVoice::HiHatClosed, velocity: vel });
    }

    // Open hat accent
    hits.push(DrumHit { step: 6, voice: DrumVoice::HiHatOpen, velocity: 0.65 });

    DrumPattern {
        name: "Drill".to_string(),
        steps: 16,
        tempo: 140.0,
        swing: 0.0,
        humanize: 0.04,
        hits,
    }
}

fn make_ambient() -> DrumPattern {
    let mut hits = Vec::new();

    // Sparse kick with long decay (velocity is low = gentle)
    hits.push(DrumHit { step: 0, voice: DrumVoice::Kick, velocity: 0.45 });
    hits.push(DrumHit { step: 12, voice: DrumVoice::Kick, velocity: 0.35 });

    // Very light hat
    hits.push(DrumHit { step: 4, voice: DrumVoice::HiHatClosed, velocity: 0.2 });
    hits.push(DrumHit { step: 10, voice: DrumVoice::HiHatClosed, velocity: 0.15 });

    // Subtle percussion
    hits.push(DrumHit { step: 8, voice: DrumVoice::Percussion, velocity: 0.25 });

    DrumPattern {
        name: "Ambient".to_string(),
        steps: 16,
        tempo: 90.0,
        swing: 0.15,
        humanize: 0.15,
        hits,
    }
}

fn make_industrial() -> DrumPattern {
    let mut hits = Vec::new();

    // Distorted kick on every beat (4 on the floor but aggressive)
    for i in (0..16).step_by(4) {
        hits.push(DrumHit { step: i as u8, voice: DrumVoice::Kick, velocity: 1.0 });
    }
    // Extra kick hits for aggression
    hits.push(DrumHit { step: 2, voice: DrumVoice::Kick, velocity: 0.85 });
    hits.push(DrumHit { step: 10, voice: DrumVoice::Kick, velocity: 0.9 });

    // Metallic percussion (every other 8th)
    for i in (1..16).step_by(4) {
        hits.push(DrumHit { step: i as u8, voice: DrumVoice::Percussion, velocity: 0.9 });
    }

    // Aggressive snare
    hits.push(DrumHit { step: 4, voice: DrumVoice::Snare, velocity: 1.0 });
    hits.push(DrumHit { step: 12, voice: DrumVoice::Snare, velocity: 1.0 });

    // Noisy closed hats
    for i in 0..16u8 {
        hits.push(DrumHit { step: i, voice: DrumVoice::HiHatClosed, velocity: 0.55 });
    }

    DrumPattern {
        name: "Industrial".to_string(),
        steps: 16,
        tempo: 130.0,
        swing: 0.0,
        humanize: 0.02,
        hits,
    }
}

fn make_hiphop() -> DrumPattern {
    let mut hits = Vec::new();

    // Classic boom-bap kick
    hits.push(DrumHit { step: 0, voice: DrumVoice::Kick, velocity: 0.95 });
    hits.push(DrumHit { step: 5, voice: DrumVoice::Kick, velocity: 0.75 });
    hits.push(DrumHit { step: 10, voice: DrumVoice::Kick, velocity: 0.85 });

    // Snare on 2 & 4
    hits.push(DrumHit { step: 4, voice: DrumVoice::Snare, velocity: 0.9 });
    hits.push(DrumHit { step: 12, voice: DrumVoice::Snare, velocity: 0.9 });

    // 8th note hats
    for i in (0..16).step_by(2) {
        hits.push(DrumHit { step: i as u8, voice: DrumVoice::HiHatClosed, velocity: 0.55 });
    }

    // Open hat accent
    hits.push(DrumHit { step: 6, voice: DrumVoice::HiHatOpen, velocity: 0.6 });

    DrumPattern {
        name: "Hip-Hop".to_string(),
        steps: 16,
        tempo: 92.0,
        swing: 0.3,
        humanize: 0.1,
        hits,
    }
}

fn make_techno() -> DrumPattern {
    let mut hits = Vec::new();

    // 4-on-floor kick (heavier than house)
    for i in (0..16).step_by(4) {
        hits.push(DrumHit { step: i as u8, voice: DrumVoice::Kick, velocity: 1.0 });
    }

    // Clap on beat 2 & 4
    hits.push(DrumHit { step: 4, voice: DrumVoice::Clap, velocity: 0.8 });
    hits.push(DrumHit { step: 12, voice: DrumVoice::Clap, velocity: 0.8 });

    // 16th note hats
    for i in 0..16u8 {
        let vel = if i % 4 == 0 { 0.7 } else if i % 2 == 0 { 0.5 } else { 0.35 };
        hits.push(DrumHit { step: i, voice: DrumVoice::HiHatClosed, velocity: vel });
    }

    // Percussion on offbeats
    hits.push(DrumHit { step: 2, voice: DrumVoice::Percussion, velocity: 0.45 });
    hits.push(DrumHit { step: 6, voice: DrumVoice::Percussion, velocity: 0.4 });
    hits.push(DrumHit { step: 10, voice: DrumVoice::Percussion, velocity: 0.45 });
    hits.push(DrumHit { step: 14, voice: DrumVoice::Percussion, velocity: 0.4 });

    DrumPattern {
        name: "Techno".to_string(),
        steps: 16,
        tempo: 130.0,
        swing: 0.0,
        humanize: 0.01,
        hits,
    }
}

// ---------------------------------------------------------------------------
// Modifier keywords
// ---------------------------------------------------------------------------

/// Apply modifier keywords that adjust the base pattern.
fn apply_modifiers(pattern: &mut DrumPattern, text: &str) {
    let lower = text.to_lowercase();

    // Swing modifiers
    if lower.contains("swing") || lower.contains("shuffle") {
        pattern.swing = (pattern.swing + 0.25).min(1.0);
    }
    if lower.contains("straight") {
        pattern.swing = 0.0;
    }

    // Density modifiers
    if lower.contains("sparse") || lower.contains("minimal") || lower.contains("stripped") {
        // Remove some hits: keep only every other hat, remove ghost notes
        pattern.hits.retain(|h| {
            if h.voice == DrumVoice::HiHatClosed && h.step % 4 != 0 {
                return false;
            }
            if h.velocity < 0.3 {
                return false;
            }
            true
        });
    }
    if lower.contains("busy") || lower.contains("complex") || lower.contains("dense") {
        // Add ghost snares and extra percussion
        pattern.hits.push(DrumHit { step: 3, voice: DrumVoice::Rim, velocity: 0.25 });
        pattern.hits.push(DrumHit { step: 7, voice: DrumVoice::Rim, velocity: 0.2 });
        pattern.hits.push(DrumHit { step: 11, voice: DrumVoice::Rim, velocity: 0.2 });
        pattern.hits.push(DrumHit { step: 15, voice: DrumVoice::Tom, velocity: 0.3 });
    }

    // Feel modifiers
    if lower.contains("hard") || lower.contains("aggressive") || lower.contains("heavy") {
        for hit in pattern.hits.iter_mut() {
            hit.velocity = (hit.velocity * 1.3).min(1.0);
        }
    }
    if lower.contains("soft") || lower.contains("gentle") || lower.contains("quiet") {
        for hit in pattern.hits.iter_mut() {
            hit.velocity *= 0.6;
        }
    }

    // Humanize modifiers
    if lower.contains("human") || lower.contains("organic") || lower.contains("live") {
        pattern.humanize = (pattern.humanize + 0.15).min(0.3);
    }
    if lower.contains("tight") || lower.contains("quantized") || lower.contains("robotic") {
        pattern.humanize = 0.0;
    }

    // Tempo modifiers
    if lower.contains("half time") || lower.contains("halftime") {
        pattern.tempo *= 0.5;
    }
    if lower.contains("double time") || lower.contains("doubletime") {
        pattern.tempo *= 2.0;
    }
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/// Parse a text description and generate a drum pattern.
///
/// Detects genre from keywords, loads the template, applies modifiers,
/// and returns a complete `DrumPattern` ready for playback.
pub fn generate_pattern(description: &str) -> DrumPattern {
    let (genre, _confidence) = detect_genre(description);

    let mut pattern = match genre {
        Genre::Trap => make_trap(),
        Genre::House => make_house(),
        Genre::Dnb => make_dnb(),
        Genre::LoFi => make_lofi(),
        Genre::Drill => make_drill(),
        Genre::Ambient => make_ambient(),
        Genre::Industrial => make_industrial(),
        Genre::HipHop => make_hiphop(),
        Genre::Techno => make_techno(),
    };

    apply_modifiers(&mut pattern, description);
    pattern
}

/// Get the detected genre for a text description.
pub fn detect_genre_from_text(description: &str) -> Genre {
    detect_genre(description).0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trap_pattern() {
        let pattern = generate_pattern("trap beat");
        assert_eq!(pattern.name, "Trap");
        assert_eq!(pattern.steps, 16);
        assert!(pattern.tempo > 130.0);
        assert!(!pattern.hits.is_empty());
    }

    #[test]
    fn test_house_pattern() {
        let pattern = generate_pattern("house groove");
        assert_eq!(pattern.name, "House");
        // Should have kick on every beat (steps 0,4,8,12)
        let kicks: Vec<_> = pattern.hits.iter()
            .filter(|h| h.voice == DrumVoice::Kick)
            .collect();
        assert_eq!(kicks.len(), 4);
    }

    #[test]
    fn test_sparse_modifier() {
        let full = generate_pattern("trap");
        let sparse = generate_pattern("sparse trap");
        assert!(sparse.hits.len() < full.hits.len());
    }

    #[test]
    fn test_genre_detection() {
        assert_eq!(detect_genre_from_text("make a dnb beat"), Genre::Dnb);
        assert_eq!(detect_genre_from_text("lo-fi chill"), Genre::LoFi);
        assert_eq!(detect_genre_from_text("industrial noise"), Genre::Industrial);
    }
}
