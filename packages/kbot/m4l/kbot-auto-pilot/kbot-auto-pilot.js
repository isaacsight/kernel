// kbot Auto-Pilot — M4L MIDI Effect: conducts the 20-min set automatically
// Reads song position via LiveAPI, morphs Genre dial from 0→1 over set duration.
// Also coordinates Hat Machine style, Bass/Pad engine Genre, and DJ FX transitions.
//
// Inlets:  0 = bang (from metro 4n), 1 = duration minutes (float), 2 = curve (float -1..1), 3 = active (int)
// Outlets: 0 = genre position (float 0-1), 1 = status text

autowatch = 1;
inlets = 4;
outlets = 2;

var duration = 20.0;    // minutes
var curve = 0.0;        // -1=log, 0=linear, 1=exponential
var active = true;
var startBeat = -1;
var lastGenre = -1;

// Genre names at each quarter
var GENRE_NAMES = ['House', 'Tech House', 'UK Garage', 'Trap'];

function applyCurve(t, c) {
  // c: -1 = logarithmic (fast start), 0 = linear, 1 = exponential (slow start)
  if (c > 0.01) {
    return Math.pow(t, 1 + c * 2);  // exponential
  } else if (c < -0.01) {
    return 1 - Math.pow(1 - t, 1 + Math.abs(c) * 2);  // logarithmic
  }
  return t;  // linear
}

function bang() {
  if (!active) return;

  try {
    var song = new LiveAPI('live_set');
    var currentBeat = parseFloat(song.get('current_song_time'));
    var tempo = parseFloat(song.get('tempo'));
    var isPlaying = parseInt(song.get('is_playing'));

    if (!isPlaying) {
      outlet(1, 'Stopped — waiting for play');
      return;
    }

    // Set start position on first bang while playing
    if (startBeat < 0) {
      startBeat = currentBeat;
    }

    // Calculate elapsed time
    var elapsedBeats = currentBeat - startBeat;
    var elapsedMinutes = elapsedBeats / tempo;  // beats / (beats/min) = minutes
    var progress = Math.max(0, Math.min(1, elapsedMinutes / duration));

    // Apply curve shaping
    var genrePos = applyCurve(progress, curve);

    // Only update if changed significantly (avoid flooding LOM)
    var quantized = Math.round(genrePos * 1000) / 1000;
    if (quantized === lastGenre) return;
    lastGenre = quantized;

    // Output genre position
    outlet(0, genrePos);

    // Find and update kbot devices on all tracks via LiveAPI
    var trackCount = parseInt(song.get('tracks').length / 2);
    for (var t = 0; t < Math.min(trackCount, 10); t++) {
      try {
        var track = new LiveAPI('live_set tracks ' + t);
        var devCount = parseInt(track.get('devices').length / 2);

        for (var d = 0; d < devCount; d++) {
          var dev = new LiveAPI('live_set tracks ' + t + ' devices ' + d);
          var devName = dev.get('name').toString();

          // Genre Morph → set Genre parameter
          if (devName.indexOf('Genre') >= 0 || devName.indexOf('genre') >= 0) {
            setDeviceParam(t, d, 'Genre', genrePos);
          }

          // Hat Machine → set Style based on genre position
          if (devName.indexOf('Hat') >= 0 || devName.indexOf('hat') >= 0) {
            var hatStyle = Math.floor(genrePos * 4);  // 0-3 maps to House/Tech/Garage/Trap styles
            setDeviceParam(t, d, 'Style', Math.min(hatStyle, 5));
          }

          // Bass/Pad engines → set Genre parameter
          if (devName.indexOf('Bass') >= 0 || devName.indexOf('Pad') >= 0) {
            setDeviceParam(t, d, 'Genre', genrePos);
          }
        }
      } catch (e) {
        // Skip tracks that cause errors
      }
    }

    // Display
    var gi = Math.min(Math.floor(genrePos * 4), 3);
    var elapsed = Math.floor(elapsedMinutes);
    var secs = Math.floor((elapsedMinutes - elapsed) * 60);
    var timeStr = elapsed + ':' + (secs < 10 ? '0' : '') + secs;
    outlet(1, timeStr + ' ' + GENRE_NAMES[gi] + ' ' + Math.round(genrePos * 100) + '%');

  } catch (e) {
    outlet(1, 'Error: ' + e);
  }
}

function setDeviceParam(trackIdx, deviceIdx, paramName, value) {
  try {
    var dev = new LiveAPI('live_set tracks ' + trackIdx + ' devices ' + deviceIdx);
    var paramCount = parseInt(dev.get('parameters').length / 2);

    for (var p = 0; p < paramCount; p++) {
      var param = new LiveAPI('live_set tracks ' + trackIdx + ' devices ' + deviceIdx + ' parameters ' + p);
      var name = param.get('name').toString();
      if (name.indexOf(paramName) >= 0) {
        param.set('value', value);
        return;
      }
    }
  } catch (e) {
    // Silent fail for individual parameter sets
  }
}

function msg_float(v) {
  if (inlet === 1) {
    duration = Math.max(1, Math.min(60, v));
    outlet(1, 'Duration: ' + duration + ' min');
  }
  if (inlet === 2) {
    curve = Math.max(-1, Math.min(1, v));
    outlet(1, 'Curve: ' + (curve < -0.1 ? 'Log' : curve > 0.1 ? 'Exp' : 'Linear'));
  }
}

function msg_int(v) {
  if (inlet === 3) {
    active = (v !== 0);
    if (!active) {
      startBeat = -1;
      lastGenre = -1;
    }
    outlet(1, active ? 'Auto-pilot ON' : 'Auto-pilot OFF');
  }
}

function reset() {
  startBeat = -1;
  lastGenre = -1;
  outlet(1, 'Reset');
}

post('kbot Auto-Pilot v1.0 — conducts the 20-min set\n');
