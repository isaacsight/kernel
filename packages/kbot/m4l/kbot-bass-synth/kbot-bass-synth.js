// kbot Bass Synth — M4L Instrument: genre-morphing bass from pure synthesis
// House=pumping sine sub, Tech=filtered saw, Garage=detuned reese, Trap=808 boom
//
// Monophonic, last-note priority. Genre dial morphs the timbre in real-time.
//
// Inlets:  0 = note pitch (midiparse), 1 = velocity (midiparse), 2 = genre (0-1)
// Outlets: 0 = frequency (Hz), 1 = note-on trigger (bang), 2 = note-off trigger (bang)
//          3 = velocity (0-1), 4 = filter cutoff (Hz), 5 = filter reso (0-4)
//          6 = detune amount (0-1), 7 = drive amount (0-1), 8 = decay ms
//          9 = status text

autowatch = 1;
inlets = 3;
outlets = 10;

var lastVel = 0;
var genre = 0.0;
var heldNote = -1;

// Genre bass profiles
var PROFILES = {
  house:      { cutoff: 400,  reso: 0.5, detune: 0.0, drive: 0.0, decay: 200 },
  tech_house: { cutoff: 600,  reso: 1.0, detune: 0.0, drive: 0.15, decay: 150 },
  uk_garage:  { cutoff: 800,  reso: 0.8, detune: 0.6, drive: 0.1, decay: 250 },
  trap:       { cutoff: 2000, reso: 0.3, detune: 0.0, drive: 0.5, decay: 800 },
};

function lerp(a, b, t) { return a + (b - a) * t; }

function getProfile(g) {
  var keys = ['house', 'tech_house', 'uk_garage', 'trap'];
  var idx = Math.min(Math.floor(g * 3), 2);
  var blend = g * 3 - idx;
  var a = PROFILES[keys[idx]];
  var b = PROFILES[keys[Math.min(idx + 1, 3)]];
  return {
    cutoff: lerp(a.cutoff, b.cutoff, blend),
    reso: lerp(a.reso, b.reso, blend),
    detune: lerp(a.detune, b.detune, blend),
    drive: lerp(a.drive, b.drive, blend),
    decay: lerp(a.decay, b.decay, blend),
  };
}

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function msg_int(v) {
  if (inlet === 1) {
    lastVel = v;
    return;
  }

  if (inlet === 0) {
    if (lastVel > 0) {
      // Note on
      heldNote = v;
      var freq = midiToFreq(v);
      var vel = lastVel / 127.0;
      var prof = getProfile(genre);

      outlet(3, vel);
      outlet(0, freq);
      outlet(4, prof.cutoff);
      outlet(5, prof.reso);
      outlet(6, prof.detune);
      outlet(7, prof.drive);
      outlet(8, prof.decay);
      outlet(1, 'bang');
    } else {
      // Note off
      if (v === heldNote) {
        heldNote = -1;
        outlet(2, 'bang');
      }
    }
  }
}

function msg_float(v) {
  if (inlet === 2) {
    genre = Math.max(0, Math.min(1, v));
    var prof = getProfile(genre);

    // Update filter in real-time even while note is held
    outlet(4, prof.cutoff);
    outlet(5, prof.reso);
    outlet(6, prof.detune);
    outlet(7, prof.drive);
    outlet(8, prof.decay);

    var name = genre < 0.25 ? 'Sub' : genre < 0.5 ? 'Saw' : genre < 0.75 ? 'Reese' : '808';
    outlet(9, 'Bass: ' + name);
  }
}

post('kbot Bass Synth v1.0 — genre-morphing bass synthesis\n');
