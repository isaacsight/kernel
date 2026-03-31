// kbot Riser Engine — M4L Instrument: generates transition FX from pure synthesis
// Noise sweeps, snare builds, impacts, reverse swells — all synthesized.
// Auto-triggers at genre transition points or manual trigger via button.
//
// Inlets:  0 = bang (from metro 4n), 1 = type (int 0-4), 2 = intensity (0-1), 3 = trigger (bang)
// Outlets: 0 = noise HP cutoff (Hz for sweep), 1 = noise amplitude (0-1)
//          2 = sub impact freq (Hz), 3 = sub impact amp
//          4 = status text

autowatch = 1;
inlets = 4;
outlets = 5;

var riserType = 0;       // 0=noise sweep, 1=snare build, 2=sub impact, 3=reverse swell, 4=white wash
var intensity = 0.7;
var isRising = false;
var riseStep = 0;
var riseDuration = 32;   // steps (quarter notes)
var autoMode = true;

var TYPE_NAMES = ['Noise Sweep', 'Snare Build', 'Sub Impact', 'Reverse Swell', 'White Wash'];

// Auto-trigger detection: monitors song position for genre boundaries
var lastBar = -1;

function bang() {
  // Check if we should auto-trigger at genre boundaries
  if (autoMode && !isRising) {
    try {
      var song = new LiveAPI('live_set');
      var beatPos = parseFloat(song.get('current_song_time'));
      var currentBar = Math.floor(beatPos / 4);

      // Genre boundaries at bars 152, 312, 472 (8 bars before section change at 160, 320, 480)
      if (lastBar !== currentBar) {
        if (currentBar === 152 || currentBar === 312 || currentBar === 472) {
          startRiser();
        }
      }
      lastBar = currentBar;
    } catch (e) {}
  }

  // Process active riser
  if (isRising) {
    processRiserStep();
  }
}

function startRiser() {
  isRising = true;
  riseStep = 0;
  riseDuration = 32;  // 8 bars at quarter note metro
  outlet(4, 'RISER: ' + TYPE_NAMES[riserType]);
}

function processRiserStep() {
  var progress = riseStep / riseDuration;  // 0 → 1

  switch (riserType) {
    case 0:  // Noise sweep — HP filter sweeps up
      var cutoff = 200 + progress * progress * 12000;  // quadratic sweep 200→12.2kHz
      var amp = 0.2 + progress * intensity * 0.8;
      outlet(0, Math.round(cutoff));
      outlet(1, amp);
      break;

    case 1:  // Snare build — accelerating hits
      var hitProb = progress * progress;  // accelerating density
      if (Math.random() < hitProb * intensity) {
        outlet(0, 2000 + Math.random() * 4000);  // random BP frequency
        outlet(1, 0.3 + progress * 0.7);
      }
      break;

    case 2:  // Sub impact — builds tension then drops
      if (progress < 0.95) {
        // Building: HP filter sweeps up, noise builds
        outlet(0, 200 + progress * 8000);
        outlet(1, progress * intensity * 0.5);
      } else {
        // Impact: sub hit
        outlet(2, 50);   // low frequency impact
        outlet(3, intensity);
        outlet(0, 200);  // cut noise
        outlet(1, 0);
      }
      break;

    case 3:  // Reverse swell — amplitude ramps up, filter opens
      var amp3 = progress * progress * intensity;
      outlet(0, 500 + progress * 6000);
      outlet(1, amp3);
      break;

    case 4:  // White wash — broadband noise fade in
      outlet(0, 200);  // low cutoff = full spectrum
      outlet(1, progress * intensity * 0.6);
      break;
  }

  riseStep++;
  if (riseStep >= riseDuration) {
    isRising = false;
    riseStep = 0;
    // Kill all outputs
    outlet(0, 200);
    outlet(1, 0);
    outlet(2, 0);
    outlet(3, 0);
    outlet(4, 'Ready');
  }
}

function msg_int(v) {
  if (inlet === 1) {
    riserType = Math.max(0, Math.min(4, v));
    outlet(4, TYPE_NAMES[riserType]);
  }
}

function msg_float(v) {
  if (inlet === 2) {
    intensity = Math.max(0, Math.min(1, v));
  }
}

// Manual trigger from inlet 3
function trigger() {
  startRiser();
}

// Also handle bang on inlet 3 as trigger
function anything() {
  if (inlet === 3) startRiser();
}

function set_auto(v) {
  autoMode = (v !== 0);
}

post('kbot Riser Engine v1.0 — synthesized transition FX\n');
