//! AI intelligence layer for the 2027 synthesizer.
//!
//! This module provides rule-based "intelligence" that makes the synth
//! feel aware and adaptive — no neural networks, no external dependencies.
//!
//! - `text_to_patch`: Natural language → synthesis parameters
//! - `text_to_drums`: Natural language → drum patterns
//! - `session_memory`: JSON-backed user preference learning
//! - `adaptive_dynamics`: Context-aware drum dynamics
//! - `spectral_awareness`: Self-mixing / frequency clash avoidance

pub mod adaptive_dynamics;
pub mod session_memory;
pub mod spectral_awareness;
pub mod text_to_drums;
pub mod text_to_patch;
