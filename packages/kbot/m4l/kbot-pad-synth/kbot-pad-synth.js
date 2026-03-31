// kbot Pad Synth — M4L Instrument: genre-morphing pad from detuned saws + filter
// House=warm LP+chorus, Tech=tight stab, Garage=lush reverb, Trap=dark atmospheric
//
// Polyphonic (up to 6 voices via poly~ or simple voice stealing).
// Genre dial morphs filter, chorus, reverb, width in real-time.
//
// Inlets:  0 = note pitch, 1 = velocity, 2 = genre (0-1)
// Outlets: 0 = frequency (Hz), 1 = note-on trigger, 2 = note-off trigger
//          3 = velocity (0-1), 4 = filter cutoff, 5 = filter reso
//          6 = chorus depth (0-1), 7 = reverb amount (0-1)
//          8 = status text

autowatch = 1;
inlets = 3;
outlets = 9;

var lastVel = 0;
var genre = 0.0;
var heldNotes = [];

var PROFILES = {
  house:      { cutoff: 2000, reso: 0.5, chorus: 0.4, reverb: 0.3 },
  tech_house: { cutoff: 1200, reso: 1.2, chorus: 0.1, reverb: 0.1 },
  uk_garage:  { cutoff: 5000, reso: 0.3, chorus: 0.7, reverb: 0.7 },
  trap:       { cutoff: 1500, reso: 0.6, chorus: 0.2, reverb: 0.5 },
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
    chorus: lerp(a.chorus, b.chorus, blend),
    reverb: lerp(a.reverb, b.reverb, blend),
  };
}

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function msg_int(v) {
  if (inlet === 1) { lastVel = v; return; }

  if (inlet === 0) {
    if (lastVel > 0) {
      heldNotes.push(v);
      var freq = midiToFreq(v);
      var vel = lastVel / 127.0;
      var prof = getProfile(genre);

      outlet(3, vel);
      outlet(0, freq);
      outlet(4, prof.cutoff);
      outlet(5, prof.reso);
      outlet(6, prof.chorus);
      outlet(7, prof.reverb);
      outlet(1, 'bang');
    } else {
      var idx = heldNotes.indexOf(v);
      if (idx >= 0) heldNotes.splice(idx, 1);
      if (heldNotes.length === 0) {
        outlet(2, 'bang');
      }
    }
  }
}

function msg_float(v) {
  if (inlet === 2) {
    genre = Math.max(0, Math.min(1, v));
    var prof = getProfile(genre);
    outlet(4, prof.cutoff);
    outlet(5, prof.reso);
    outlet(6, prof.chorus);
    outlet(7, prof.reverb);

    var name = genre < 0.25 ? 'Warm' : genre < 0.5 ? 'Stab' : genre < 0.75 ? 'Lush' : 'Dark';
    outlet(8, 'Pads: ' + name);
  }
}

post('kbot Pad Synth v1.0 — genre-morphing pad synthesis\n');
