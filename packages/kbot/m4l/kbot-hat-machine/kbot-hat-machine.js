// kbot Hat Machine — Hi-hat pattern generator for DJ performance
// M4L MIDI Effect: Generates genre-specific hi-hat patterns in real-time.
// The hat is THE defining element of each genre. This gives you surgical control.
//
// Features:
//   - 6 pattern styles: house offbeat, tech shuffle, garage skip, trap rolls, trap triplet, breakbeat
//   - Density control: from sparse to wall-of-hats
//   - Swing: 0% (straight) to 50% (heavy shuffle)
//   - Humanize: velocity + micro-timing variation
//   - Open hat probability: random open hats for texture
//   - Roll mode: hold to trigger hi-hat roll crescendo
//
// Inlets:  0 = bang (step trigger)
//          1 = style (int 0–5)
//          2 = density (float 0–1)
//          3 = swing (float 0–1)
// Outlets: 0 = MIDI note [pitch, velocity, duration_ms]
//          1 = status text

autowatch = 1;
inlets = 4;
outlets = 2;

// ─── MIDI Notes ────────────────────────────────────────────────────
var CH_HAT  = 42;   // F#1 — Closed Hi-Hat
var OH_HAT  = 46;   // A#1 — Open Hi-Hat
var PD_HAT  = 44;   // G#1 — Pedal Hi-Hat

// ─── State ─────────────────────────────────────────────────────────
var step = 0;           // 0–31 for 32nd note resolution (2 bars of 16ths = 32 steps)
var style = 0;          // 0=house, 1=tech, 2=garage, 3=trap16, 4=trap_triplet, 5=breakbeat
var density = 0.5;      // 0–1, controls how many hits
var swingAmt = 0.0;     // 0–1, shuffle amount
var humanize = 0.15;    // velocity randomization
var openProb = 0.08;    // chance of open hat on any hit
var playing = true;     // default ON
var rollMode = false;    // when true, override pattern with roll

var STYLE_NAMES = ['House', 'Tech Shuffle', 'Garage Skip', 'Trap 16th', 'Trap Triplet', 'Breakbeat'];

// ─── Pattern Definitions ───────────────────────────────────────────
// 32 steps (32nd note resolution for one bar at 16th step grid)
// Actually: 16 steps = 16th notes in one bar. We use 16-step patterns.
// For triplets: we use a different step count.
//
// Values: velocity (0 = rest). These are BASE patterns — density scales them.

var PATTERNS = {
  // 0: House — offbeat 8ths, the classic
  house: {
    base: [0,0,90,0, 0,0,90,0, 0,0,90,0, 0,0,90,0],
    dense:[80,0,100,0, 80,0,100,0, 80,0,100,0, 80,0,100,0],
    full: [80,60,100,60, 80,60,100,60, 80,60,100,60, 80,60,100,60],
    open_steps: [15]  // open hat on last 16th
  },

  // 1: Tech House — shuffled 8ths with ghost notes
  tech: {
    base: [80,0,90,0, 80,0,90,0, 80,0,90,0, 80,0,90,0],
    dense:[90,50,100,50, 90,50,100,50, 90,50,100,50, 90,50,100,50],
    full: [90,60,100,70, 90,60,100,70, 90,60,100,70, 90,60,100,70],
    open_steps: [7, 15]  // open on 8th note before 2 and 4
  },

  // 2: UK Garage — 2-step shuffle, skippy feel
  garage: {
    base: [90,0,80,60, 90,0,80,0, 90,0,80,60, 90,0,80,0],
    dense:[90,50,80,70, 90,60,80,50, 90,50,80,70, 90,60,80,50],
    full: [100,60,90,70, 100,70,90,60, 100,60,90,70, 100,70,90,60],
    open_steps: [11]  // open hat accent
  },

  // 3: Trap — 16th note rolls with velocity accent
  trap16: {
    base: [100,60,80,60, 100,60,80,60, 100,60,80,60, 100,70,90,70],
    dense:[110,70,90,70, 110,70,90,70, 110,80,100,80, 110,90,110,100],
    full: [110,80,100,80, 110,80,100,90, 110,90,110,90, 120,100,120,110],
    open_steps: [15]  // open on last beat
  },

  // 4: Trap Triplet — the classic trap hi-hat roll
  // Simulated via velocity emphasis on triplet positions within 16th grid
  trap_triplet: {
    base: [100,0,80,100, 0,80,100,0, 80,100,0,80, 100,80,100,80],
    dense:[110,60,90,110, 60,90,110,60, 90,110,60,90, 110,90,110,100],
    full: [120,70,100,120, 70,100,120,70, 100,120,80,100, 120,100,120,110],
    open_steps: [15]
  },

  // 5: Breakbeat — syncopated, funky
  breakbeat: {
    base: [90,0,0,80, 0,0,90,0, 0,80,0,0, 90,0,80,0],
    dense:[90,50,60,80, 50,60,90,50, 60,80,50,60, 90,60,80,50],
    full: [100,60,70,90, 60,70,100,60, 70,90,60,70, 100,70,90,60],
    open_steps: [3, 9]
  }
};

var PATTERN_KEYS = ['house', 'tech', 'garage', 'trap16', 'trap_triplet', 'breakbeat'];

// ─── Core Functions ────────────────────────────────────────────────

/**
 * Interpolate between pattern layers based on density.
 * density 0–0.33: base pattern with velocity scaling
 * density 0.33–0.66: blend base → dense
 * density 0.66–1.0: blend dense → full
 */
function getVelocity(patternKey, stepIdx) {
  var p = PATTERNS[patternKey];
  var vel;

  if (density < 0.33) {
    // Scale base pattern velocity
    var scale = density / 0.33;
    vel = p.base[stepIdx] * (0.3 + 0.7 * scale);
  } else if (density < 0.66) {
    // Blend base → dense
    var t = (density - 0.33) / 0.33;
    vel = lerp(p.base[stepIdx], p.dense[stepIdx], t);
  } else {
    // Blend dense → full
    var t2 = (density - 0.66) / 0.34;
    vel = lerp(p.dense[stepIdx], p.full[stepIdx], t2);
  }

  return Math.round(vel);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function humanizeVel(vel) {
  if (vel <= 0) return 0;
  var range = 20 * humanize;
  var offset = (Math.random() - 0.5) * 2 * range;
  return Math.max(1, Math.min(127, Math.round(vel + offset)));
}

function isOpenHatStep(patternKey, stepIdx) {
  var openSteps = PATTERNS[patternKey].open_steps;
  for (var i = 0; i < openSteps.length; i++) {
    if (openSteps[i] === stepIdx) return true;
  }
  // Random open hat based on probability
  return Math.random() < openProb;
}

// ─── Roll Mode ─────────────────────────────────────────────────────
// When roll mode is active, override pattern with rapid hits
var rollStep = 0;

function getRollVelocity() {
  // Crescendo roll: velocity increases over time
  var base = 70;
  var boost = Math.min(rollStep * 3, 57);  // max 127
  rollStep++;
  return Math.min(127, base + boost);
}

// ─── Main Step Handler ─────────────────────────────────────────────

function bang() {
  if (!playing) return;

  var patKey = PATTERN_KEYS[style];

  if (rollMode) {
    // Roll override: rapid closed hats with crescendo
    var rollVel = getRollVelocity();
    outlet(0, [CH_HAT, rollVel, 40]);
    return;
  }

  var vel = getVelocity(patKey, step);

  if (vel > 0) {
    vel = humanizeVel(vel);

    // Decide closed vs open hat
    var isOpen = isOpenHatStep(patKey, step);
    var note = isOpen ? OH_HAT : CH_HAT;
    var dur = isOpen ? 120 : 60;  // open hats ring longer

    outlet(0, [note, vel, dur]);
  }

  // Advance
  step = (step + 1) % 16;

  // Display
  outlet(1, STYLE_NAMES[style] + ' d:' + Math.round(density * 100) + '%');
}

// ─── Inlet Handlers ────────────────────────────────────────────────

function msg_int(v) {
  if (inlet === 1) {
    style = Math.max(0, Math.min(5, v));
    outlet(1, STYLE_NAMES[style]);
  }
}

function msg_float(v) {
  if (inlet === 2) {
    density = Math.max(0, Math.min(1, v));
  }
  if (inlet === 3) {
    swingAmt = Math.max(0, Math.min(1, v));
  }
}

// ─── Message Handlers ──────────────────────────────────────────────

function set_humanize(v) {
  humanize = Math.max(0, Math.min(1, v));
}

function set_open_prob(v) {
  openProb = Math.max(0, Math.min(0.5, v));
}

function set_play(v) {
  playing = (v !== 0);
  if (!playing) {
    step = 0;
    rollStep = 0;
    rollMode = false;
  }
  outlet(1, playing ? STYLE_NAMES[style] : 'Stopped');
}

function roll_on() {
  rollMode = true;
  rollStep = 0;
  outlet(1, 'ROLL');
}

function roll_off() {
  rollMode = false;
  rollStep = 0;
  outlet(1, STYLE_NAMES[style]);
}

function reset() {
  step = 0;
  rollStep = 0;
  rollMode = false;
}

// ─── Init ──────────────────────────────────────────────────────────
post('kbot Hat Machine v1.0 loaded\n');
post('Styles: House(0) Tech(1) Garage(2) Trap16(3) TrapTrip(4) Break(5)\n');
