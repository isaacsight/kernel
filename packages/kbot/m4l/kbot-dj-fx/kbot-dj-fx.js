// kbot DJ FX — Performance effects controller for DJ sets
// M4L Audio Effect: Filter, Delay, Reverb, Stutter, Brake, Riser
// Uses Max MSP objects for DSP — this JS handles parameter mapping,
// one-knob macros, and effect state management.
//
// Architecture:
//   6 live.dial macros → this JS → parameter messages to MSP objects
//   Each macro controls multiple underlying parameters for "one-knob" feel.
//
// Inlets:  0 = filter macro (float 0–1: 0=LP full, 0.5=flat, 1=HP full)
//          1 = delay macro (float 0–1: 0=off, 1=max feedback+wet)
//          2 = reverb macro (float 0–1: 0=dry, 1=full wash)
//          3 = stutter rate (int 0–5: off, 1bar, 1/2, 1/4, 1/8, 1/16)
//          4 = brake/riser (float -1 to 1: -1=brake, 0=off, 1=riser)
//          5 = master dry/wet (float 0–1)
// Outlets: 0 = filter params [type, cutoff_hz, resonance]
//          1 = delay params [time_ms, feedback, wet]
//          2 = reverb params [size, damp, wet]
//          3 = stutter params [rate_ms, active]
//          4 = brake/riser params [speed, active, type]
//          5 = display text

autowatch = 1;
inlets = 6;
outlets = 6;

// ─── State ─────────────────────────────────────────────────────────
var filterMacro = 0.5;   // center = flat
var delayMacro = 0.0;
var reverbMacro = 0.0;
var stutterRate = 0;     // 0=off
var brakeRiser = 0.0;    // -1..1
var masterWet = 1.0;

// ─── Tempo Info ────────────────────────────────────────────────────
var currentBpm = 128;

function updateTempo() {
  try {
    var song = new LiveAPI('live_set');
    currentBpm = parseFloat(song.get('tempo'));
  } catch (e) {
    currentBpm = 128;
  }
}

// ─── Filter Mapping ────────────────────────────────────────────────
// Single knob: 0 = LP at 200Hz, 0.5 = flat (no filter), 1 = HP at 200Hz
// Resonance peaks near extremes for DJ-style sweep sound

function mapFilter(v) {
  var type, cutoff, reso;

  if (v < 0.48) {
    // Low-pass mode: 0→200Hz, 0.48→20000Hz
    type = 0;  // LP
    var t = v / 0.48;
    cutoff = 200 * Math.pow(100, t);  // 200Hz → 20kHz logarithmic
    reso = 0.3 + (1 - t) * 1.5;       // high reso when deep, low when open
  } else if (v > 0.52) {
    // High-pass mode: 0.52→20Hz, 1.0→8000Hz
    type = 1;  // HP
    var t2 = (v - 0.52) / 0.48;
    cutoff = 20 * Math.pow(400, t2);   // 20Hz → 8kHz logarithmic
    reso = 0.3 + t2 * 1.5;             // high reso when deep
  } else {
    // Dead zone in center = flat / bypass
    type = 0;
    cutoff = 20000;
    reso = 0.0;
  }

  cutoff = Math.max(20, Math.min(20000, cutoff));
  reso = Math.max(0, Math.min(4, reso));

  outlet(0, [type, Math.round(cutoff), reso.toFixed(2)]);
}

// ─── Delay Mapping ─────────────────────────────────────────────────
// Single knob: 0 = off, 0→0.3 = wet increases, 0.3→0.7 = feedback increases, 0.7→1 = freeze
// Delay time synced to tempo (1/4 note)

function mapDelay(v) {
  updateTempo();

  // Quarter note delay time in ms
  var quarterMs = 60000 / currentBpm;
  var delayTime = quarterMs;  // 1/4 note sync

  var wet, feedback;

  if (v < 0.01) {
    // Off
    wet = 0;
    feedback = 0;
  } else if (v < 0.3) {
    // Bring in wet
    wet = (v / 0.3) * 0.5;
    feedback = 0.2;
  } else if (v < 0.7) {
    // Increase feedback
    var t = (v - 0.3) / 0.4;
    wet = 0.5;
    feedback = 0.2 + t * 0.55;  // 0.2 → 0.75
  } else {
    // Freeze zone: high feedback, full wet
    var t2 = (v - 0.7) / 0.3;
    wet = 0.5 + t2 * 0.5;       // 0.5 → 1.0
    feedback = 0.75 + t2 * 0.2;  // 0.75 → 0.95 (never 1.0, avoid infinite)
  }

  outlet(1, [Math.round(delayTime), feedback.toFixed(3), wet.toFixed(3)]);
}

// ─── Reverb Mapping ────────────────────────────────────────────────
// Single knob: 0 = dry, 0.5 = medium room, 1.0 = infinite wash

function mapReverb(v) {
  var size, damp, wet;

  if (v < 0.01) {
    size = 0.2;
    damp = 0.8;
    wet = 0;
  } else {
    size = 0.2 + v * 0.78;        // 0.2 → 0.98
    damp = 0.8 - v * 0.6;         // 0.8 → 0.2 (less damping = longer tail)
    wet = v * 0.8;                 // 0 → 0.8
  }

  outlet(2, [size.toFixed(3), damp.toFixed(3), wet.toFixed(3)]);
}

// ─── Stutter Mapping ───────────────────────────────────────────────
// Quantized to musical divisions

function mapStutter(rate) {
  updateTempo();
  var quarterMs = 60000 / currentBpm;

  var rateMs, active;

  switch (rate) {
    case 0: rateMs = 0; active = 0; break;             // off
    case 1: rateMs = quarterMs * 4; active = 1; break;  // 1 bar
    case 2: rateMs = quarterMs * 2; active = 1; break;  // 1/2
    case 3: rateMs = quarterMs; active = 1; break;       // 1/4
    case 4: rateMs = quarterMs / 2; active = 1; break;   // 1/8
    case 5: rateMs = quarterMs / 4; active = 1; break;   // 1/16
    default: rateMs = 0; active = 0;
  }

  var names = ['Off', '1 Bar', '1/2', '1/4', '1/8', '1/16'];
  outlet(3, [Math.round(rateMs), active]);
  outlet(5, 'Stutter: ' + names[rate]);
}

// ─── Brake / Riser ─────────────────────────────────────────────────
// Negative = brake (slow down playback), Positive = riser (HP filter sweep + noise)

function mapBrakeRiser(v) {
  if (Math.abs(v) < 0.05) {
    // Dead zone = off
    outlet(4, [1.0, 0, 'off']);
    return;
  }

  if (v < 0) {
    // Brake: speed ramps from 1.0 down to near-zero
    var brakeAmount = Math.abs(v);
    var speed = 1.0 - brakeAmount * 0.95;  // 1.0 → 0.05
    outlet(4, [speed.toFixed(3), 1, 'brake']);
    outlet(5, 'BRAKE ' + Math.round(brakeAmount * 100) + '%');
  } else {
    // Riser: HP filter sweeps up, noise builds
    var riseAmount = v;
    var hpCutoff = 200 * Math.pow(40, riseAmount);  // 200Hz → 8kHz
    outlet(4, [Math.round(hpCutoff), 1, 'riser']);
    outlet(5, 'RISER ' + Math.round(riseAmount * 100) + '%');
  }
}

// ─── Inlet Handlers ────────────────────────────────────────────────

function msg_float(v) {
  switch (inlet) {
    case 0:
      filterMacro = Math.max(0, Math.min(1, v));
      mapFilter(filterMacro);
      break;
    case 1:
      delayMacro = Math.max(0, Math.min(1, v));
      mapDelay(delayMacro);
      break;
    case 2:
      reverbMacro = Math.max(0, Math.min(1, v));
      mapReverb(reverbMacro);
      break;
    case 4:
      brakeRiser = Math.max(-1, Math.min(1, v));
      mapBrakeRiser(brakeRiser);
      break;
    case 5:
      masterWet = Math.max(0, Math.min(1, v));
      break;
  }
}

function msg_int(v) {
  if (inlet === 3) {
    stutterRate = Math.max(0, Math.min(5, v));
    mapStutter(stutterRate);
  }
}

// ─── Utility ───────────────────────────────────────────────────────

function kill() {
  // Panic: reset all effects to clean state
  filterMacro = 0.5;
  delayMacro = 0.0;
  reverbMacro = 0.0;
  stutterRate = 0;
  brakeRiser = 0.0;
  masterWet = 1.0;

  mapFilter(0.5);
  mapDelay(0.0);
  mapReverb(0.0);
  mapStutter(0);
  mapBrakeRiser(0.0);

  outlet(5, 'FX KILLED');
}

function echo_freeze() {
  // Instant echo freeze: max feedback + wet
  delayMacro = 1.0;
  mapDelay(1.0);
  outlet(5, 'ECHO FREEZE');
}

function wash() {
  // Instant reverb wash
  reverbMacro = 1.0;
  mapReverb(1.0);
  outlet(5, 'WASH');
}

// ─── Init ──────────────────────────────────────────────────────────
mapFilter(0.5);
mapDelay(0.0);
mapReverb(0.0);
mapStutter(0);
mapBrakeRiser(0.0);

post('kbot DJ FX v1.0 loaded\n');
post('Effects: Filter | Delay | Reverb | Stutter | Brake/Riser\n');
post('Messages: kill (panic), echo_freeze, wash\n');
