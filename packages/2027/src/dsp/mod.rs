//! DSP modules for the 2027 synthesizer.
//!
//! - `wavetable`: Anti-aliased wavetable oscillator with frame morphing
//! - `filter`: Zero-Delay Feedback State Variable Filter (Zavalishin TPT)
//! - `envelope`: Exponential ADSR envelope generator

pub mod envelope;
pub mod filter;
pub mod wavetable;
