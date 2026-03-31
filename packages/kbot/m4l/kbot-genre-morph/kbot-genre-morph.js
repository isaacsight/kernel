// kbot Genre Morph — Real-time drum pattern morphing engine
// M4L MIDI Effect: House → Tech House → UK Garage → Trap
// Drop on a track with a Drum Rack. Turn the Genre dial to morph between genres.
// Patterns blend smoothly — kick placement, velocity, swing all interpolate.
//
// Inlets:  0 = bang (step trigger from metro)
//          1 = genre position (float 0.0–1.0)
//          2 = play on/off (int 0/1)
//          3 = variation index (int 0–2)
// Outlets: 0 = MIDI note data [pitch, velocity, duration_ms]
//          1 = display text (genre name / status)

autowatch = 1;
inlets = 4;
outlets = 2;

// ─── GM Drum Map (matches standard Drum Rack) ─────────────────────
var KICK    = 36;   // C1
var RIM     = 37;   // C#1
var SNARE   = 38;   // D1
var CLAP    = 39;   // D#1
var LO_TOM  = 41;   // F1
var CH_HAT  = 42;   // F#1
var OH_HAT  = 46;   // A#1
var CRASH   = 49;   // C#2
var RIDE    = 51;   // D#2
var TAMBOUR = 54;   // F#2
var COWBELL = 56;   // G#2
var SHAKER  = 70;   // A#3
var CLAVE   = 75;   // D#4

// ─── State ─────────────────────────────────────────────────────────
var step = 0;           // current 16th note step (0–15)
var genre = 0.0;        // 0.0=House, 0.33=Tech House, 0.66=UK Garage, 1.0=Trap
var playing = true;     // default ON — start generating immediately
var variation = 0;      // 0–2 pattern variation
var barCount = 0;       // tracks bars for auto-fills
var humanize = 0.15;    // velocity humanization (0–1)
var autoBpm = false;    // auto-adjust tempo to match genre

// ─── Genre Target BPMs ────────────────────────────────────────────
var GENRE_BPMS = [124, 126, 132, 140];
var GENRE_NAMES = ['House', 'Tech House', 'UK Garage', 'Trap'];

// ─── Pattern Banks ─────────────────────────────────────────────────
// 16 steps per bar, value = velocity (0 = rest, 1–127 = hit)
// Each genre has 3 regular variations + 1 fill (index 3)

var HOUSE = [
  // Variation 0 — Classic four-on-the-floor
  {
    kick:   [127,0,0,0, 127,0,0,0, 127,0,0,0, 127,0,0,0],
    snare:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    clap:   [0,0,0,0, 120,0,0,0, 0,0,0,0, 120,0,0,0],
    ch_hat: [0,0,90,0, 0,0,90,0, 0,0,90,0, 0,0,90,0],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,60],
    perc:   [0,0,0,70, 0,0,0,0, 0,0,0,70, 0,0,0,0],
    rim:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    swing:  0.0
  },
  // Variation 1 — Driving house (extra kicks + ghost claps)
  {
    kick:   [127,0,0,0, 127,0,0,0, 127,0,0,80, 127,0,0,0],
    snare:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    clap:   [0,0,0,0, 120,0,0,50, 0,0,0,0, 120,0,0,50],
    ch_hat: [80,0,90,0, 80,0,90,0, 80,0,90,0, 80,0,90,0],
    oh_hat: [0,0,0,0, 0,0,0,70, 0,0,0,0, 0,0,0,0],
    perc:   [0,60,0,0, 0,60,0,0, 0,60,0,0, 0,60,0,0],
    rim:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    swing:  0.0
  },
  // Variation 2 — Soulful house (lighter touch, shaker + rim)
  {
    kick:   [120,0,0,0, 120,0,0,0, 120,0,0,0, 120,0,0,0],
    snare:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    clap:   [0,0,0,0, 110,0,0,0, 0,0,0,0, 110,0,0,0],
    ch_hat: [0,0,80,0, 0,0,80,0, 0,0,80,0, 0,0,80,0],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,80],
    perc:   [0,0,0,0, 0,0,60,0, 0,0,0,0, 0,0,60,0],
    rim:    [60,0,0,0, 0,0,0,0, 60,0,0,0, 0,0,0,0],
    swing:  0.05
  },
  // Fill — Build-up to transition
  {
    kick:   [127,0,80,0, 127,0,80,80, 127,80,80,80, 127,100,110,120],
    snare:  [0,0,0,0, 0,0,0,80, 0,0,80,0, 80,0,100,120],
    clap:   [0,0,0,0, 120,0,0,0, 0,0,0,0, 0,100,110,127],
    ch_hat: [90,80,90,80, 90,80,90,80, 100,90,100,90, 110,100,110,120],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,90],
    perc:   [0,0,0,70, 0,70,0,0, 70,0,70,0, 0,70,70,70],
    rim:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    swing:  0.0
  }
];

var TECH_HOUSE = [
  // Variation 0 — Minimal tech (offbeat rim, ghost claps)
  {
    kick:   [127,0,0,0, 127,0,0,0, 127,0,0,0, 127,0,0,0],
    snare:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    clap:   [0,0,0,0, 110,0,0,40, 0,0,0,0, 110,0,0,40],
    ch_hat: [80,0,90,0, 80,0,90,0, 80,0,90,0, 80,0,90,0],
    oh_hat: [0,0,0,0, 0,0,0,70, 0,0,0,0, 0,0,0,70],
    perc:   [0,70,0,0, 0,70,0,0, 0,70,0,0, 0,70,0,0],
    rim:    [0,0,60,0, 0,0,60,0, 0,0,60,0, 0,0,60,0],
    swing:  0.12
  },
  // Variation 1 — Groovy tech (shuffled hats, syncopated perc)
  {
    kick:   [127,0,0,0, 127,0,0,0, 127,0,0,0, 127,0,80,0],
    snare:  [0,0,0,0, 0,0,50,0, 0,0,0,0, 0,0,50,0],
    clap:   [0,0,0,0, 110,0,0,0, 0,0,0,0, 110,0,0,0],
    ch_hat: [90,60,80,60, 90,60,80,60, 90,60,80,60, 90,60,80,60],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,80],
    perc:   [0,0,0,80, 0,0,0,0, 0,0,0,80, 0,0,0,0],
    rim:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    swing:  0.15
  },
  // Variation 2 — Percussive tech (heavy perc, rim pattern)
  {
    kick:   [127,0,0,0, 127,0,0,0, 127,0,0,0, 127,0,0,0],
    snare:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    clap:   [0,0,0,0, 100,0,0,0, 0,0,0,0, 100,0,0,0],
    ch_hat: [70,50,80,50, 70,50,80,50, 70,50,80,50, 70,50,80,50],
    oh_hat: [0,0,0,0, 0,0,0,60, 0,0,0,0, 0,0,0,0],
    perc:   [80,0,0,60, 0,0,80,0, 0,60,0,0, 80,0,60,0],
    rim:    [0,60,0,0, 0,0,0,60, 0,60,0,0, 0,0,0,60],
    swing:  0.18
  },
  // Fill — Rolling build
  {
    kick:   [127,0,0,0, 127,0,0,0, 0,0,0,0, 127,100,110,127],
    snare:  [0,0,0,0, 0,0,60,0, 80,0,80,0, 100,80,100,120],
    clap:   [0,0,0,0, 110,0,0,0, 0,0,0,0, 0,0,110,127],
    ch_hat: [90,80,90,80, 90,80,90,80, 100,90,100,90, 110,100,115,127],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,70, 0,0,0,100],
    perc:   [0,70,0,70, 0,70,0,70, 70,0,70,0, 70,70,70,70],
    rim:    [60,0,60,0, 60,0,60,0, 0,60,0,60, 0,60,60,60],
    swing:  0.10
  }
];

var UK_GARAGE = [
  // Variation 0 — Classic 2-step (the skip-beat kick)
  {
    kick:   [127,0,0,0, 0,0,100,0, 0,0,110,0, 0,0,0,0],
    snare:  [0,0,0,0, 110,0,0,0, 0,0,0,0, 110,0,0,0],
    clap:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    ch_hat: [90,0,80,60, 90,0,80,60, 90,0,80,60, 90,60,80,60],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,80, 0,0,0,0],
    perc:   [0,0,0,60, 0,0,0,0, 0,0,0,0, 0,0,60,0],
    rim:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    swing:  0.25
  },
  // Variation 1 — Bassline garage (deeper kick placement)
  {
    kick:   [127,0,0,0, 0,0,0,100, 0,0,100,0, 0,0,0,0],
    snare:  [0,0,0,0, 110,0,0,0, 0,0,0,0, 110,0,0,0],
    clap:   [0,0,0,0, 100,0,0,0, 0,0,0,0, 100,0,0,0],
    ch_hat: [80,50,70,50, 80,50,70,50, 80,50,70,50, 80,50,70,50],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,80],
    perc:   [0,0,60,0, 0,0,0,0, 0,0,60,0, 0,60,0,0],
    rim:    [0,0,0,0, 0,60,0,0, 0,0,0,0, 0,60,0,0],
    swing:  0.22
  },
  // Variation 2 — Speed garage (driving, busier)
  {
    kick:   [127,0,0,0, 0,0,0,0, 100,0,100,0, 0,0,0,0],
    snare:  [0,0,0,0, 120,0,0,0, 0,0,0,0, 120,0,0,0],
    clap:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    ch_hat: [100,60,90,60, 100,60,90,60, 100,60,90,60, 100,60,90,60],
    oh_hat: [0,0,0,0, 0,0,0,70, 0,0,0,0, 0,0,0,70],
    perc:   [0,0,0,0, 0,0,0,0, 0,0,0,60, 0,0,0,0],
    rim:    [0,0,60,0, 0,0,0,0, 0,0,0,0, 0,0,60,0],
    swing:  0.28
  },
  // Fill — Shuffled build
  {
    kick:   [127,0,0,80, 0,0,100,0, 100,0,100,0, 100,80,100,127],
    snare:  [0,0,0,0, 110,0,0,0, 0,0,80,0, 0,80,100,120],
    clap:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,120],
    ch_hat: [90,70,80,70, 90,70,80,70, 100,80,100,80, 110,100,110,120],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,100],
    perc:   [60,0,60,0, 60,0,60,0, 0,60,0,60, 60,60,60,60],
    rim:    [0,60,0,0, 0,60,0,0, 0,0,60,0, 0,60,0,60],
    swing:  0.20
  }
];

var TRAP = [
  // Variation 0 — Classic trap (808 kick, snare on 3, hat runs)
  {
    kick:   [127,0,0,0, 0,0,0,0, 0,0,0,100, 0,0,0,0],
    snare:  [0,0,0,0, 0,0,0,0, 127,0,0,0, 0,0,0,0],
    clap:   [0,0,0,0, 0,0,0,0, 120,0,0,0, 0,0,0,0],
    ch_hat: [100,80,100,80, 100,80,100,80, 100,80,100,80, 100,90,100,90],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,80],
    perc:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    rim:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    swing:  0.0
  },
  // Variation 1 — Hard trap (double kick, aggressive)
  {
    kick:   [127,0,0,0, 0,0,80,0, 0,0,0,0, 100,0,0,0],
    snare:  [0,0,0,0, 0,0,0,0, 127,0,0,0, 0,0,0,0],
    clap:   [0,0,0,0, 0,0,0,0, 120,0,0,0, 0,0,0,0],
    ch_hat: [110,80,100,70, 110,80,100,70, 110,80,100,80, 110,90,110,100],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,90],
    perc:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    rim:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    swing:  0.0
  },
  // Variation 2 — Bouncy trap (syncopated, melodic-ready)
  {
    kick:   [127,0,0,0, 100,0,0,0, 0,0,0,0, 0,0,100,0],
    snare:  [0,0,0,0, 0,0,0,0, 127,0,0,0, 0,0,0,0],
    clap:   [0,0,0,0, 0,0,0,0, 110,0,0,0, 0,0,0,0],
    ch_hat: [100,70,90,60, 100,70,90,80, 100,80,100,90, 110,100,110,120],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,80, 0,0,0,0],
    perc:   [0,0,0,0, 0,0,0,60, 0,0,0,0, 0,0,0,60],
    rim:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    swing:  0.0
  },
  // Fill — Hi-hat roll crescendo
  {
    kick:   [127,0,0,0, 0,0,0,0, 0,0,0,0, 127,0,0,0],
    snare:  [0,0,0,0, 0,0,0,0, 127,0,0,0, 0,0,100,127],
    clap:   [0,0,0,0, 0,0,0,0, 120,0,0,0, 0,0,0,127],
    ch_hat: [100,90,100,90, 105,95,105,95, 110,100,110,100, 115,110,120,127],
    oh_hat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,100],
    perc:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    rim:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    swing:  0.0
  }
];

var ALL_GENRES = [HOUSE, TECH_HOUSE, UK_GARAGE, TRAP];

// Drum elements and their MIDI note mappings
var ELEMENTS = ['kick', 'snare', 'clap', 'ch_hat', 'oh_hat', 'perc', 'rim'];
var ELEMENT_NOTES = [KICK, SNARE, CLAP, CH_HAT, OH_HAT, SHAKER, RIM];

// ─── Core Functions ────────────────────────────────────────────────

/**
 * Maps genre dial position (0–1) to a pair of genres and blend factor.
 * 0.0 = pure House, 0.33 = pure Tech House, 0.66 = pure UK Garage, 1.0 = pure Trap
 */
function getGenreBlend(pos) {
  var scaled = pos * 3;  // 0–3
  var idx = Math.min(Math.floor(scaled), 2);
  var blend = scaled - idx;
  return { a: idx, b: Math.min(idx + 1, 3), blend: blend };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Adds human feel to velocity values. Slight randomization around the target.
 */
function humanizeVel(vel) {
  if (vel <= 0) return 0;
  var range = vel * humanize * 0.25;
  var offset = (Math.random() - 0.5) * 2 * range;
  return Math.max(1, Math.min(127, Math.round(vel + offset)));
}

// ─── Main Step Handler ─────────────────────────────────────────────

function bang() {
  if (!playing) return;

  // Every 8th bar, the last half triggers a fill pattern
  var isFill = (barCount % 8 === 7) && (step >= 8);
  var varIdx = isFill ? 3 : (variation % 3);

  // Get blend between two adjacent genres
  var gb = getGenreBlend(genre);
  var patA = ALL_GENRES[gb.a][varIdx];
  var patB = ALL_GENRES[gb.b][varIdx];

  // Walk each drum element, interpolate velocity, fire if > 0
  for (var i = 0; i < ELEMENTS.length; i++) {
    var elem = ELEMENTS[i];
    var velA = patA[elem][step] || 0;
    var velB = patB[elem][step] || 0;
    var vel = Math.round(lerp(velA, velB, gb.blend));

    if (vel > 0) {
      vel = humanizeVel(vel);
      // Output [pitch, velocity, duration_ms] — makenote handles note-off
      outlet(0, [ELEMENT_NOTES[i], vel, 80]);
    }
  }

  // Advance sequencer
  step++;
  if (step >= 16) {
    step = 0;
    barCount++;
  }

  // Update status display
  updateDisplay();
}

function updateDisplay() {
  var gb = getGenreBlend(genre);
  var nameA = GENRE_NAMES[gb.a];
  var nameB = GENRE_NAMES[gb.b];
  var bpm = Math.round(lerp(GENRE_BPMS[gb.a], GENRE_BPMS[gb.b], gb.blend));
  var txt;

  if (gb.blend < 0.05) {
    txt = nameA + ' ' + bpm + 'bpm';
  } else if (gb.blend > 0.95) {
    txt = nameB + ' ' + bpm + 'bpm';
  } else {
    txt = nameA + '>' + nameB + ' ' + Math.round(gb.blend * 100) + '% ' + bpm + 'bpm';
  }

  outlet(1, txt);
}

// ─── Inlet Handlers ────────────────────────────────────────────────

function msg_float(v) {
  if (inlet === 1) {
    genre = Math.max(0, Math.min(1, v));

    // Auto-BPM: set Ableton tempo to match genre blend
    if (autoBpm) {
      try {
        var gb = getGenreBlend(genre);
        var bpm = lerp(GENRE_BPMS[gb.a], GENRE_BPMS[gb.b], gb.blend);
        var song = new LiveAPI('live_set');
        song.set('tempo', bpm);
      } catch (e) {
        post('genre-morph: auto-bpm error: ' + e + '\n');
      }
    }

    updateDisplay();
  }
}

function msg_int(v) {
  if (inlet === 2) {
    playing = (v !== 0);
    if (!playing) {
      step = 0;
      barCount = 0;
    }
    outlet(1, playing ? 'Playing' : 'Stopped');
  }
  if (inlet === 3) {
    variation = Math.max(0, Math.min(2, v));
    outlet(1, 'Var ' + variation);
  }
}

// ─── Message Handlers ──────────────────────────────────────────────

function set_humanize(v) {
  humanize = Math.max(0, Math.min(1, v));
}

function set_auto_bpm(v) {
  autoBpm = (v !== 0);
  if (autoBpm) {
    // Immediately apply
    try {
      var gb = getGenreBlend(genre);
      var bpm = lerp(GENRE_BPMS[gb.a], GENRE_BPMS[gb.b], gb.blend);
      var song = new LiveAPI('live_set');
      song.set('tempo', bpm);
      outlet(1, 'BPM: ' + Math.round(bpm));
    } catch (e) {
      post('genre-morph: auto-bpm error: ' + e + '\n');
    }
  }
}

function reset() {
  step = 0;
  barCount = 0;
  outlet(1, 'Reset');
}

// ─── Init ──────────────────────────────────────────────────────────
post('kbot Genre Morph v1.0 loaded\n');
post('Genres: House (0.0) > Tech House (0.33) > UK Garage (0.66) > Trap (1.0)\n');
