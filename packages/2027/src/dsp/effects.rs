//! Audio effects chain: plate reverb, stereo delay, chorus.
//!
//! All effects are lightweight, zero-dependency implementations suitable for
//! real-time audio processing. The `FxChain` struct chains them in series:
//! input (mono) -> chorus -> delay -> reverb -> output (stereo).

// ---------------------------------------------------------------------------
// One-pole lowpass (lightweight, for feedback path filtering)
// ---------------------------------------------------------------------------

/// Simple one-pole lowpass filter for use in feedback paths.
struct OnePole {
    z1: f32,
    a: f32,
}

impl OnePole {
    fn new() -> Self {
        Self { z1: 0.0, a: 0.0 }
    }

    fn set_freq(&mut self, freq: f32, sr: f32) {
        let w = (std::f32::consts::TAU * freq / sr).min(1.0);
        self.a = w / (1.0 + w);
    }

    #[inline]
    fn process(&mut self, input: f32) -> f32 {
        self.z1 += self.a * (input - self.z1);
        self.z1
    }

    fn reset(&mut self) {
        self.z1 = 0.0;
    }
}

// ---------------------------------------------------------------------------
// Plate Reverb (Schroeder/Freeverb-style)
// ---------------------------------------------------------------------------

/// Maximum delay length in samples for comb/allpass buffers.
const MAX_REVERB_SAMPLES: usize = 8192;

/// Single comb filter with damping.
struct CombFilter {
    buffer: Vec<f32>,
    index: usize,
    length: usize,
    feedback: f32,
    damp1: f32,
    damp2: f32,
    filterstore: f32,
}

impl CombFilter {
    fn new(length: usize) -> Self {
        Self {
            buffer: vec![0.0; length.max(1)],
            index: 0,
            length: length.max(1),
            feedback: 0.5,
            damp1: 0.5,
            damp2: 0.5,
            filterstore: 0.0,
        }
    }

    fn set_feedback(&mut self, feedback: f32) {
        self.feedback = feedback;
    }

    fn set_damp(&mut self, damp: f32) {
        self.damp1 = damp;
        self.damp2 = 1.0 - damp;
    }

    #[inline]
    fn process(&mut self, input: f32) -> f32 {
        let output = self.buffer[self.index];

        // One-pole lowpass in feedback path for damping
        self.filterstore = output * self.damp2 + self.filterstore * self.damp1;

        self.buffer[self.index] = input + self.filterstore * self.feedback;

        self.index += 1;
        if self.index >= self.length {
            self.index = 0;
        }

        output
    }

    fn reset(&mut self) {
        self.buffer.fill(0.0);
        self.filterstore = 0.0;
        self.index = 0;
    }
}

/// Single allpass filter.
struct AllpassFilter {
    buffer: Vec<f32>,
    index: usize,
    length: usize,
    feedback: f32,
}

impl AllpassFilter {
    fn new(length: usize) -> Self {
        Self {
            buffer: vec![0.0; length.max(1)],
            index: 0,
            length: length.max(1),
            feedback: 0.5,
        }
    }

    #[inline]
    fn process(&mut self, input: f32) -> f32 {
        let buffered = self.buffer[self.index];
        let output = -input + buffered;

        self.buffer[self.index] = input + buffered * self.feedback;

        self.index += 1;
        if self.index >= self.length {
            self.index = 0;
        }

        output
    }

    fn reset(&mut self) {
        self.buffer.fill(0.0);
        self.index = 0;
    }
}

/// Plate reverb: 8 parallel comb filters + 4 series allpass filters.
/// Stereo output via different comb delay lengths for L/R.
pub struct PlateReverb {
    /// Left channel: 4 comb filters.
    combs_l: [CombFilter; 4],
    /// Right channel: 4 comb filters (slightly different lengths for stereo).
    combs_r: [CombFilter; 4],
    /// 4 allpass filters in series (shared, applied to each channel).
    allpass_l: [AllpassFilter; 4],
    allpass_r: [AllpassFilter; 4],
    /// Room size (0-1), controls comb feedback.
    pub room_size: f32,
    /// Damping (0-1), controls high-frequency absorption.
    pub damping: f32,
    /// Wet/dry mix (0-1).
    pub wet: f32,
    sample_rate: f32,
}

/// Comb delay lengths at 44100 Hz (Freeverb-style tuning).
/// Left channel uses these directly, right adds a stereo spread offset.
const COMB_LENGTHS_L: [usize; 4] = [1116, 1188, 1277, 1356];
const COMB_LENGTHS_R: [usize; 4] = [1139, 1211, 1300, 1379];
const ALLPASS_LENGTHS_L: [usize; 4] = [556, 441, 341, 225];
const ALLPASS_LENGTHS_R: [usize; 4] = [579, 464, 364, 248];

impl PlateReverb {
    pub fn new(sample_rate: f32) -> Self {
        let sr_ratio = sample_rate / 44100.0;

        let scale = |len: usize| -> usize {
            ((len as f32 * sr_ratio) as usize).max(1)
        };

        let combs_l = [
            CombFilter::new(scale(COMB_LENGTHS_L[0])),
            CombFilter::new(scale(COMB_LENGTHS_L[1])),
            CombFilter::new(scale(COMB_LENGTHS_L[2])),
            CombFilter::new(scale(COMB_LENGTHS_L[3])),
        ];
        let combs_r = [
            CombFilter::new(scale(COMB_LENGTHS_R[0])),
            CombFilter::new(scale(COMB_LENGTHS_R[1])),
            CombFilter::new(scale(COMB_LENGTHS_R[2])),
            CombFilter::new(scale(COMB_LENGTHS_R[3])),
        ];
        let allpass_l = [
            AllpassFilter::new(scale(ALLPASS_LENGTHS_L[0])),
            AllpassFilter::new(scale(ALLPASS_LENGTHS_L[1])),
            AllpassFilter::new(scale(ALLPASS_LENGTHS_L[2])),
            AllpassFilter::new(scale(ALLPASS_LENGTHS_L[3])),
        ];
        let allpass_r = [
            AllpassFilter::new(scale(ALLPASS_LENGTHS_R[0])),
            AllpassFilter::new(scale(ALLPASS_LENGTHS_R[1])),
            AllpassFilter::new(scale(ALLPASS_LENGTHS_R[2])),
            AllpassFilter::new(scale(ALLPASS_LENGTHS_R[3])),
        ];

        let mut reverb = Self {
            combs_l,
            combs_r,
            allpass_l,
            allpass_r,
            room_size: 0.6,
            damping: 0.5,
            wet: 0.15,
            sample_rate,
        };
        reverb.update_params();
        reverb
    }

    /// Apply room_size and damping to the internal comb filters.
    fn update_params(&mut self) {
        let feedback = self.room_size * 0.28 + 0.7; // Map 0-1 -> 0.7-0.98
        let damp = self.damping;

        for comb in self.combs_l.iter_mut().chain(self.combs_r.iter_mut()) {
            comb.set_feedback(feedback);
            comb.set_damp(damp);
        }
        for ap in self.allpass_l.iter_mut().chain(self.allpass_r.iter_mut()) {
            ap.feedback = 0.5;
        }
    }

    /// Set reverb parameters. Call before processing if params change.
    pub fn set_params(&mut self, room_size: f32, damping: f32, wet: f32) {
        self.room_size = room_size.clamp(0.0, 1.0);
        self.damping = damping.clamp(0.0, 1.0);
        self.wet = wet.clamp(0.0, 1.0);
        self.update_params();
    }

    /// Process a mono input sample, returning (left, right) stereo pair.
    #[inline]
    pub fn process(&mut self, input: f32) -> (f32, f32) {
        let inp = input * 0.5; // Scale input to avoid clipping in feedback

        // Sum parallel comb filters for each channel
        let mut out_l = 0.0f32;
        for comb in self.combs_l.iter_mut() {
            out_l += comb.process(inp);
        }

        let mut out_r = 0.0f32;
        for comb in self.combs_r.iter_mut() {
            out_r += comb.process(inp);
        }

        // Series allpass filters
        for ap in self.allpass_l.iter_mut() {
            out_l = ap.process(out_l);
        }
        for ap in self.allpass_r.iter_mut() {
            out_r = ap.process(out_r);
        }

        // Wet/dry mix
        let dry = 1.0 - self.wet;
        (
            input * dry + out_l * self.wet,
            input * dry + out_r * self.wet,
        )
    }

    pub fn reset(&mut self) {
        for comb in self.combs_l.iter_mut().chain(self.combs_r.iter_mut()) {
            comb.reset();
        }
        for ap in self.allpass_l.iter_mut().chain(self.allpass_r.iter_mut()) {
            ap.reset();
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate;
        *self = Self::new(sample_rate);
        // Preserve user params
        self.update_params();
    }
}

// ---------------------------------------------------------------------------
// Stereo Delay
// ---------------------------------------------------------------------------

/// Maximum delay buffer: ~2 seconds at 96kHz.
const MAX_DELAY_SAMPLES: usize = 192_000;

/// Stereo delay with feedback and lowpass in feedback path.
pub struct StereoDelay {
    buffer_l: Vec<f32>,
    buffer_r: Vec<f32>,
    write_pos: usize,
    /// Delay time in seconds (left channel). Right = left * 1.02 for subtle widening.
    pub delay_time: f32,
    /// Feedback amount (0-1).
    pub feedback: f32,
    /// Wet/dry mix (0-1).
    pub wet: f32,
    /// Lowpass cutoff in feedback path (Hz).
    pub feedback_lp_freq: f32,
    lp_l: OnePole,
    lp_r: OnePole,
    sample_rate: f32,
    delay_samples_l: usize,
    delay_samples_r: usize,
}

impl StereoDelay {
    pub fn new(sample_rate: f32) -> Self {
        let buf_size = ((sample_rate * 2.0) as usize).min(MAX_DELAY_SAMPLES);
        let mut lp_l = OnePole::new();
        let mut lp_r = OnePole::new();
        lp_l.set_freq(4000.0, sample_rate);
        lp_r.set_freq(4000.0, sample_rate);

        Self {
            buffer_l: vec![0.0; buf_size],
            buffer_r: vec![0.0; buf_size],
            write_pos: 0,
            delay_time: 0.375, // Dotted 8th at 120 BPM
            feedback: 0.3,
            wet: 0.2,
            feedback_lp_freq: 4000.0,
            lp_l,
            lp_r,
            sample_rate,
            delay_samples_l: (0.375 * sample_rate) as usize,
            delay_samples_r: (0.375 * 1.02 * sample_rate) as usize,
        }
    }

    /// Set delay time in seconds. Updates internal delay length.
    pub fn set_delay_time(&mut self, time_secs: f32) {
        self.delay_time = time_secs.clamp(0.001, 2.0);
        let buf_len = self.buffer_l.len();
        self.delay_samples_l = ((self.delay_time * self.sample_rate) as usize).min(buf_len - 1);
        self.delay_samples_r =
            ((self.delay_time * 1.02 * self.sample_rate) as usize).min(buf_len - 1);
    }

    /// Compute delay time for a dotted 8th note at given BPM.
    pub fn set_dotted_eighth(&mut self, bpm: f64) {
        if bpm > 0.0 {
            let beat_secs = 60.0 / bpm;
            // Dotted eighth = 3/4 of a beat
            let time = (beat_secs * 0.75) as f32;
            self.set_delay_time(time);
        }
    }

    pub fn set_params(&mut self, delay_time: f32, feedback: f32, wet: f32) {
        self.set_delay_time(delay_time);
        self.feedback = feedback.clamp(0.0, 0.95); // Cap to prevent runaway
        self.wet = wet.clamp(0.0, 1.0);
    }

    /// Process a mono input, returning (left, right) stereo delay output.
    #[inline]
    pub fn process(&mut self, input: f32) -> (f32, f32) {
        let buf_len = self.buffer_l.len();

        // Read from delay buffer
        let read_pos_l = (self.write_pos + buf_len - self.delay_samples_l) % buf_len;
        let read_pos_r = (self.write_pos + buf_len - self.delay_samples_r) % buf_len;

        let delayed_l = self.buffer_l[read_pos_l];
        let delayed_r = self.buffer_r[read_pos_r];

        // Lowpass in feedback path for tape-like feel
        let fb_l = self.lp_l.process(delayed_l) * self.feedback;
        let fb_r = self.lp_r.process(delayed_r) * self.feedback;

        // Write to delay buffer
        self.buffer_l[self.write_pos] = input + fb_l;
        self.buffer_r[self.write_pos] = input + fb_r;

        self.write_pos += 1;
        if self.write_pos >= buf_len {
            self.write_pos = 0;
        }

        // Wet/dry mix
        let dry = 1.0 - self.wet;
        (
            input * dry + delayed_l * self.wet,
            input * dry + delayed_r * self.wet,
        )
    }

    pub fn reset(&mut self) {
        self.buffer_l.fill(0.0);
        self.buffer_r.fill(0.0);
        self.write_pos = 0;
        self.lp_l.reset();
        self.lp_r.reset();
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate;
        let buf_size = ((sample_rate * 2.0) as usize).min(MAX_DELAY_SAMPLES);
        self.buffer_l = vec![0.0; buf_size];
        self.buffer_r = vec![0.0; buf_size];
        self.write_pos = 0;
        self.lp_l.set_freq(self.feedback_lp_freq, sample_rate);
        self.lp_r.set_freq(self.feedback_lp_freq, sample_rate);
        self.set_delay_time(self.delay_time);
    }
}

// ---------------------------------------------------------------------------
// Chorus
// ---------------------------------------------------------------------------

/// Maximum chorus delay in samples (~20ms at 96kHz).
const MAX_CHORUS_SAMPLES: usize = 2048;

/// Simple chorus: LFO-modulated delay line.
pub struct Chorus {
    buffer: Vec<f32>,
    write_pos: usize,
    /// LFO phase (0-1).
    lfo_phase: f32,
    /// LFO rate in Hz.
    pub rate: f32,
    /// Modulation depth (0-1, maps to 0-8ms of delay variation).
    pub depth: f32,
    /// Wet/dry mix (0-1).
    pub wet: f32,
    /// Base delay in seconds (center of modulation).
    base_delay: f32,
    sample_rate: f32,
}

impl Chorus {
    pub fn new(sample_rate: f32) -> Self {
        let buf_size = ((sample_rate * 0.02) as usize).max(256).min(MAX_CHORUS_SAMPLES);
        Self {
            buffer: vec![0.0; buf_size],
            write_pos: 0,
            lfo_phase: 0.0,
            rate: 1.5,
            depth: 0.3,
            wet: 0.15,
            base_delay: 0.005, // 5ms center delay
            sample_rate,
        }
    }

    pub fn set_params(&mut self, rate: f32, depth: f32, wet: f32) {
        self.rate = rate.clamp(0.1, 10.0);
        self.depth = depth.clamp(0.0, 1.0);
        self.wet = wet.clamp(0.0, 1.0);
    }

    /// Process mono input, returns mono output (chorus is applied pre-stereo split).
    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        let buf_len = self.buffer.len();

        // Write to buffer
        self.buffer[self.write_pos] = input;

        // LFO (sine)
        let lfo = (self.lfo_phase * std::f32::consts::TAU).sin();
        self.lfo_phase += self.rate / self.sample_rate;
        if self.lfo_phase >= 1.0 {
            self.lfo_phase -= 1.0;
        }

        // Modulated delay time: base +/- depth * 4ms
        let mod_delay_secs = self.base_delay + lfo * self.depth * 0.004;
        let delay_samples = (mod_delay_secs * self.sample_rate).clamp(1.0, (buf_len - 1) as f32);

        // Fractional delay with linear interpolation
        let delay_int = delay_samples as usize;
        let delay_frac = delay_samples - delay_int as f32;

        let read_pos_a = (self.write_pos + buf_len - delay_int) % buf_len;
        let read_pos_b = (self.write_pos + buf_len - delay_int - 1) % buf_len;

        let delayed = self.buffer[read_pos_a] * (1.0 - delay_frac)
            + self.buffer[read_pos_b] * delay_frac;

        self.write_pos += 1;
        if self.write_pos >= buf_len {
            self.write_pos = 0;
        }

        // Wet/dry mix
        input * (1.0 - self.wet) + delayed * self.wet
    }

    pub fn reset(&mut self) {
        self.buffer.fill(0.0);
        self.write_pos = 0;
        self.lfo_phase = 0.0;
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate;
        let buf_size = ((sample_rate * 0.02) as usize).max(256).min(MAX_CHORUS_SAMPLES);
        self.buffer = vec![0.0; buf_size];
        self.write_pos = 0;
    }
}

// ---------------------------------------------------------------------------
// FxChain — chains: input (mono) -> chorus -> delay -> reverb -> output (stereo)
// ---------------------------------------------------------------------------

/// Complete effects chain: chorus -> delay -> reverb.
/// Takes mono input, produces stereo output.
pub struct FxChain {
    pub chorus: Chorus,
    pub delay: StereoDelay,
    pub reverb: PlateReverb,
    /// Bypass flags for each effect.
    pub chorus_bypass: bool,
    pub delay_bypass: bool,
    pub reverb_bypass: bool,
}

impl FxChain {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            chorus: Chorus::new(sample_rate),
            delay: StereoDelay::new(sample_rate),
            reverb: PlateReverb::new(sample_rate),
            chorus_bypass: false,
            delay_bypass: false,
            reverb_bypass: false,
        }
    }

    /// Set sample rate on all effects (call from plugin initialize).
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.chorus.set_sample_rate(sample_rate);
        self.delay.set_sample_rate(sample_rate);
        self.reverb.set_sample_rate(sample_rate);
    }

    /// Process a mono input through the effects chain.
    /// Returns (left, right) stereo pair.
    #[inline]
    pub fn process(&mut self, input: f32) -> (f32, f32) {
        // Stage 1: Chorus (mono -> mono)
        let post_chorus = if self.chorus_bypass {
            input
        } else {
            self.chorus.process(input)
        };

        // Stage 2: Delay (mono -> stereo)
        let (del_l, del_r) = if self.delay_bypass {
            (post_chorus, post_chorus)
        } else {
            self.delay.process(post_chorus)
        };

        // Stage 3: Reverb (each channel independently, mono -> stereo)
        // We feed L and R separately and blend the reverb stereo output
        if self.reverb_bypass {
            (del_l, del_r)
        } else {
            let (rev_ll, _rev_lr) = self.reverb.process(del_l);
            // For the right channel, we just use the reverb's right output
            // to maintain the stereo image from delay
            let (_rev_rl, rev_rr) = self.reverb.process(del_r);
            // Blend: left takes left-reverb-left, right takes right-reverb-right
            // This keeps the stereo width from both delay and reverb
            (rev_ll, rev_rr)
        }
    }

    /// Reset all effects (clear delay lines, etc.).
    pub fn reset(&mut self) {
        self.chorus.reset();
        self.delay.reset();
        self.reverb.reset();
    }
}
