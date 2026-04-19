//! DSP modules for the 2027 synthesizer.
//!
//! - `wavetable`: Anti-aliased wavetable oscillator with frame morphing
//! - `filter`: Zero-Delay Feedback State Variable Filter (Zavalishin TPT)
//! - `envelope`: Exponential ADSR envelope generator
//! - `fm`: Through-zero FM oscillator with 4 operators and free-routing matrix
//! - `granular`: Granular synthesis engine with overlap-add and Hann windowing
//! - `lfo`: Low-frequency oscillators (sine, tri, saw, square, S&H, chaos)
//! - `mod_matrix`: Modulation routing matrix (32 slots, source → destination)

pub mod drums;
pub mod effects;
pub mod envelope;
pub mod filter;
pub mod fm;
pub mod granular;
pub mod lfo;
pub mod mod_matrix;
pub mod wavetable;
