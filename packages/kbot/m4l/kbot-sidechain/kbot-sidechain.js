// kbot Sidechain — M4L Audio Effect: genre-aware sidechain pumping
// No audio key input needed — generates its own pump envelope from kick positions.
// Knows where the kick lands per genre from the same pattern data as genre-morph.
//
// Inlets:  0 = bang (from metro 16n), 1 = genre (float 0-1), 2 = depth (float 0-1), 3 = release ms
// Outlets: 0 = envelope value (list for line~: "duck_level attack_ms, 1. release_ms")
//          1 = status text

autowatch = 1;
inlets = 4;
outlets = 2;

var step = 0;
var genre = 0.0;
var depth = 0.7;
var releaseMs = 200;

// Kick positions per genre (16-step grid, 1 = kick hit)
var KICK_PATTERNS = {
  house:      [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],  // 4-on-floor
  tech_house: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
  uk_garage:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],  // 2-step
  trap:       [1,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0],   // sparse
};

var GENRE_DEPTHS = [0.8, 0.7, 0.5, 0.2];  // house deepest, trap lightest
var GENRE_RELEASE = [200, 150, 100, 80];

function lerp(a, b, t) { return a + (b - a) * t; }

function getGenreBlend(pos) {
  var scaled = pos * 3;
  var idx = Math.min(Math.floor(scaled), 2);
  return { a: idx, b: Math.min(idx + 1, 3), blend: scaled - idx };
}

function bang() {
  var gb = getGenreBlend(genre);
  var keys = ['house', 'tech_house', 'uk_garage', 'trap'];
  var patA = KICK_PATTERNS[keys[gb.a]];
  var patB = KICK_PATTERNS[keys[gb.b]];

  // Interpolate kick probability
  var kickA = patA[step] || 0;
  var kickB = patB[step] || 0;
  var kickProb = lerp(kickA, kickB, gb.blend);

  if (kickProb > 0.5) {
    // Kick hit — duck the signal
    var genreDepth = lerp(GENRE_DEPTHS[gb.a], GENRE_DEPTHS[gb.b], gb.blend);
    var actualDepth = depth * genreDepth;
    var duckLevel = 1.0 - actualDepth;
    var genreRelease = lerp(GENRE_RELEASE[gb.a], GENRE_RELEASE[gb.b], gb.blend);
    var actualRelease = Math.round(releaseMs > 0 ? releaseMs : genreRelease);

    // Send line~ message: duck quickly (2ms), release over time
    outlet(0, duckLevel + ' 2, 1. ' + actualRelease);
  }

  step = (step + 1) % 16;
}

function msg_float(v) {
  if (inlet === 1) genre = Math.max(0, Math.min(1, v));
  if (inlet === 2) depth = Math.max(0, Math.min(1, v));
  if (inlet === 3) releaseMs = Math.max(10, Math.min(1000, v));
}

function msg_int(v) {
  if (inlet === 1) genre = v / 127.0;  // for MIDI CC control
}

function reset() { step = 0; }

post('kbot Sidechain v1.0 — genre-aware pump envelope\n');
