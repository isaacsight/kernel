/**
 * kbot-drum-loader.js -- Max JavaScript for direct Drum Rack sample loading
 *
 * THIS IS THE FIX for the #1 Ableton integration bug:
 * "browser.load_item() targets the track, not the drum pad"
 *
 * Solution: Bypass the browser entirely. Navigate to the Simpler device
 * inside each drum pad's chain via LOM, and set sample_file_path directly.
 *
 * Runs inside a Max [js] object. Has direct LiveAPI access.
 * This device is a MIDI Effect placed INSIDE a Drum Rack, or called
 * remotely via kbot-bridge for any Drum Rack on any track.
 *
 * Functions (callable from Max messages or from kbot-bridge):
 *   load_sample <rack_track> <rack_device> <pad_note> <file_path>
 *   swap_sample <rack_track> <rack_device> <pad_note> <file_path>
 *   list_pads <rack_track> <rack_device>
 *   get_pad <rack_track> <rack_device> <pad_note>
 *   set_pad_volume <rack_track> <rack_device> <pad_note> <volume>
 *   set_pad_pan <rack_track> <rack_device> <pad_note> <pan>
 *   set_pad_tune <rack_track> <rack_device> <pad_note> <semitones>
 *   batch_load <rack_track> <rack_device> <json_array_of_{pad,path}>
 */

inlets = 1;
outlets = 1;
autowatch = 1;

// ── Helpers ────────────────────────────────────────────────────────────────

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

function safeGetStr(obj, prop) {
    var val = safeGet(obj, prop);
    return (val !== null && val !== undefined) ? String(val) : "";
}

function safeGetNum(obj, prop) {
    var val = safeGet(obj, prop);
    return (val !== null && val !== undefined) ? Number(val) : 0;
}

function rackPath(track, device) {
    return "live_set tracks " + track + " devices " + (device || 0);
}

function padPath(track, device, padNote) {
    return rackPath(track, device) + " drum_pads " + padNote;
}

function padChainPath(track, device, padNote) {
    return padPath(track, device, padNote) + " chains 0";
}

function padSimplerPath(track, device, padNote) {
    return padChainPath(track, device, padNote) + " devices 0";
}

function respond(status, data) {
    outlet(0, JSON.stringify({ status: status, result: data }));
}

// MIDI note names for common drum mapping
var PAD_NAMES = {
    36: "C1 (Kick)", 37: "C#1 (Rim)", 38: "D1 (Snare)", 39: "Eb1 (Clap)",
    40: "E1 (Snare 2)", 41: "F1 (Low Tom)", 42: "F#1 (Hi-Hat Closed)", 43: "G1 (Low Tom 2)",
    44: "Ab1 (Pedal HH)", 45: "A1 (Mid Tom)", 46: "Bb1 (Hi-Hat Open)", 47: "B1 (Mid Tom 2)",
    48: "C2 (High Tom)", 49: "C#2 (Crash)", 50: "D2 (High Tom 2)", 51: "Eb2 (Ride)",
    52: "E2 (China)", 53: "F2 (Ride Bell)", 54: "F#2 (Tambourine)", 55: "G2 (Splash)",
    56: "Ab2 (Cowbell)", 57: "A2 (Crash 2)", 58: "Bb2 (Vibraslap)", 59: "B2 (Ride 2)"
};

// ── Core: Load Sample into Drum Pad ────────────────────────────────────────

/**
 * The central function that fixes the sample loading bug.
 *
 * Strategy:
 * 1. Navigate to the Drum Rack device
 * 2. Access the specific drum_pad by MIDI note number
 * 3. If pad has no chain, attempt to create one via insert_chain()
 * 4. Navigate to the Simpler inside the chain
 * 5. Set sample_file_path directly -- no browser.load_item() needed
 * 6. Verify the sample loaded correctly
 */
function load_sample(track, device, padNote, filePath) {
    track = Number(track);
    device = Number(device) || 0;
    padNote = Number(padNote);

    // 1. Verify it's a Drum Rack
    var rack = api(rackPath(track, device));
    var className = safeGetStr(rack, "class_name");
    if (className !== "DrumGroupDevice") {
        respond("error", {
            code: "NOT_DRUM_RACK",
            message: "Device at index " + device + " on track " + track + " is a " + className + ", not a DrumGroupDevice"
        });
        return;
    }

    // 2. Validate pad note
    if (padNote < 0 || padNote > 127) {
        respond("error", { code: "INVALID_PAD", message: "Pad note must be 0-127, got " + padNote });
        return;
    }

    // 3. Access the drum pad
    var pad;
    try {
        pad = api(padPath(track, device, padNote));
    } catch (e) {
        respond("error", { code: "PAD_NOT_FOUND", message: "Cannot access drum pad " + padNote + ": " + e.message });
        return;
    }

    // 4. Check for existing chain
    var chains = safeGet(pad, "chains");
    var chainCount = (chains && chains.length) ? Math.floor(chains.length / 2) : 0;

    if (chainCount === 0) {
        // No chain -- try to create one
        post("kbot-drum-loader: pad " + padNote + " has no chain, attempting insert_chain...\n");
        try {
            rack.call("insert_chain", padNote);
            // Wait a moment for the chain to be created
            // (In Max JS, we can't truly async-wait, but the LOM operation is synchronous)

            // Re-read chains
            chains = safeGet(pad, "chains");
            chainCount = (chains && chains.length) ? Math.floor(chains.length / 2) : 0;

            if (chainCount === 0) {
                respond("error", {
                    code: "CHAIN_CREATE_FAILED",
                    message: "insert_chain(" + padNote + ") returned but pad still has no chain. " +
                             "Manually drop a Simpler onto pad " + (PAD_NAMES[padNote] || padNote) + " and retry."
                });
                return;
            }
            post("kbot-drum-loader: chain created on pad " + padNote + "\n");
        } catch (e) {
            respond("error", {
                code: "CHAIN_CREATE_FAILED",
                message: "Cannot create chain on pad " + padNote + ": " + e.message + ". " +
                         "Requires Ableton Live 12.3+. Manually drop a Simpler onto the pad and retry."
            });
            return;
        }
    }

    // 5. Access the Simpler device in the chain
    var simpler;
    var simplerClass;
    try {
        simpler = api(padSimplerPath(track, device, padNote));
        simplerClass = safeGetStr(simpler, "class_name");
    } catch (e) {
        respond("error", {
            code: "NO_SIMPLER",
            message: "No device found in pad " + padNote + " chain: " + e.message
        });
        return;
    }

    // 6. Verify it's a Simpler-type device
    var isSimplerType = (
        simplerClass === "OriginalSimpler" ||
        simplerClass === "Simpler" ||
        simplerClass.indexOf("Simpler") >= 0
    );

    if (!isSimplerType) {
        // Try to find a Simpler anywhere in the chain's device list
        var devIds = api(padChainPath(track, device, padNote)).get("devices");
        var devCount = devIds ? Math.floor(devIds.length / 2) : 0;
        var found = false;

        for (var d = 0; d < devCount; d++) {
            var dev = api(padChainPath(track, device, padNote) + " devices " + d);
            var cn = safeGetStr(dev, "class_name");
            if (cn.indexOf("Simpler") >= 0 || cn === "OriginalSimpler") {
                simpler = dev;
                simplerClass = cn;
                found = true;
                break;
            }
        }

        if (!found) {
            respond("error", {
                code: "NOT_SIMPLER",
                message: "Device on pad " + padNote + " is a " + simplerClass + ", not a Simpler. " +
                         "Replace it with a Simpler to enable sample loading."
            });
            return;
        }
    }

    // 7. SET THE SAMPLE PATH -- this is the critical operation
    try {
        simpler.set("sample_file_path", filePath);
    } catch (e) {
        respond("error", {
            code: "SAMPLE_LOAD_FAILED",
            message: "Failed to set sample_file_path: " + e.message + ". " +
                     "The file may not exist or the Simpler version may not support this property."
        });
        return;
    }

    // 8. Verify
    var loadedPath = "";
    try {
        loadedPath = safeGetStr(simpler, "sample_file_path");
    } catch (e) {
        // Verification failed but load might have succeeded
    }

    var padName = PAD_NAMES[padNote] || ("Note " + padNote);

    respond("ok", {
        track: track,
        device: device,
        pad: padNote,
        pad_name: padName,
        file_path: filePath,
        loaded_path: loadedPath,
        verified: loadedPath.length > 0
    });

    post("kbot-drum-loader: loaded " + filePath.split("/").pop() + " into pad " + padName + "\n");
}

// Alias: swap is the same as load (just replaces)
function swap_sample(track, device, padNote, filePath) {
    load_sample(track, device, padNote, filePath);
}

// ── Batch Load ─────────────────────────────────────────────────────────────

/**
 * Load multiple samples at once.
 * Input: track, device, JSON string of [{pad: 36, path: "/path/to/kick.wav"}, ...]
 */
function batch_load(track, device, jsonStr) {
    track = Number(track);
    device = Number(device) || 0;

    var samples;
    try {
        samples = JSON.parse(jsonStr);
    } catch (e) {
        respond("error", { code: "PARSE_ERROR", message: "Invalid JSON for batch_load" });
        return;
    }

    var results = [];
    for (var i = 0; i < samples.length; i++) {
        var s = samples[i];
        try {
            // Call load_sample but capture its output
            load_sample_internal(track, device, s.pad, s.path, results);
        } catch (e) {
            results.push({ pad: s.pad, status: "error", message: e.message });
        }
    }

    respond("ok", { batch: results, total: samples.length, success: results.filter(function(r) { return r.status === "ok"; }).length });
}

/**
 * Internal version of load_sample that pushes results to an array instead of outlet.
 */
function load_sample_internal(track, device, padNote, filePath, results) {
    padNote = Number(padNote);

    var rack = api(rackPath(track, device));
    var className = safeGetStr(rack, "class_name");
    if (className !== "DrumGroupDevice") {
        results.push({ pad: padNote, status: "error", message: "Not a Drum Rack" });
        return;
    }

    var pad = api(padPath(track, device, padNote));
    var chains = safeGet(pad, "chains");
    var chainCount = (chains && chains.length) ? Math.floor(chains.length / 2) : 0;

    if (chainCount === 0) {
        try {
            rack.call("insert_chain", padNote);
            chains = safeGet(pad, "chains");
            chainCount = (chains && chains.length) ? Math.floor(chains.length / 2) : 0;
            if (chainCount === 0) {
                results.push({ pad: padNote, status: "error", message: "insert_chain failed" });
                return;
            }
        } catch (e) {
            results.push({ pad: padNote, status: "error", message: "insert_chain error: " + e.message });
            return;
        }
    }

    try {
        var simpler = api(padSimplerPath(track, device, padNote));
        simpler.set("sample_file_path", filePath);
        var loaded = safeGetStr(simpler, "sample_file_path");
        results.push({ pad: padNote, status: "ok", path: filePath, loaded: loaded });
    } catch (e) {
        results.push({ pad: padNote, status: "error", message: e.message });
    }
}

// ── List & Inspect ─────────────────────────────────────────────────────────

function list_pads(track, device) {
    track = Number(track);
    device = Number(device) || 0;

    var rack = api(rackPath(track, device));
    var className = safeGetStr(rack, "class_name");
    if (className !== "DrumGroupDevice") {
        respond("error", { code: "NOT_DRUM_RACK", message: "Device is " + className });
        return;
    }

    var pads = [];

    // Scan standard pad range
    for (var note = 0; note <= 127; note++) {
        try {
            var pad = api(padPath(track, device, note));
            var chains = safeGet(pad, "chains");
            var chainCount = (chains && chains.length) ? Math.floor(chains.length / 2) : 0;

            if (chainCount > 0) {
                var padInfo = {
                    note: note,
                    name: PAD_NAMES[note] || ("Note " + note),
                    sample: null,
                    device_class: null,
                    volume: null,
                    pan: null
                };

                try {
                    var dev = api(padSimplerPath(track, device, note));
                    padInfo.device_class = safeGetStr(dev, "class_name");
                    padInfo.sample = safeGetStr(dev, "sample_file_path") || null;
                } catch (e) {}

                try {
                    var vol = api(padChainPath(track, device, note) + " mixer_device volume");
                    padInfo.volume = safeGetNum(vol, "value");
                    var pan = api(padChainPath(track, device, note) + " mixer_device panning");
                    padInfo.pan = safeGetNum(pan, "value");
                } catch (e) {}

                pads.push(padInfo);
            }
        } catch (e) {
            continue;
        }
    }

    respond("ok", { track: track, device: device, pads: pads, count: pads.length });
}

function get_pad(track, device, padNote) {
    track = Number(track);
    device = Number(device) || 0;
    padNote = Number(padNote);

    var pad = api(padPath(track, device, padNote));
    var chains = safeGet(pad, "chains");
    var chainCount = (chains && chains.length) ? Math.floor(chains.length / 2) : 0;

    var info = {
        note: padNote,
        name: PAD_NAMES[padNote] || ("Note " + padNote),
        has_chain: chainCount > 0,
        sample: null,
        device_class: null,
        volume: null,
        pan: null,
        tune: null,
        device_params: []
    };

    if (chainCount > 0) {
        try {
            var dev = api(padSimplerPath(track, device, padNote));
            info.device_class = safeGetStr(dev, "class_name");
            info.sample = safeGetStr(dev, "sample_file_path") || null;

            // Get all Simpler params
            var paramIds = dev.get("parameters");
            var paramCount = paramIds ? Math.floor(paramIds.length / 2) : 0;
            for (var i = 0; i < paramCount; i++) {
                var param = api(padSimplerPath(track, device, padNote) + " parameters " + i);
                info.device_params.push({
                    index: i,
                    name: safeGetStr(param, "name"),
                    value: safeGetNum(param, "value"),
                    min: safeGetNum(param, "min"),
                    max: safeGetNum(param, "max")
                });
            }
        } catch (e) {}

        try {
            var vol = api(padChainPath(track, device, padNote) + " mixer_device volume");
            info.volume = safeGetNum(vol, "value");
            var pan = api(padChainPath(track, device, padNote) + " mixer_device panning");
            info.pan = safeGetNum(pan, "value");
        } catch (e) {}
    }

    respond("ok", info);
}

// ── Per-Pad Mixer Control ──────────────────────────────────────────────────

function set_pad_volume(track, device, padNote, volume) {
    var vol = api(padChainPath(Number(track), Number(device) || 0, Number(padNote)) + " mixer_device volume");
    vol.set("value", Number(volume));
    respond("ok", { pad: Number(padNote), volume: Number(volume) });
}

function set_pad_pan(track, device, padNote, pan) {
    var p = api(padChainPath(Number(track), Number(device) || 0, Number(padNote)) + " mixer_device panning");
    p.set("value", Number(pan));
    respond("ok", { pad: Number(padNote), pan: Number(pan) });
}

function set_pad_tune(track, device, padNote, semitones) {
    var simpler = api(padSimplerPath(Number(track), Number(device) || 0, Number(padNote)));
    var paramIds = simpler.get("parameters");
    var paramCount = paramIds ? Math.floor(paramIds.length / 2) : 0;

    for (var i = 0; i < paramCount; i++) {
        var param = api(padSimplerPath(Number(track), Number(device) || 0, Number(padNote)) + " parameters " + i);
        var name = safeGetStr(param, "name").toLowerCase();
        if (name === "transpose" || name === "tune" || name === "s transpose" || name === "detune") {
            param.set("value", Number(semitones));
            respond("ok", { pad: Number(padNote), tune: Number(semitones), param_name: name });
            return;
        }
    }

    respond("error", { code: "TUNE_PARAM_NOT_FOUND", message: "No transpose/tune parameter found on pad " + padNote + " Simpler" });
}

// ── Initialization ─────────────────────────────────────────────────────────

post("kbot-drum-loader.js loaded -- direct sample loading via SimplerDevice.sample_file_path\n");
post("Usage: load_sample <track> <device> <pad_note> <file_path>\n");
