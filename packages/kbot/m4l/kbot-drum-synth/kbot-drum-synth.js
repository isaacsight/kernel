// kbot Drum Synth — M4L Instrument: synthesizes all drums from oscillators + noise
// No samples. Pure synthesis. Kick=sine+pitch env, Snare=noise+sine, Hats=HP noise
//
// Receives MIDI from kbot-genre-morph or any MIDI source.
// Note map: 36=Kick, 37=Rim, 38=Snare, 39=Clap, 42=CH, 46=OH, 70=Shaker
//
// Inlets:  0 = note pitch (from midiparse), 1 = velocity (from midiparse), 2 = genre (float 0-1)
// Outlets: 0 = kick trigger (bang), 1 = kick velocity (float 0-1)
//          2 = snare trigger, 3 = snare velocity
//          4 = hat trigger, 5 = hat velocity, 6 = hat type (0=closed 1=open)
//          7 = status text

autowatch = 1;
inlets = 3;
outlets = 8;

var lastVel = 0;
var genre = 0.0;

// Genre-dependent synth parameters (output via outlet 7 as status)
// The actual DSP params are in the maxpat — this JS routes MIDI to voices

function msg_int(v) {
  if (inlet === 1) {
    // Velocity arrives first (right-to-left from midiparse)
    lastVel = v;
    return;
  }

  if (inlet === 0) {
    // Note pitch
    if (lastVel === 0) return;  // note-off, ignore
    var vel = lastVel / 127.0;

    switch (v) {
      case 36:  // Kick
        outlet(1, vel);
        outlet(0, 'bang');
        break;

      case 38:  // Snare
        outlet(3, vel);
        outlet(2, 'bang');
        break;

      case 39:  // Clap
        outlet(3, vel * 0.9);
        outlet(2, 'bang');
        break;

      case 37:  // Rim / Side Stick
        outlet(3, vel * 0.4);
        outlet(2, 'bang');
        break;

      case 42:  // Closed Hi-Hat
        outlet(5, vel * 0.8);
        outlet(6, 0);
        outlet(4, 'bang');
        break;

      case 46:  // Open Hi-Hat
        outlet(5, vel * 0.7);
        outlet(6, 1);
        outlet(4, 'bang');
        break;

      case 70:  // Shaker
        outlet(5, vel * 0.35);
        outlet(6, 0);
        outlet(4, 'bang');
        break;
    }
  }
}

function msg_float(v) {
  if (inlet === 2) {
    genre = Math.max(0, Math.min(1, v));
    var name = genre < 0.25 ? 'House' : genre < 0.5 ? 'Tech' : genre < 0.75 ? 'Garage' : 'Trap';
    outlet(7, 'Drum Synth: ' + name);
  }
}

function bang() {
  // Reset
  lastVel = 0;
}

post('kbot Drum Synth v1.0 — pure M4L synthesis, no samples\n');
