/**
 * kbot-voice-to-beat.js -- Max JavaScript Voice-to-Beat Engine
 *
 * Captures pitch data from the Max patcher's audio analysis chain
 * (adc~ -> fzero~ or sigmund~), quantizes detected pitches to a musical
 * scale, collects notes over a recording period, writes them into an
 * Ableton Live clip, and optionally generates a full beat around the
 * captured melody.
 *
 * The JS does NOT perform audio analysis itself -- it receives frequency
 * values from the patcher via inlet 0 (from fzero~/sigmund~) and
 * confidence values via inlet 1. The patcher runs audio-rate DSP; this
 * script handles the musical logic.
 *
 * Inlets:
 *   0 = frequency (Hz) from pitch detector
 *   1 = confidence (0-1) from pitch detector
 *   2 = commands (start_listening, stop_listening, set_scale, etc.)
 *
 * Outlets:
 *   0 = status messages (for patcher UI display)
 *   1 = JSON result messages (for kbot bridge)
 *
 * Functions (via inlet 2 or Max messages):
 *   start_listening                -- begin capturing pitch data
 *   stop_listening                 -- stop and process captured pitches
 *   set_scale <scale_json>         -- set quantization scale
 *   set_clip <track> <slot>        -- specify target clip
 *   get_melody                     -- return captured melody
 *   build_beat <params_json>       -- generate a full beat around the melody
 *   clear                          -- reset captured data
 *   set_config <config_json>       -- update configuration
 */

inlets = 3;
outlets = 2;  // 0 = status display, 1 = JSON results
autowatch = 1;

// ── Musical Constants ─────────────────────────────────────────────────────

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

// ── Beat Pattern Library ──────────────────────────────────────────────────

// Each pattern: array of { offset (beats), pitch (MIDI), velocity, duration }
// offset is relative to bar start (0-3.999 in 4/4)
var DRUM_PATTERNS = {
    trap: {
        kick:   [
            { offset: 0.0, velocity: 120, duration: 0.25 },
            { offset: 0.75, velocity: 100, duration: 0.25 },
            { offset: 2.5, velocity: 110, duration: 0.25 }
        ],
        snare:  [
            { offset: 1.0, velocity: 110, duration: 0.25 },
            { offset: 3.0, velocity: 115, duration: 0.25 }
        ],
        hihat:  [
            { offset: 0.0, velocity: 80, duration: 0.125 },
            { offset: 0.25, velocity: 60, duration: 0.125 },
            { offset: 0.5, velocity: 70, duration: 0.125 },
            { offset: 0.75, velocity: 55, duration: 0.125 },
            { offset: 1.0, velocity: 80, duration: 0.125 },
            { offset: 1.25, velocity: 60, duration: 0.125 },
            { offset: 1.5, velocity: 70, duration: 0.125 },
            { offset: 1.75, velocity: 55, duration: 0.125 },
            { offset: 2.0, velocity: 80, duration: 0.125 },
            { offset: 2.25, velocity: 60, duration: 0.125 },
            { offset: 2.5, velocity: 70, duration: 0.125 },
            { offset: 2.75, velocity: 55, duration: 0.125 },
            { offset: 3.0, velocity: 80, duration: 0.125 },
            { offset: 3.25, velocity: 65, duration: 0.125 },
            { offset: 3.5, velocity: 75, duration: 0.125 },
            { offset: 3.625, velocity: 50, duration: 0.0625 },
            { offset: 3.6875, velocity: 45, duration: 0.0625 },
            { offset: 3.75, velocity: 70, duration: 0.125 },
            { offset: 3.875, velocity: 55, duration: 0.0625 },
            { offset: 3.9375, velocity: 50, duration: 0.0625 }
        ],
        open_hat: [
            { offset: 0.5, velocity: 70, duration: 0.25 },
            { offset: 2.5, velocity: 65, duration: 0.25 }
        ]
    },
    boom_bap: {
        kick:   [
            { offset: 0.0, velocity: 120, duration: 0.25 },
            { offset: 1.75, velocity: 95, duration: 0.25 },
            { offset: 2.0, velocity: 115, duration: 0.25 },
            { offset: 3.5, velocity: 90, duration: 0.25 }
        ],
        snare:  [
            { offset: 1.0, velocity: 115, duration: 0.25 },
            { offset: 3.0, velocity: 120, duration: 0.25 }
        ],
        hihat:  [
            { offset: 0.0, velocity: 85, duration: 0.125 },
            { offset: 0.5, velocity: 75, duration: 0.125 },
            { offset: 1.0, velocity: 85, duration: 0.125 },
            { offset: 1.5, velocity: 75, duration: 0.125 },
            { offset: 2.0, velocity: 85, duration: 0.125 },
            { offset: 2.5, velocity: 75, duration: 0.125 },
            { offset: 3.0, velocity: 85, duration: 0.125 },
            { offset: 3.5, velocity: 75, duration: 0.125 }
        ],
        open_hat: []
    },
    lofi: {
        kick:   [
            { offset: 0.0, velocity: 100, duration: 0.25 },
            { offset: 2.0, velocity: 95, duration: 0.25 },
            { offset: 3.25, velocity: 80, duration: 0.25 }
        ],
        snare:  [
            { offset: 1.0, velocity: 90, duration: 0.25 },
            { offset: 3.0, velocity: 95, duration: 0.25 }
        ],
        hihat:  [
            { offset: 0.0, velocity: 70, duration: 0.125 },
            { offset: 0.5, velocity: 55, duration: 0.125 },
            { offset: 1.0, velocity: 65, duration: 0.125 },
            { offset: 1.5, velocity: 50, duration: 0.125 },
            { offset: 2.0, velocity: 70, duration: 0.125 },
            { offset: 2.5, velocity: 55, duration: 0.125 },
            { offset: 3.0, velocity: 65, duration: 0.125 },
            { offset: 3.5, velocity: 50, duration: 0.125 }
        ],
        open_hat: [
            { offset: 1.5, velocity: 55, duration: 0.5 },
            { offset: 3.5, velocity: 50, duration: 0.5 }
        ]
    },
    house: {
        kick:   [
            { offset: 0.0, velocity: 120, duration: 0.25 },
            { offset: 1.0, velocity: 120, duration: 0.25 },
            { offset: 2.0, velocity: 120, duration: 0.25 },
            { offset: 3.0, velocity: 120, duration: 0.25 }
        ],
        snare:  [
            { offset: 1.0, velocity: 100, duration: 0.25 },
            { offset: 3.0, velocity: 105, duration: 0.25 }
        ],
        hihat:  [
            { offset: 0.0, velocity: 80, duration: 0.125 },
            { offset: 0.5, velocity: 90, duration: 0.125 },
            { offset: 1.0, velocity: 80, duration: 0.125 },
            { offset: 1.5, velocity: 90, duration: 0.125 },
            { offset: 2.0, velocity: 80, duration: 0.125 },
            { offset: 2.5, velocity: 90, duration: 0.125 },
            { offset: 3.0, velocity: 80, duration: 0.125 },
            { offset: 3.5, velocity: 90, duration: 0.125 }
        ],
        open_hat: [
            { offset: 0.5, velocity: 75, duration: 0.25 },
            { offset: 1.5, velocity: 75, duration: 0.25 },
            { offset: 2.5, velocity: 75, duration: 0.25 },
            { offset: 3.5, velocity: 75, duration: 0.25 }
        ]
    },
    drill: {
        kick:   [
            { offset: 0.0, velocity: 127, duration: 0.25 },
            { offset: 0.75, velocity: 110, duration: 0.25 },
            { offset: 2.25, velocity: 115, duration: 0.25 },
            { offset: 3.0, velocity: 105, duration: 0.25 }
        ],
        snare:  [
            { offset: 1.0, velocity: 120, duration: 0.25 },
            { offset: 2.0, velocity: 100, duration: 0.125 },
            { offset: 3.0, velocity: 120, duration: 0.25 },
            { offset: 3.5, velocity: 90, duration: 0.125 }
        ],
        hihat:  [
            { offset: 0.0, velocity: 85, duration: 0.0625 },
            { offset: 0.125, velocity: 60, duration: 0.0625 },
            { offset: 0.25, velocity: 75, duration: 0.0625 },
            { offset: 0.375, velocity: 55, duration: 0.0625 },
            { offset: 0.5, velocity: 80, duration: 0.0625 },
            { offset: 0.625, velocity: 58, duration: 0.0625 },
            { offset: 0.75, velocity: 75, duration: 0.0625 },
            { offset: 0.875, velocity: 55, duration: 0.0625 },
            { offset: 1.0, velocity: 85, duration: 0.0625 },
            { offset: 1.125, velocity: 60, duration: 0.0625 },
            { offset: 1.25, velocity: 75, duration: 0.0625 },
            { offset: 1.375, velocity: 55, duration: 0.0625 },
            { offset: 1.5, velocity: 80, duration: 0.0625 },
            { offset: 1.625, velocity: 58, duration: 0.0625 },
            { offset: 1.75, velocity: 75, duration: 0.0625 },
            { offset: 1.875, velocity: 55, duration: 0.0625 },
            { offset: 2.0, velocity: 85, duration: 0.0625 },
            { offset: 2.125, velocity: 60, duration: 0.0625 },
            { offset: 2.25, velocity: 75, duration: 0.0625 },
            { offset: 2.375, velocity: 55, duration: 0.0625 },
            { offset: 2.5, velocity: 80, duration: 0.0625 },
            { offset: 2.625, velocity: 58, duration: 0.0625 },
            { offset: 2.75, velocity: 75, duration: 0.0625 },
            { offset: 2.875, velocity: 55, duration: 0.0625 },
            { offset: 3.0, velocity: 85, duration: 0.0625 },
            { offset: 3.125, velocity: 60, duration: 0.0625 },
            { offset: 3.25, velocity: 75, duration: 0.0625 },
            { offset: 3.375, velocity: 55, duration: 0.0625 },
            { offset: 3.5, velocity: 80, duration: 0.0625 },
            { offset: 3.625, velocity: 58, duration: 0.0625 },
            { offset: 3.75, velocity: 75, duration: 0.0625 },
            { offset: 3.875, velocity: 55, duration: 0.0625 }
        ],
        open_hat: []
    }
};

// GM drum map -- used when writing beat to a drum rack or MIDI track
var DRUM_MAP = {
    kick:     36,   // C1
    snare:    38,   // D1
    clap:     39,   // Eb1
    hihat:    42,   // F#1
    open_hat: 46,   // Bb1
    ride:     51,   // Eb2
    crash:    49,   // C#2
    low_tom:  41,   // F1
    mid_tom:  47,   // B1
    high_tom: 50,   // D2
    perc:     56    // Ab2
};

// ── State ─────────────────────────────────────────────────────────────────

var isListening = false;
var capturedPitches = [];       // Raw: { freq, confidence, timestamp }
var processedNotes = [];        // Quantized: { pitch, start, duration, velocity }
var currentConfidence = 0;
var listenStartTime = 0;

// Configuration
var config = {
    root: "C",
    scale: "minor_pentatonic",
    min_confidence: 0.85,       // Minimum confidence to accept a pitch
    min_frequency: 65.0,        // Lowest frequency to capture (~C2)
    max_frequency: 2100.0,      // Highest frequency to capture (~C7)
    sample_interval: 50,        // ms between pitch samples (patcher metro rate)
    note_min_duration: 0.125,   // Minimum note duration in beats (32nd note)
    velocity_base: 90,          // Base velocity for captured notes
    velocity_range: 30,         // Velocity variation (+/-)
    quantize_strength: 1.0,     // 1.0 = snap to scale, 0.0 = keep original
    time_quantize: 0.0,         // 0 = free, 0.25 = 16th, 0.5 = 8th, 1.0 = quarter
    target_track: 0,
    target_slot: 0,
    beat_style: "trap",         // Default beat style
    beat_bars: 4,               // Beat length in bars
    melody_bars: 4              // Melody clip length
};

// Pitch tracking state
var lastFreq = 0;
var lastNoteOnTime = 0;
var lastMidiNote = -1;
var noteOnActive = false;
var sampleTask = null;

// ── Frequency / MIDI Conversion ───────────────────────────────────────────

/**
 * Convert frequency in Hz to a floating-point MIDI note number.
 * A4 = 440 Hz = MIDI 69.
 */
function freqToMidi(freq) {
    if (freq <= 0) return -1;
    return 69 + 12 * (Math.log(freq / 440.0) / Math.log(2));
}

/**
 * Convert MIDI note number to frequency in Hz.
 */
function midiToFreq(midi) {
    return 440.0 * Math.pow(2, (midi - 69) / 12.0);
}

/**
 * Get the note name for a MIDI note number.
 */
function midiToName(midi) {
    return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

// ── Scale Quantization ────────────────────────────────────────────────────

/**
 * Build the set of all MIDI note numbers in the given scale across the
 * full audible range (MIDI 0-127).
 */
function buildScaleSet(root, scaleName) {
    var intervals = SCALES[scaleName] || SCALES["minor_pentatonic"];
    var rootVal = NOTE_MAP[root] || 0;
    var notes = [];

    for (var oct = -1; oct <= 10; oct++) {
        for (var i = 0; i < intervals.length; i++) {
            var midi = (oct + 1) * 12 + rootVal + intervals[i];
            if (midi >= 0 && midi <= 127) {
                notes.push(midi);
            }
        }
    }
    return notes;
}

/**
 * Quantize a floating-point MIDI pitch to the nearest note in the scale.
 * Returns an integer MIDI note number.
 *
 * quantize_strength controls blend:
 *   1.0 = snap fully to scale
 *   0.0 = round to nearest semitone (chromatic)
 */
function quantizeToScale(midiFloat, scaleNotes, strength) {
    var chromatic = Math.round(midiFloat);

    if (strength <= 0 || scaleNotes.length === 0) {
        return Math.max(0, Math.min(127, chromatic));
    }

    // Find nearest scale note
    var bestNote = scaleNotes[0];
    var bestDist = Math.abs(midiFloat - scaleNotes[0]);

    for (var i = 1; i < scaleNotes.length; i++) {
        var dist = Math.abs(midiFloat - scaleNotes[i]);
        if (dist < bestDist) {
            bestDist = dist;
            bestNote = scaleNotes[i];
        }
        // Early exit -- scale is sorted, once dist increases we passed the closest
        if (scaleNotes[i] > midiFloat + 12) break;
    }

    if (strength >= 1.0) {
        return bestNote;
    }

    // Blend between chromatic and scale-quantized
    var blended = chromatic + (bestNote - chromatic) * strength;
    return Math.round(Math.max(0, Math.min(127, blended)));
}

/**
 * Quantize a time value (in beats) to the nearest grid position.
 * grid = 0 means no quantization (free time).
 */
function quantizeTime(beatPos, grid) {
    if (grid <= 0) return beatPos;
    return Math.round(beatPos / grid) * grid;
}

// ── LOM Helpers ───────────────────────────────────────────────────────────

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

function status(msg) {
    outlet(0, msg);
}

// ── Pitch Input Handling ──────────────────────────────────────────────────

/**
 * Inlet 0: frequency from fzero~ / sigmund~
 * Called by the patcher at the metro rate (every sample_interval ms).
 */
function msg_float(val) {
    if (inlet === 0) {
        handleFrequency(val);
    } else if (inlet === 1) {
        currentConfidence = val;
    }
}

function msg_int(val) {
    if (inlet === 0) {
        handleFrequency(val);
    } else if (inlet === 1) {
        currentConfidence = val / 127.0; // Normalize if sent as 0-127
    }
}

function handleFrequency(freq) {
    if (!isListening) return;
    if (freq <= 0 || isNaN(freq)) return;

    // Filter out-of-range frequencies
    if (freq < config.min_frequency || freq > config.max_frequency) {
        // If we had a note active, end it
        if (noteOnActive) {
            endCurrentNote();
        }
        return;
    }

    // Filter low-confidence detections
    if (currentConfidence < config.min_confidence) {
        if (noteOnActive) {
            endCurrentNote();
        }
        return;
    }

    var now = Date.now();
    var elapsed = (now - listenStartTime) / 1000.0; // seconds

    // Convert to MIDI
    var midiFloat = freqToMidi(freq);
    if (midiFloat < 0) return;

    // Store raw sample
    capturedPitches.push({
        freq: freq,
        midi_float: midiFloat,
        confidence: currentConfidence,
        timestamp: elapsed
    });

    // Detect note onsets and offsets via pitch change
    var quantizedMidi = Math.round(midiFloat);

    if (!noteOnActive) {
        // Start a new note
        noteOnActive = true;
        lastMidiNote = quantizedMidi;
        lastNoteOnTime = elapsed;
        lastFreq = freq;
    } else if (Math.abs(quantizedMidi - lastMidiNote) >= 1) {
        // Pitch changed significantly -- end previous note, start new one
        endCurrentNote();
        noteOnActive = true;
        lastMidiNote = quantizedMidi;
        lastNoteOnTime = elapsed;
        lastFreq = freq;
    }
    // Otherwise: same note continues, do nothing

    // Update status display
    var noteName = midiToName(quantizedMidi);
    status("Listening: " + noteName + " (" + Math.round(freq) + " Hz) conf:" + currentConfidence.toFixed(2));
}

/**
 * End the currently active note and add it to processedNotes.
 */
function endCurrentNote() {
    if (!noteOnActive) return;

    var now = Date.now();
    var elapsed = (now - listenStartTime) / 1000.0;
    var durationSec = elapsed - lastNoteOnTime;

    // Get tempo to convert seconds to beats
    var song = api("live_set");
    var tempo = safeGetNum(song, "tempo") || 120;
    var beatsPerSec = tempo / 60.0;

    var startBeat = lastNoteOnTime * beatsPerSec;
    var durationBeats = durationSec * beatsPerSec;

    // Apply minimum duration
    if (durationBeats < config.note_min_duration) {
        durationBeats = config.note_min_duration;
    }

    // Quantize time
    startBeat = quantizeTime(startBeat, config.time_quantize);
    durationBeats = Math.max(config.note_min_duration, durationBeats);

    // Quantize pitch to scale
    var scaleNotes = buildScaleSet(config.root, config.scale);
    var quantizedPitch = quantizeToScale(lastMidiNote, scaleNotes, config.quantize_strength);

    // Calculate velocity from confidence
    var velocity = Math.floor(
        config.velocity_base +
        (currentConfidence - 0.5) * config.velocity_range * 2
    );
    velocity = Math.max(1, Math.min(127, velocity));

    processedNotes.push({
        pitch: quantizedPitch,
        pitch_name: midiToName(quantizedPitch),
        start: Math.round(startBeat * 10000) / 10000,
        duration: Math.round(durationBeats * 10000) / 10000,
        velocity: velocity,
        original_freq: lastFreq,
        confidence: currentConfidence
    });

    noteOnActive = false;
    lastMidiNote = -1;
}

// ── Command Handlers ──────────────────────────────────────────────────────

function anything() {
    // Only handle commands on inlet 2
    if (inlet !== 2) return;

    var args = arrayfromargs(messagename, arguments);
    var cmd = args[0];
    var rest = args.slice(1).join(" ");

    switch (cmd) {
        case "start_listening":  start_listening(); break;
        case "stop_listening":   stop_listening(); break;
        case "set_scale":        set_scale(rest); break;
        case "set_clip":         set_clip_target(args[1], args[2]); break;
        case "get_melody":       get_melody(); break;
        case "build_beat":       build_beat(rest); break;
        case "clear":            clear(); break;
        case "set_config":       set_config(rest); break;
        default:
            respond({ status: "error", message: "Unknown command: " + cmd });
    }
}

/**
 * Start capturing pitch data from the audio input.
 */
function start_listening() {
    isListening = true;
    capturedPitches = [];
    processedNotes = [];
    currentConfidence = 0;
    listenStartTime = Date.now();
    noteOnActive = false;
    lastMidiNote = -1;

    status("Listening... hum or sing a melody");
    respond({
        status: "ok",
        result: {
            action: "start_listening",
            root: config.root,
            scale: config.scale,
            min_confidence: config.min_confidence
        }
    });
    post("kbot-voice-to-beat: listening started (scale: " + config.root + " " + config.scale + ")\n");
}

/**
 * Stop capturing and process the collected pitches into a melody.
 */
function stop_listening() {
    if (!isListening) {
        respond({ status: "error", message: "Not currently listening" });
        return;
    }

    // End any note in progress
    if (noteOnActive) {
        endCurrentNote();
    }

    isListening = false;

    var durationSec = (Date.now() - listenStartTime) / 1000.0;

    // Post-process: merge very close notes, remove duplicates at same time
    processedNotes = mergeCloseNotes(processedNotes);

    var melody = {
        notes: processedNotes,
        note_count: processedNotes.length,
        raw_sample_count: capturedPitches.length,
        duration_seconds: Math.round(durationSec * 100) / 100,
        root: config.root,
        scale: config.scale,
        quantize_strength: config.quantize_strength
    };

    status("Captured " + processedNotes.length + " notes (" + durationSec.toFixed(1) + "s)");
    respond({ status: "ok", result: { action: "stop_listening", melody: melody } });
    post("kbot-voice-to-beat: captured " + processedNotes.length + " notes from " + capturedPitches.length + " samples\n");
}

/**
 * Set the quantization scale.
 * Accepts: "C minor_pentatonic" or JSON: {"root":"C","scale":"minor_pentatonic"}
 */
function set_scale(scaleStr) {
    if (!scaleStr || scaleStr === "") {
        respond({ status: "error", message: "No scale specified" });
        return;
    }

    // Try JSON first
    try {
        var parsed = JSON.parse(scaleStr);
        if (parsed.root) config.root = parsed.root;
        if (parsed.scale) config.scale = parsed.scale;
    } catch (e) {
        // Parse as "Root Scale" string
        var parts = scaleStr.split(" ");
        if (parts.length >= 2) {
            var root = parts[0];
            var scale = parts.slice(1).join("_");
            if (NOTE_MAP[root] !== undefined) config.root = root;
            if (SCALES[scale]) config.scale = scale;
        } else if (parts.length === 1) {
            // Just a root note
            if (NOTE_MAP[parts[0]] !== undefined) config.root = parts[0];
        }
    }

    var scaleNotes = buildScaleSet(config.root, config.scale);
    status("Scale: " + config.root + " " + config.scale + " (" + (SCALES[config.scale] || []).length + " notes)");
    respond({
        status: "ok",
        result: {
            root: config.root,
            scale: config.scale,
            intervals: SCALES[config.scale] || [],
            note_count: scaleNotes.length
        }
    });
}

/**
 * Set the target clip for writing the melody.
 */
function set_clip_target(track, slot) {
    config.target_track = Number(track) || 0;
    config.target_slot = Number(slot) || 0;

    status("Target: track " + config.target_track + " slot " + config.target_slot);
    respond({
        status: "ok",
        result: {
            target_track: config.target_track,
            target_slot: config.target_slot
        }
    });
}

/**
 * Return the captured melody.
 */
function get_melody() {
    if (processedNotes.length === 0) {
        respond({ status: "ok", result: { notes: [], note_count: 0, message: "No melody captured yet" } });
        return;
    }

    respond({
        status: "ok",
        result: {
            notes: processedNotes,
            note_count: processedNotes.length,
            root: config.root,
            scale: config.scale
        }
    });
}

/**
 * Clear all captured data.
 */
function clear() {
    capturedPitches = [];
    processedNotes = [];
    noteOnActive = false;
    lastMidiNote = -1;
    isListening = false;

    status("Cleared");
    respond({ status: "ok", result: { action: "cleared" } });
}

/**
 * Update configuration.
 */
function set_config(configJson) {
    try {
        var parsed = JSON.parse(configJson);
        for (var key in parsed) {
            if (config.hasOwnProperty(key)) {
                config[key] = parsed[key];
            }
        }
        respond({ status: "ok", result: { config_updated: Object.keys(parsed) } });
    } catch (e) {
        respond({ status: "error", message: "Invalid config JSON: " + e.message });
    }
}

// ── Note Post-Processing ──────────────────────────────────────────────────

/**
 * Merge notes that are very close in time and same pitch.
 * This cleans up jitter from the pitch detector.
 */
function mergeCloseNotes(notes) {
    if (notes.length < 2) return notes;

    var merged = [notes[0]];

    for (var i = 1; i < notes.length; i++) {
        var prev = merged[merged.length - 1];
        var curr = notes[i];

        // Same pitch and starts within the previous note's duration
        if (curr.pitch === prev.pitch && curr.start < prev.start + prev.duration + 0.05) {
            // Extend previous note
            var newEnd = Math.max(prev.start + prev.duration, curr.start + curr.duration);
            prev.duration = Math.round((newEnd - prev.start) * 10000) / 10000;
            prev.velocity = Math.round((prev.velocity + curr.velocity) / 2);
        } else {
            merged.push(curr);
        }
    }

    return merged;
}

// ── Clip Writing ──────────────────────────────────────────────────────────

/**
 * Write an array of notes into a clip on the specified track/slot.
 * Creates the clip if it does not exist.
 */
function writeNotesToClip(track, slot, notes, bars, clipName) {
    var clipSlotPath = "live_set tracks " + track + " clip_slots " + slot;
    var clipPath = clipSlotPath + " clip";
    var clipLength = bars * 4.0;

    // Create clip if needed
    var slotApi = api(clipSlotPath);
    var hasClip = safeGet(slotApi, "has_clip") == 1;
    if (!hasClip) {
        slotApi.call("create_clip", clipLength);
    }

    // Clear existing notes
    var clip = api(clipPath);
    var existingLength = safeGetNum(clip, "length");
    if (existingLength > 0) {
        clip.call("remove_notes", 0, 0, existingLength, 128);
    }

    // Adjust clip length if needed
    if (existingLength !== clipLength) {
        clip.set("loop_end", clipLength);
    }

    // Write notes
    clip.call("begin_add_notes");
    for (var i = 0; i < notes.length; i++) {
        var n = notes[i];
        // Ensure note fits within clip
        if (n.start < clipLength) {
            var dur = Math.min(n.duration, clipLength - n.start);
            clip.call("add_note", n.pitch, n.start, dur, n.velocity, 0);
        }
    }
    clip.call("finish_add_notes");

    // Set clip name
    if (clipName) {
        clip.set("name", clipName);
    }

    return true;
}

// ── Beat Builder ──────────────────────────────────────────────────────────

/**
 * Build a full beat around the captured melody.
 *
 * Writes:
 *   1. The melody to the target track/slot
 *   2. A drum pattern to the next track down (or user-specified drum track)
 *   3. A bass line derived from the melody root notes to the track after that
 *
 * Params JSON:
 *   style:       "trap", "boom_bap", "lofi", "house", "drill"
 *   bars:        number of bars (default 4)
 *   drum_track:  track index for drums (default: target_track + 1)
 *   bass_track:  track index for bass (default: target_track + 2)
 *   melody_slot: slot for melody clip (default: target_slot)
 *   drum_slot:   slot for drum clip (default: target_slot)
 *   bass_slot:   slot for bass clip (default: target_slot)
 *   write_melody: whether to write melody (default: true)
 *   write_drums:  whether to write drums (default: true)
 *   write_bass:   whether to write bass (default: true)
 *   swing:        0-1, swing amount for drums (default: 0)
 *   humanize:     0-1, timing randomization (default: 0.1)
 */
function build_beat(paramsJson) {
    if (processedNotes.length === 0) {
        respond({ status: "error", message: "No melody captured. Run start_listening / stop_listening first." });
        return;
    }

    var params;
    try {
        params = (typeof paramsJson === "string") ? JSON.parse(paramsJson) : {};
    } catch (e) {
        params = {};
    }

    var style = params.style || config.beat_style;
    var bars = params.bars || config.beat_bars;
    var melodyTrack = config.target_track;
    var drumTrack = (params.drum_track !== undefined) ? Number(params.drum_track) : melodyTrack + 1;
    var bassTrack = (params.bass_track !== undefined) ? Number(params.bass_track) : melodyTrack + 2;
    var melodySlot = (params.melody_slot !== undefined) ? Number(params.melody_slot) : config.target_slot;
    var drumSlot = (params.drum_slot !== undefined) ? Number(params.drum_slot) : config.target_slot;
    var bassSlot = (params.bass_slot !== undefined) ? Number(params.bass_slot) : config.target_slot;
    var writeMelody = (params.write_melody !== undefined) ? params.write_melody : true;
    var writeDrums = (params.write_drums !== undefined) ? params.write_drums : true;
    var writeBass = (params.write_bass !== undefined) ? params.write_bass : true;
    var swing = params.swing || 0;
    var humanize = (params.humanize !== undefined) ? params.humanize : 0.1;

    var results = {};

    // 1. Write melody
    if (writeMelody) {
        var melodyNotes = fitMelodyToBars(processedNotes, bars);
        writeNotesToClip(
            melodyTrack, melodySlot, melodyNotes, bars,
            "kbot melody " + config.root + " " + config.scale
        );
        results.melody = {
            track: melodyTrack,
            slot: melodySlot,
            note_count: melodyNotes.length,
            bars: bars
        };
    }

    // 2. Write drums
    if (writeDrums) {
        var drumNotes = generateDrumPattern(style, bars, swing, humanize);
        writeNotesToClip(
            drumTrack, drumSlot, drumNotes, bars,
            "kbot drums " + style
        );
        results.drums = {
            track: drumTrack,
            slot: drumSlot,
            note_count: drumNotes.length,
            style: style,
            bars: bars
        };
    }

    // 3. Write bass
    if (writeBass) {
        var bassNotes = generateBassLine(processedNotes, style, bars);
        writeNotesToClip(
            bassTrack, bassSlot, bassNotes, bars,
            "kbot bass " + config.root + " " + config.scale
        );
        results.bass = {
            track: bassTrack,
            slot: bassSlot,
            note_count: bassNotes.length,
            bars: bars
        };
    }

    results.style = style;
    results.root = config.root;
    results.scale = config.scale;
    results.total_bars = bars;

    status("Beat built: " + style + " (" + bars + " bars)");
    respond({ status: "ok", result: results });
    post("kbot-voice-to-beat: built " + style + " beat -- " + bars + " bars\n");
}

/**
 * Fit the captured melody into the target number of bars.
 * If the melody is shorter, loop it. If longer, truncate.
 */
function fitMelodyToBars(notes, bars) {
    var clipLength = bars * 4.0;

    if (notes.length === 0) return [];

    // Find the total melody duration
    var melodyEnd = 0;
    for (var i = 0; i < notes.length; i++) {
        var end = notes[i].start + notes[i].duration;
        if (end > melodyEnd) melodyEnd = end;
    }

    if (melodyEnd <= 0) return notes;

    // If melody fits within clip, return as-is
    if (melodyEnd <= clipLength) {
        return notes;
    }

    // Truncate notes that extend past the clip
    var fitted = [];
    for (var j = 0; j < notes.length; j++) {
        if (notes[j].start < clipLength) {
            var note = {};
            for (var key in notes[j]) {
                note[key] = notes[j][key];
            }
            note.duration = Math.min(note.duration, clipLength - note.start);
            fitted.push(note);
        }
    }
    return fitted;
}

/**
 * Generate a drum pattern from the library, expanded to the given bar count.
 */
function generateDrumPattern(style, bars, swing, humanize) {
    var pattern = DRUM_PATTERNS[style] || DRUM_PATTERNS["trap"];
    var notes = [];

    var instruments = ["kick", "snare", "hihat", "open_hat"];

    for (var bar = 0; bar < bars; bar++) {
        var barOffset = bar * 4.0;

        for (var inst = 0; inst < instruments.length; inst++) {
            var instName = instruments[inst];
            var midiNote = DRUM_MAP[instName];
            var hits = pattern[instName] || [];

            for (var h = 0; h < hits.length; h++) {
                var hit = hits[h];
                var startBeat = barOffset + hit.offset;

                // Apply swing to off-16th positions
                if (swing > 0) {
                    var sixteenth = hit.offset * 4; // Position in 16ths
                    if (Math.round(sixteenth) % 2 === 1) {
                        startBeat += swing * 0.0625; // Swing the off-16ths
                    }
                }

                // Apply humanization
                if (humanize > 0) {
                    startBeat += (Math.random() - 0.5) * humanize * 0.05;
                    startBeat = Math.max(barOffset, startBeat); // Don't go before bar start
                }

                var vel = hit.velocity;
                // Humanize velocity slightly
                if (humanize > 0) {
                    vel += Math.floor((Math.random() - 0.5) * humanize * 20);
                    vel = Math.max(1, Math.min(127, vel));
                }

                notes.push({
                    pitch: midiNote,
                    start: Math.round(startBeat * 10000) / 10000,
                    duration: hit.duration,
                    velocity: vel
                });
            }
        }
    }

    return notes;
}

/**
 * Generate a bass line derived from the melody.
 * Takes the root notes of each bar from the melody and creates a simple
 * bass pattern (octave down, rhythmic variation per style).
 */
function generateBassLine(melodyNotes, style, bars) {
    if (melodyNotes.length === 0) return [];

    var scaleNotes = buildScaleSet(config.root, config.scale);
    var bassNotes = [];

    // Extract the dominant pitch per bar from the melody
    var pitchPerBar = [];
    for (var bar = 0; bar < bars; bar++) {
        var barStart = bar * 4.0;
        var barEnd = barStart + 4.0;
        var pitchCounts = {};
        var bestPitch = melodyNotes[0].pitch;
        var bestCount = 0;

        for (var i = 0; i < melodyNotes.length; i++) {
            var n = melodyNotes[i];
            if (n.start >= barStart && n.start < barEnd) {
                var pc = n.pitch % 12;
                pitchCounts[pc] = (pitchCounts[pc] || 0) + 1;
                if (pitchCounts[pc] > bestCount) {
                    bestCount = pitchCounts[pc];
                    bestPitch = n.pitch;
                }
            }
        }

        // Drop to bass register (octave 2 or 3)
        var bassPitch = (bestPitch % 12) + 36; // Octave 2
        // Quantize to scale
        bassPitch = quantizeToScale(bassPitch, scaleNotes, 1.0);
        pitchPerBar.push(bassPitch);
    }

    // Generate bass rhythm based on style
    for (var b = 0; b < bars; b++) {
        var barOff = b * 4.0;
        var bp = pitchPerBar[b] || pitchPerBar[0];

        switch (style) {
            case "trap":
                // 808-style: long sub notes on beats 1 and 3, occasional slides
                bassNotes.push({ pitch: bp, start: barOff, duration: 1.75, velocity: 110 });
                bassNotes.push({ pitch: bp, start: barOff + 2.0, duration: 1.5, velocity: 100 });
                // Occasional extra hit
                if (Math.random() > 0.5) {
                    bassNotes.push({ pitch: bp + 12, start: barOff + 3.5, duration: 0.25, velocity: 85 });
                }
                break;

            case "boom_bap":
                // Root notes following the kick pattern
                bassNotes.push({ pitch: bp, start: barOff, duration: 0.75, velocity: 110 });
                bassNotes.push({ pitch: bp, start: barOff + 1.75, duration: 0.5, velocity: 95 });
                bassNotes.push({ pitch: bp, start: barOff + 2.0, duration: 0.75, velocity: 105 });
                if (Math.random() > 0.4) {
                    var fifth = quantizeToScale(bp + 7, scaleNotes, 1.0);
                    bassNotes.push({ pitch: fifth, start: barOff + 3.5, duration: 0.25, velocity: 90 });
                }
                break;

            case "lofi":
                // Sparse, jazzy, some chromatic movement
                bassNotes.push({ pitch: bp, start: barOff, duration: 1.0, velocity: 95 });
                var third = quantizeToScale(bp + 4, scaleNotes, 1.0);
                bassNotes.push({ pitch: third, start: barOff + 2.0, duration: 0.75, velocity: 85 });
                bassNotes.push({ pitch: bp, start: barOff + 3.25, duration: 0.5, velocity: 80 });
                break;

            case "house":
                // Octave pumping bass
                bassNotes.push({ pitch: bp, start: barOff, duration: 0.375, velocity: 110 });
                bassNotes.push({ pitch: bp, start: barOff + 0.5, duration: 0.375, velocity: 100 });
                bassNotes.push({ pitch: bp, start: barOff + 1.0, duration: 0.375, velocity: 110 });
                bassNotes.push({ pitch: bp, start: barOff + 1.5, duration: 0.375, velocity: 100 });
                bassNotes.push({ pitch: bp, start: barOff + 2.0, duration: 0.375, velocity: 110 });
                bassNotes.push({ pitch: bp, start: barOff + 2.5, duration: 0.375, velocity: 100 });
                bassNotes.push({ pitch: bp, start: barOff + 3.0, duration: 0.375, velocity: 110 });
                bassNotes.push({ pitch: bp + 12, start: barOff + 3.5, duration: 0.25, velocity: 95 });
                break;

            case "drill":
                // Aggressive sliding bass
                bassNotes.push({ pitch: bp, start: barOff, duration: 0.5, velocity: 120 });
                bassNotes.push({ pitch: bp, start: barOff + 0.75, duration: 0.5, velocity: 110 });
                var low = Math.max(24, bp - 5);
                low = quantizeToScale(low, scaleNotes, 1.0);
                bassNotes.push({ pitch: low, start: barOff + 2.0, duration: 0.75, velocity: 115 });
                bassNotes.push({ pitch: bp, start: barOff + 3.0, duration: 0.5, velocity: 105 });
                break;

            default:
                // Generic bass pattern
                bassNotes.push({ pitch: bp, start: barOff, duration: 1.0, velocity: 100 });
                bassNotes.push({ pitch: bp, start: barOff + 2.0, duration: 1.0, velocity: 95 });
                break;
        }
    }

    return bassNotes;
}

// ── Initialization ────────────────────────────────────────────────────────

post("kbot-voice-to-beat.js loaded -- " +
    Object.keys(SCALES).length + " scales, " +
    Object.keys(DRUM_PATTERNS).length + " beat styles\n");
post("Usage: start_listening, hum a melody, stop_listening, build_beat\n");
post("Set scale: set_scale C minor_pentatonic\n");
