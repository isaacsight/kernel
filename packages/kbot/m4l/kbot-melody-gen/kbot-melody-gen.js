/**
 * kbot-melody-gen.js -- Max JavaScript AI Melody Generator
 *
 * A MIDI Generator device that creates scale-aware melodies from parameters
 * received from kbot. Supports multiple generation styles (trap, drill, lofi,
 * ambient, arpeggio) and writes directly into clips via LOM.
 *
 * Can also output MIDI in real-time (live mode) for jam sessions.
 *
 * Functions:
 *   generate <params_json>        -- Generate melody, write to clip
 *   live_start <params_json>      -- Start real-time MIDI output
 *   live_stop                     -- Stop real-time output
 *   set_params <params_json>      -- Update generation parameters
 *   preview <params_json>         -- Generate and return notes (no write)
 */

inlets = 1;
outlets = 2;  // 0 = MIDI note messages (for live mode), 1 = result messages
autowatch = 1;

// ── Scales ─────────────────────────────────────────────────────────────────

var SCALES = {
    "major":               [0, 2, 4, 5, 7, 9, 11],
    "natural_minor":       [0, 2, 3, 5, 7, 8, 10],
    "harmonic_minor":      [0, 2, 3, 5, 7, 8, 11],
    "melodic_minor":       [0, 2, 3, 5, 7, 9, 11],
    "dorian":              [0, 2, 3, 5, 7, 9, 10],
    "phrygian":            [0, 1, 3, 5, 7, 8, 10],
    "phrygian_dominant":   [0, 1, 4, 5, 7, 8, 10],
    "lydian":              [0, 2, 4, 6, 7, 9, 11],
    "mixolydian":          [0, 2, 4, 5, 7, 9, 10],
    "locrian":             [0, 1, 3, 5, 6, 8, 10],
    "minor_pentatonic":    [0, 3, 5, 7, 10],
    "major_pentatonic":    [0, 2, 4, 7, 9],
    "blues":               [0, 3, 5, 6, 7, 10],
    "whole_tone":          [0, 2, 4, 6, 8, 10],
    "diminished":          [0, 2, 3, 5, 6, 8, 9, 11],
    "chromatic":           [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    "hirajoshi":           [0, 2, 3, 7, 8],
    "minor_pentatonic_b5": [0, 3, 5, 6, 10],
    "hungarian_minor":     [0, 2, 3, 6, 7, 8, 11],
    "japanese":            [0, 1, 5, 7, 8],
    "persian":             [0, 1, 4, 5, 6, 8, 11],
    "arabian":             [0, 2, 4, 5, 6, 8, 10]
};

var NOTE_MAP = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
    "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
};

var NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function noteToMidi(name, octave) {
    var val = NOTE_MAP[name];
    if (val === undefined) val = 0;
    return val + ((octave + 1) * 12);
}

function midiToName(midi) {
    return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

// ── LOM Helpers ────────────────────────────────────────────────────────────

function api(path) {
    return new LiveAPI(null, path);
}

function safeGet(obj, prop) {
    try {
        var val = obj.get(prop);
        if (val && val.length === 1) return val[0];
        return val;
    } catch (e) {
        return null;
    }
}

function safeGetNum(obj, prop) {
    var val = safeGet(obj, prop);
    return (val !== null && val !== undefined) ? Number(val) : 0;
}

function respond(data) {
    outlet(1, JSON.stringify(data));
}

// ── State ──────────────────────────────────────────────────────────────────

var liveMode = false;
var liveParams = null;
var liveTask = null;
var currentStepIndex = 0;

// Default generation parameters
var defaultParams = {
    root: "C",
    scale: "natural_minor",
    octave: 4,
    density: 0.5,
    register: "mid",        // "low", "mid", "high"
    length_bars: 4,
    style: "trap_melody",
    rhythm: "16th",          // "quarter", "8th", "16th", "32nd"
    velocity_curve: "humanize",
    note_length: 0.5,        // beats
    probability: 0.7,
    leap_probability: 0.2,
    repetition: 0.3,
    motif_length: 4,         // notes in a motif
    motif_repetition: 0.5,   // chance of repeating the motif
    swing: 0.0               // 0-1, swing amount
};

// ── Scale Building ─────────────────────────────────────────────────────────

/**
 * Build a full array of MIDI notes in the given scale, across the register range.
 */
function buildScaleNotes(root, scale, register) {
    var intervals = SCALES[scale] || SCALES["natural_minor"];
    var rootVal = NOTE_MAP[root] || 0;

    var octLow, octHigh;
    switch (register) {
        case "low":  octLow = 2; octHigh = 4; break;
        case "high": octLow = 5; octHigh = 7; break;
        case "mid":
        default:     octLow = 3; octHigh = 6; break;
    }

    var notes = [];
    for (var oct = octLow; oct <= octHigh; oct++) {
        for (var i = 0; i < intervals.length; i++) {
            var midi = (oct + 1) * 12 + rootVal + intervals[i];
            if (midi >= 0 && midi <= 127) {
                notes.push(midi);
            }
        }
    }
    return notes;
}

// ── Generation Styles ──────────────────────────────────────────────────────

/**
 * Each style function returns a probability multiplier and note choice modifier
 * for a given step position.
 */
var STYLES = {

    trap_melody: function(step, totalSteps, stepsPerBeat, prevNote, scaleNotes, scaleIdx, p) {
        // Sparse, pentatonic feel, occasional 16th runs, octave jumps
        var isBarStart = (step % (stepsPerBeat * 4) === 0);
        var isBeatStart = (step % stepsPerBeat === 0);

        var prob = p.probability * p.density;
        if (isBarStart) prob = 1.0;  // Always play on bar start
        if (isBeatStart) prob = Math.max(prob, 0.6);

        // Occasional 16th-note runs (2-4 notes)
        var runChance = 0.1;
        if (step % (stepsPerBeat * 2) === 0) runChance = 0.0; // Don't start runs on strong beats

        return {
            probability: prob,
            preferStep: true,          // Prefer stepwise motion
            leapMultiplier: 1.0,
            noteLength: isBeatStart ? p.note_length * 1.5 : p.note_length * 0.7,
            velocityBoost: isBarStart ? 15 : (isBeatStart ? 8 : 0)
        };
    },

    drill_melody: function(step, totalSteps, stepsPerBeat, prevNote, scaleNotes, scaleIdx, p) {
        // Dark, repetitive, minor 2nd intervals, aggressive
        var isBeatStart = (step % stepsPerBeat === 0);
        var isHalfBeat = (step % Math.floor(stepsPerBeat / 2) === 0);

        return {
            probability: isHalfBeat ? 0.8 : 0.3,
            preferStep: true,
            leapMultiplier: 0.5,        // Fewer leaps
            noteLength: p.note_length * 0.6,
            velocityBoost: isBeatStart ? 20 : 5
        };
    },

    lofi_melody: function(step, totalSteps, stepsPerBeat, prevNote, scaleNotes, scaleIdx, p) {
        // Jazz-influenced, longer notes, swing, 7ths
        var isBeatStart = (step % stepsPerBeat === 0);
        var isEveryOther = (step % (stepsPerBeat * 2) === 0);

        return {
            probability: isEveryOther ? 0.9 : (isBeatStart ? 0.5 : 0.1),
            preferStep: false,
            leapMultiplier: 1.5,        // More intervals, jazz-like
            noteLength: p.note_length * 2.0,
            velocityBoost: 0
        };
    },

    ambient: function(step, totalSteps, stepsPerBeat, prevNote, scaleNotes, scaleIdx, p) {
        // Very sparse, long sustained notes, wide intervals
        var isPhrase = (step % (stepsPerBeat * 8) === 0);
        var isBarStart = (step % (stepsPerBeat * 4) === 0);

        return {
            probability: isPhrase ? 0.95 : (isBarStart ? 0.3 : 0.05),
            preferStep: false,
            leapMultiplier: 2.0,        // Wide intervals
            noteLength: p.note_length * 4.0,
            velocityBoost: 0
        };
    },

    arpeggio: function(step, totalSteps, stepsPerBeat, prevNote, scaleNotes, scaleIdx, p) {
        // Sequential scale notes, constant rhythm
        return {
            probability: 0.95,         // Almost always play
            preferStep: true,
            leapMultiplier: 0.0,        // No leaps -- pure sequential
            noteLength: p.note_length * 0.8,
            velocityBoost: (step % (stepsPerBeat * 4) === 0) ? 10 : 0,
            forceSequential: true       // Always go to next scale note
        };
    },

    random_walk: function(step, totalSteps, stepsPerBeat, prevNote, scaleNotes, scaleIdx, p) {
        // Brownian motion, every step has a note
        return {
            probability: p.density,
            preferStep: true,
            leapMultiplier: 0.3,
            noteLength: p.note_length,
            velocityBoost: 0
        };
    },

    chord_tones: function(step, totalSteps, stepsPerBeat, prevNote, scaleNotes, scaleIdx, p) {
        // Emphasize chord tones (root, 3rd, 5th, 7th of the scale)
        var isBeatStart = (step % stepsPerBeat === 0);
        return {
            probability: isBeatStart ? 0.9 : p.density * 0.4,
            preferStep: false,
            leapMultiplier: 1.2,
            noteLength: isBeatStart ? p.note_length * 1.5 : p.note_length,
            velocityBoost: isBeatStart ? 12 : 0,
            preferChordTones: true
        };
    }
};

// ── Core Generation ────────────────────────────────────────────────────────

function generateMelody(params) {
    var p = {};
    // Merge with defaults
    for (var key in defaultParams) {
        p[key] = (params[key] !== undefined) ? params[key] : defaultParams[key];
    }

    var scaleNotes = buildScaleNotes(p.root, p.scale, p.register);
    if (scaleNotes.length === 0) {
        return { notes: [], error: "No scale notes in range" };
    }

    var stepsPerBeat;
    switch (p.rhythm) {
        case "32nd":    stepsPerBeat = 8; break;
        case "16th":    stepsPerBeat = 4; break;
        case "8th":     stepsPerBeat = 2; break;
        case "quarter": stepsPerBeat = 1; break;
        default:        stepsPerBeat = 4;
    }

    var totalSteps = p.length_bars * 4 * stepsPerBeat;
    var stepDuration = 1.0 / stepsPerBeat;

    var styleFn = STYLES[p.style] || STYLES["trap_melody"];

    var notes = [];
    var scaleIdx = Math.floor(scaleNotes.length / 2); // Start in middle
    var prevNote = scaleNotes[scaleIdx];

    // Motif system: generate a short motif, then repeat/vary it
    var motif = [];
    var motifStepCounter = 0;

    for (var step = 0; step < totalSteps; step++) {
        var beat = step * stepDuration;

        // Apply swing to off-beats
        if (p.swing > 0 && step % 2 === 1) {
            beat += stepDuration * p.swing * 0.33;
        }

        // Get style modifiers for this step
        var mod = styleFn(step, totalSteps, stepsPerBeat, prevNote, scaleNotes, scaleIdx, p);

        // Decide whether to play a note
        var shouldPlay = Math.random() < mod.probability;
        if (!shouldPlay) continue;

        // Choose note
        var nextNote;
        var nextIdx = scaleIdx;

        // Motif repetition
        if (motif.length >= p.motif_length && Math.random() < p.motif_repetition && motifStepCounter < motif.length) {
            nextNote = motif[motifStepCounter % motif.length];
            nextIdx = scaleNotes.indexOf(nextNote);
            if (nextIdx < 0) nextIdx = scaleIdx;
            motifStepCounter++;
        }
        // Sequential (arpeggio)
        else if (mod.forceSequential) {
            nextIdx = (scaleIdx + 1) % scaleNotes.length;
            nextNote = scaleNotes[nextIdx];
        }
        // Repetition
        else if (Math.random() < p.repetition && notes.length > 0) {
            nextNote = prevNote;
        }
        // Leap
        else if (Math.random() < p.leap_probability * mod.leapMultiplier) {
            var leap = Math.floor(Math.random() * 5) + 3;
            if (Math.random() < 0.5) leap = -leap;
            nextIdx = Math.max(0, Math.min(scaleNotes.length - 1, scaleIdx + leap));
            nextNote = scaleNotes[nextIdx];
        }
        // Step
        else {
            var stepSize = mod.preferStep ? (Math.random() < 0.7 ? 1 : 2) : (Math.floor(Math.random() * 3) + 1);
            if (Math.random() < 0.5) stepSize = -stepSize;
            nextIdx = Math.max(0, Math.min(scaleNotes.length - 1, scaleIdx + stepSize));
            nextNote = scaleNotes[nextIdx];
        }

        // Velocity
        var velocity;
        switch (p.velocity_curve) {
            case "flat":
                velocity = 100;
                break;
            case "accent":
                velocity = (step % stepsPerBeat === 0) ? 110 : 80;
                break;
            case "crescendo":
                velocity = Math.floor(60 + (step / totalSteps) * 60);
                break;
            case "decrescendo":
                velocity = Math.floor(120 - (step / totalSteps) * 60);
                break;
            case "humanize":
            default:
                velocity = Math.floor(80 + Math.random() * 40);
                break;
        }
        velocity += mod.velocityBoost || 0;
        velocity = Math.min(127, Math.max(1, velocity));

        // Note duration with slight variation
        var duration = mod.noteLength * (0.8 + Math.random() * 0.4);
        duration = Math.max(0.05, duration); // minimum duration

        notes.push({
            pitch: nextNote,
            pitch_name: midiToName(nextNote),
            start: Math.round(beat * 10000) / 10000,  // Clean floating point
            duration: Math.round(duration * 10000) / 10000,
            velocity: velocity
        });

        // Update state
        prevNote = nextNote;
        scaleIdx = nextIdx;

        // Build motif
        if (motif.length < p.motif_length) {
            motif.push(nextNote);
        } else {
            motifStepCounter = 0; // Reset motif counter for next potential repetition
        }
    }

    return {
        notes: notes,
        note_count: notes.length,
        bars: p.length_bars,
        root: p.root,
        scale: p.scale,
        octave: p.octave,
        style: p.style,
        register: p.register
    };
}

// ── Clip Writing ───────────────────────────────────────────────────────────

function writeToClip(track, slot, melody) {
    var clipSlotPath = "live_set tracks " + track + " clip_slots " + slot;
    var clipPath = clipSlotPath + " clip";

    // Create clip if needed
    var slotApi = api(clipSlotPath);
    var hasClip = safeGet(slotApi, "has_clip") == 1;
    if (!hasClip) {
        slotApi.call("create_clip", melody.bars * 4.0);
    }

    // Clear existing notes
    var clip = api(clipPath);
    var clipLength = safeGetNum(clip, "length");
    clip.call("remove_notes", 0, 0, clipLength, 128);

    // Write new notes
    clip.call("begin_add_notes");
    for (var i = 0; i < melody.notes.length; i++) {
        var n = melody.notes[i];
        clip.call("add_note", n.pitch, n.start, n.duration, n.velocity, 0);
    }
    clip.call("finish_add_notes");

    // Set clip name
    clip.set("name", "kbot " + melody.style + " " + melody.root + " " + melody.scale);

    return true;
}

// ── Public Functions ───────────────────────────────────────────────────────

function generate(paramsJson) {
    var params;
    try {
        params = JSON.parse(paramsJson);
    } catch (e) {
        respond({ status: "error", message: "Invalid JSON" });
        return;
    }

    var melody = generateMelody(params);

    if (params.track !== undefined && params.slot !== undefined) {
        writeToClip(Number(params.track), Number(params.slot), melody);
        melody.written_to_clip = true;
        melody.track = params.track;
        melody.slot = params.slot;
    } else {
        melody.written_to_clip = false;
    }

    respond({ status: "ok", result: melody });
    post("kbot-melody-gen: generated " + melody.note_count + " notes (" + melody.style + " in " + melody.root + " " + melody.scale + ")\n");
}

function preview(paramsJson) {
    var params;
    try {
        params = JSON.parse(paramsJson);
    } catch (e) {
        respond({ status: "error", message: "Invalid JSON" });
        return;
    }

    var melody = generateMelody(params);
    melody.written_to_clip = false;
    respond({ status: "ok", result: melody });
}

function set_params(paramsJson) {
    var params;
    try {
        params = JSON.parse(paramsJson);
    } catch (e) {
        respond({ status: "error", message: "Invalid JSON" });
        return;
    }

    for (var key in params) {
        if (defaultParams.hasOwnProperty(key)) {
            defaultParams[key] = params[key];
        }
    }

    if (liveMode && liveParams) {
        for (var k in params) {
            liveParams[k] = params[k];
        }
    }

    respond({ status: "ok", result: { params_updated: Object.keys(params) } });
}

// ── Live Mode (Real-Time MIDI Output) ──────────────────────────────────────

function live_start(paramsJson) {
    var params;
    try {
        params = JSON.parse(paramsJson);
    } catch (e) {
        params = {};
    }

    liveParams = {};
    for (var key in defaultParams) {
        liveParams[key] = (params[key] !== undefined) ? params[key] : defaultParams[key];
    }

    liveMode = true;
    currentStepIndex = 0;

    // Use Max's Task system for timing
    if (liveTask) {
        liveTask.cancel();
    }

    var stepsPerBeat;
    switch (liveParams.rhythm) {
        case "32nd":    stepsPerBeat = 8; break;
        case "16th":    stepsPerBeat = 4; break;
        case "8th":     stepsPerBeat = 2; break;
        case "quarter": stepsPerBeat = 1; break;
        default:        stepsPerBeat = 4;
    }

    // Get tempo from Live
    var song = api("live_set");
    var tempo = safeGetNum(song, "tempo") || 120;
    var msPerStep = (60000 / tempo) / stepsPerBeat;

    var scaleNotes = buildScaleNotes(liveParams.root, liveParams.scale, liveParams.register);
    var scaleIdx = Math.floor(scaleNotes.length / 2);
    var prevNote = scaleNotes[scaleIdx];

    var styleFn = STYLES[liveParams.style] || STYLES["trap_melody"];

    liveTask = new Task(function() {
        if (!liveMode) {
            this.cancel();
            return;
        }

        var mod = styleFn(currentStepIndex, 9999, stepsPerBeat, prevNote, scaleNotes, scaleIdx, liveParams);
        var shouldPlay = Math.random() < mod.probability;

        if (shouldPlay) {
            // Choose note (simplified for real-time)
            var nextIdx;
            if (Math.random() < liveParams.leap_probability) {
                var leap = Math.floor(Math.random() * 4) + 2;
                if (Math.random() < 0.5) leap = -leap;
                nextIdx = Math.max(0, Math.min(scaleNotes.length - 1, scaleIdx + leap));
            } else {
                var step = Math.random() < 0.6 ? 1 : 2;
                if (Math.random() < 0.5) step = -step;
                nextIdx = Math.max(0, Math.min(scaleNotes.length - 1, scaleIdx + step));
            }

            var note = scaleNotes[nextIdx];
            var vel = Math.floor(80 + Math.random() * 40);
            var durMs = mod.noteLength * (60000 / tempo);

            // Output MIDI: [note, velocity] on outlet 0
            outlet(0, note, vel);

            // Schedule note-off
            var noteOffTask = new Task(function() {
                outlet(0, this.note, 0);
            });
            noteOffTask.note = note;
            noteOffTask.schedule(durMs);

            scaleIdx = nextIdx;
            prevNote = note;
        }

        currentStepIndex++;

    }, this);

    liveTask.interval = msPerStep;
    liveTask.repeat();

    respond({ status: "ok", result: { live_mode: true, tempo: tempo, ms_per_step: msPerStep } });
    post("kbot-melody-gen: live mode started (" + tempo + " BPM, " + liveParams.style + ")\n");
}

function live_stop() {
    liveMode = false;
    if (liveTask) {
        liveTask.cancel();
        liveTask = null;
    }

    // Send all-notes-off
    for (var n = 0; n < 128; n++) {
        outlet(0, n, 0);
    }

    respond({ status: "ok", result: { live_mode: false } });
    post("kbot-melody-gen: live mode stopped\n");
}

// ── Initialization ─────────────────────────────────────────────────────────

post("kbot-melody-gen.js loaded -- " + Object.keys(SCALES).length + " scales, " + Object.keys(STYLES).length + " styles\n");
post("Usage: generate '{\"root\":\"D\",\"scale\":\"natural_minor\",\"style\":\"trap_melody\",\"track\":0,\"slot\":0}'\n");
