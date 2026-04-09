//! Musical intelligence layer for the 2027 synthesizer.
//!
//! Analyzes incoming MIDI in real time to detect chords, scales, energy,
//! and feeds those observations into an agent that outputs modulation
//! signals (AgentX, AgentY) for the synthesis engine.
//!
//! All modules are allocation-free after initialization.

pub mod agent;
pub mod chord_detector;
pub mod energy_tracker;
pub mod musical_context;
pub mod scale_detector;

pub use agent::{Agent, AgentMode};
pub use chord_detector::{ChordDetector, ChordQuality};
pub use energy_tracker::EnergyTracker;
pub use musical_context::MusicalContext;
pub use scale_detector::{ScaleDetector, ScaleType};
