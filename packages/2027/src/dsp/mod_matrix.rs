//! Modulation matrix: routes modulation sources to synthesis parameter destinations.
//!
//! Supports 32 modulation slots, each with a source, destination, bipolar amount,
//! and optional "via" source that scales the modulation amount (mod-of-mod).

/// Maximum number of modulation routing slots.
pub const MAX_MOD_SLOTS: usize = 32;

/// Modulation sources.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModSource {
    /// Low-frequency oscillators (indices 0-3).
    Lfo1,
    Lfo2,
    Lfo3,
    Lfo4,
    /// Envelope generators (indices 0-3).
    Env1,
    Env2,
    Env3,
    Env4,
    /// MIDI velocity (0-1, set at note-on).
    Velocity,
    /// Key tracking: maps MIDI note to -1..+1 centered on middle C (note 60).
    KeyTrack,
    /// MIDI CC 1 (mod wheel), 0-1.
    ModWheel,
    /// MIDI channel aftertouch, 0-1.
    Aftertouch,
    /// AI agent output X — driven by the agentic context engine.
    AgentX,
    /// AI agent output Y — driven by the agentic context engine.
    AgentY,
    /// No source (slot disabled).
    None,
}

/// Modulation destinations.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModDest {
    /// Oscillator pitch (semitones offset).
    OscPitch,
    /// Wavetable morph position (0-1 offset).
    WtPosition,
    /// FM modulation depth (additive offset to FM depth param).
    FmDepth,
    /// Granular playback position (0-1 offset).
    GrainPosition,
    /// Granular grain size (seconds offset).
    GrainSize,
    /// Granular grain density (Hz offset).
    GrainDensity,
    /// Filter cutoff frequency (Hz offset, applied multiplicatively via semitones).
    FilterCutoff,
    /// Filter resonance (0-1 offset).
    FilterResonance,
    /// Voice volume (linear gain offset).
    Volume,
    /// Stereo pan (-1 to +1 offset).
    Pan,
    /// FM operator 1-4 frequency ratios (additive offset).
    FmRatio1,
    FmRatio2,
    FmRatio3,
    FmRatio4,
    /// FM operator 1-4 feedback amounts (additive offset).
    FmFeedback1,
    FmFeedback2,
    FmFeedback3,
    FmFeedback4,
    /// No destination (slot disabled).
    None,
}

/// A single modulation routing.
#[derive(Clone, Copy)]
pub struct ModSlot {
    /// The modulation source.
    pub source: ModSource,
    /// The modulation destination.
    pub destination: ModDest,
    /// Modulation amount, bipolar [-1.0, +1.0].
    pub amount: f32,
    /// Optional "via" source that scales the amount. If `None`, the full amount
    /// is always applied. If set, the effective amount is `amount * via_value`.
    pub via: ModSource,
}

impl Default for ModSlot {
    fn default() -> Self {
        Self {
            source: ModSource::None,
            destination: ModDest::None,
            amount: 0.0,
            via: ModSource::None,
        }
    }
}

/// Current values of all modulation sources.
/// Updated each sample (or per-block for slow sources like velocity).
#[derive(Default, Clone, Copy)]
pub struct ModSourceValues {
    pub lfo: [f32; 4],         // LFO1-4 output, bipolar [-1, +1]
    pub env: [f32; 4],         // Env1-4 output, unipolar [0, 1]
    pub velocity: f32,         // Note velocity [0, 1]
    pub key_track: f32,        // Key tracking [-1, +1] centered on C4
    pub mod_wheel: f32,        // CC1 [0, 1]
    pub aftertouch: f32,       // Channel AT [0, 1]
    pub agent_x: f32,          // AI agent X [-1, +1]
    pub agent_y: f32,          // AI agent Y [-1, +1]
}

impl ModSourceValues {
    /// Look up the current value for a given source enum.
    #[inline]
    pub fn get(&self, source: ModSource) -> f32 {
        match source {
            ModSource::Lfo1 => self.lfo[0],
            ModSource::Lfo2 => self.lfo[1],
            ModSource::Lfo3 => self.lfo[2],
            ModSource::Lfo4 => self.lfo[3],
            ModSource::Env1 => self.env[0],
            ModSource::Env2 => self.env[1],
            ModSource::Env3 => self.env[2],
            ModSource::Env4 => self.env[3],
            ModSource::Velocity => self.velocity,
            ModSource::KeyTrack => self.key_track,
            ModSource::ModWheel => self.mod_wheel,
            ModSource::Aftertouch => self.aftertouch,
            ModSource::AgentX => self.agent_x,
            ModSource::AgentY => self.agent_y,
            ModSource::None => 0.0,
        }
    }
}

/// Accumulated modulation destination offsets.
/// Each field is the summed offset from all active mod slots targeting that destination.
#[derive(Default, Clone, Copy)]
pub struct ModDestOffsets {
    pub osc_pitch: f32,
    pub wt_position: f32,
    pub fm_depth: f32,
    pub grain_position: f32,
    pub grain_size: f32,
    pub grain_density: f32,
    pub filter_cutoff: f32,
    pub filter_resonance: f32,
    pub volume: f32,
    pub pan: f32,
    pub fm_ratio: [f32; 4],
    pub fm_feedback: [f32; 4],
}

/// The modulation matrix: 32 slots of source → destination routings.
pub struct ModMatrix {
    /// The routing slots.
    pub slots: [ModSlot; MAX_MOD_SLOTS],
}

impl ModMatrix {
    pub fn new() -> Self {
        Self {
            slots: [ModSlot::default(); MAX_MOD_SLOTS],
        }
    }

    /// Process the modulation matrix: given the current source values,
    /// compute the destination offsets by summing all active routings.
    #[inline]
    pub fn process(&self, sources: &ModSourceValues) -> ModDestOffsets {
        let mut offsets = ModDestOffsets::default();

        for slot in &self.slots {
            // Skip disabled slots.
            if slot.source == ModSource::None || slot.destination == ModDest::None {
                continue;
            }

            // Get the source value.
            let src_val = sources.get(slot.source);

            // Apply "via" scaling if set.
            let via_val = if slot.via == ModSource::None {
                1.0
            } else {
                sources.get(slot.via)
            };

            // Final modulation value: source * amount * via.
            let mod_val = src_val * slot.amount * via_val;

            // Accumulate into the destination.
            match slot.destination {
                ModDest::OscPitch => offsets.osc_pitch += mod_val,
                ModDest::WtPosition => offsets.wt_position += mod_val,
                ModDest::FmDepth => offsets.fm_depth += mod_val,
                ModDest::GrainPosition => offsets.grain_position += mod_val,
                ModDest::GrainSize => offsets.grain_size += mod_val,
                ModDest::GrainDensity => offsets.grain_density += mod_val,
                ModDest::FilterCutoff => offsets.filter_cutoff += mod_val,
                ModDest::FilterResonance => offsets.filter_resonance += mod_val,
                ModDest::Volume => offsets.volume += mod_val,
                ModDest::Pan => offsets.pan += mod_val,
                ModDest::FmRatio1 => offsets.fm_ratio[0] += mod_val,
                ModDest::FmRatio2 => offsets.fm_ratio[1] += mod_val,
                ModDest::FmRatio3 => offsets.fm_ratio[2] += mod_val,
                ModDest::FmRatio4 => offsets.fm_ratio[3] += mod_val,
                ModDest::FmFeedback1 => offsets.fm_feedback[0] += mod_val,
                ModDest::FmFeedback2 => offsets.fm_feedback[1] += mod_val,
                ModDest::FmFeedback3 => offsets.fm_feedback[2] += mod_val,
                ModDest::FmFeedback4 => offsets.fm_feedback[3] += mod_val,
                ModDest::None => {}
            }
        }

        offsets
    }

    /// Set a modulation routing in a specific slot.
    pub fn set_route(
        &mut self,
        slot_index: usize,
        source: ModSource,
        destination: ModDest,
        amount: f32,
        via: ModSource,
    ) {
        if slot_index < MAX_MOD_SLOTS {
            self.slots[slot_index] = ModSlot {
                source,
                destination,
                amount: amount.clamp(-1.0, 1.0),
                via,
            };
        }
    }

    /// Clear a modulation slot.
    pub fn clear_route(&mut self, slot_index: usize) {
        if slot_index < MAX_MOD_SLOTS {
            self.slots[slot_index] = ModSlot::default();
        }
    }
}
