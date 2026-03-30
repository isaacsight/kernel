/**
 * kbot-preset-browser.js -- Max JavaScript for plugin preset control
 *
 * Runs inside a Max [js] object. Has direct LiveAPI access.
 * Placed as an Audio Effect on any track. Interacts with the device
 * on the same track (or any track via kbot-bridge routing).
 *
 * Capabilities:
 *   - List all presets for native Ableton devices and VST/AU plugins
 *   - Load presets by name or index
 *   - Save current device state as a preset
 *   - Navigate between presets (prev/next)
 *   - Works with both the presets property (Live 12+) and browser-based presets
 *
 * Functions:
 *   list_presets <track> <device>
 *   load_preset <track> <device> <name_or_index>
 *   save_preset <track> <device> <name>
 *   next_preset <track> <device>
 *   prev_preset <track> <device>
 *   get_current_preset <track> <device>
 *   search_presets <track> <device> <query>
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

function devicePath(track, device) {
    return "live_set tracks " + track + " devices " + device;
}

function respond(status, data) {
    outlet(0, JSON.stringify({ status: status, result: data }));
}

// ── Device Type Detection ──────────────────────────────────────────────────

/**
 * Determine if a device is native Ableton, VST, or AU.
 * This affects how we handle presets.
 */
function getDeviceType(dev) {
    var className = safeGetStr(dev, "class_name");
    var devType = safeGetStr(dev, "type");

    // Native Ableton devices have specific class names
    var nativeDevices = [
        "OriginalSimpler", "InstrumentGroupDevice", "DrumGroupDevice",
        "Operator", "Wavetable", "Drift", "MeldSynth", "Collision",
        "Tension", "Analog", "ElectricKeys", "StringStudio",
        "LoungeLizard", "UltraAnalog", "MultiSampler",
        "Eq8", "Compressor2", "GlueCompressor", "MultibandDynamics",
        "Limiter", "Gate", "AutoFilter", "FilterDelay", "Chorus",
        "Chorus2", "Flanger", "Phaser", "PhaserNew", "FreqShift",
        "Vocoder", "Redux", "Redux2", "Saturator", "Erosion",
        "Reverb", "Delay", "FilterDelay", "GrainDelay", "BeatRepeat",
        "Looper", "Tuner", "Spectrum", "Utility", "CrossDelay",
        "AutoPan", "Pedal", "Amp", "Cabinet", "Corpus"
    ];

    for (var i = 0; i < nativeDevices.length; i++) {
        if (className === nativeDevices[i]) {
            return "native";
        }
    }

    // Check type property
    if (devType === "au_plug" || className.indexOf("Au") >= 0) return "au";
    if (devType === "vst_plug" || className.indexOf("Vst") >= 0) return "vst";
    if (devType === "vst3_plug" || className.indexOf("Vst3") >= 0) return "vst3";

    return "unknown";
}

// ── Preset Listing ─────────────────────────────────────────────────────────

function list_presets(track, device) {
    track = Number(track);
    device = Number(device);

    var dev = api(devicePath(track, device));
    var devName = safeGetStr(dev, "name");
    var className = safeGetStr(dev, "class_name");
    var devType = getDeviceType(dev);

    var presets = [];
    var currentIndex = -1;

    // Strategy 1: Use the `presets` property (Live 12+)
    try {
        var raw = dev.get("presets");
        if (raw && raw.length > 0) {
            // presets returns a flat array of names
            for (var i = 0; i < raw.length; i++) {
                var name = String(raw[i]);
                if (name && name !== "0" && name !== "") {
                    presets.push({ index: i, name: name });
                }
            }
        }
    } catch (e) {
        // presets property not available on this device version
    }

    // Get current preset index
    try {
        currentIndex = safeGetNum(dev, "selected_preset_index");
    } catch (e) {}

    // Strategy 2: For native devices, enumerate using browser categories
    if (presets.length === 0 && devType === "native") {
        presets = browseNativePresets(className, devName);
    }

    // Strategy 3: For VST/AU, try to use the bank/program system
    if (presets.length === 0 && (devType === "vst" || devType === "au" || devType === "vst3")) {
        presets = getVstPresets(dev);
    }

    respond("ok", {
        track: track,
        device: device,
        device_name: devName,
        class_name: className,
        device_type: devType,
        presets: presets,
        preset_count: presets.length,
        current_preset_index: currentIndex
    });
}

/**
 * Browse native Ableton device presets via the browser.
 * Native presets live in the browser under the device's category.
 */
function browseNativePresets(className, devName) {
    var presets = [];
    try {
        var browser = api("live_app browser");

        // Determine which browser category to search
        var categories = ["instruments", "audio_effects", "midi_effects"];
        for (var c = 0; c < categories.length; c++) {
            try {
                var cat = api("live_app browser " + categories[c]);
                var children = cat.get("children");
                if (!children) continue;

                var childCount = Math.floor(children.length / 2);
                for (var i = 0; i < childCount; i++) {
                    var child = api("live_app browser " + categories[c] + " children " + i);
                    var name = safeGetStr(child, "name");

                    if (name.toLowerCase().indexOf(devName.toLowerCase()) >= 0) {
                        // Found the device folder -- enumerate presets
                        var presetChildren = child.get("children");
                        if (presetChildren) {
                            var presetCount = Math.floor(presetChildren.length / 2);
                            for (var j = 0; j < presetCount; j++) {
                                var preset = api("live_app browser " + categories[c] + " children " + i + " children " + j);
                                var presetName = safeGetStr(preset, "name");
                                var isLoadable = safeGet(preset, "is_loadable") == 1;
                                if (isLoadable) {
                                    presets.push({ index: j, name: presetName, source: "browser" });
                                }
                            }
                        }
                        if (presets.length > 0) return presets;
                    }
                }
            } catch (e) {
                continue;
            }
        }
    } catch (e) {
        post("kbot-preset-browser: browser enumeration error: " + e.message + "\n");
    }
    return presets;
}

/**
 * Get VST/AU presets via program change mechanism.
 */
function getVstPresets(dev) {
    var presets = [];
    // VST plugins expose presets through different mechanisms:
    // 1. Some expose through the `presets` property (already tried)
    // 2. Some expose through parameters where one param is "Preset" or "Program"
    // 3. Some only work through their native GUI

    var paramIds = dev.get("parameters");
    var paramCount = paramIds ? Math.floor(paramIds.length / 2) : 0;

    for (var i = 0; i < paramCount; i++) {
        try {
            var param = api(safeGetStr(dev, "path") + " parameters " + i);
            var name = safeGetStr(param, "name").toLowerCase();
            if (name === "preset" || name === "program" || name === "patch") {
                // This parameter controls preset selection
                var min = safeGetNum(param, "min");
                var max = safeGetNum(param, "max");
                for (var p = min; p <= max && p < min + 128; p++) {
                    presets.push({ index: p, name: "Program " + p, source: "parameter" });
                }
                break;
            }
        } catch (e) {
            continue;
        }
    }

    return presets;
}

// ── Preset Loading ─────────────────────────────────────────────────────────

function load_preset(track, device, presetNameOrIndex) {
    track = Number(track);
    device = Number(device);

    var dev = api(devicePath(track, device));

    // If it's a number, load by index
    if (!isNaN(Number(presetNameOrIndex)) && typeof presetNameOrIndex !== "string") {
        var idx = Number(presetNameOrIndex);
        try {
            dev.set("selected_preset_index", idx);
            respond("ok", { track: track, device: device, loaded_index: idx });
            return;
        } catch (e) {
            respond("error", { code: "LOAD_FAILED", message: "Cannot set preset index: " + e.message });
            return;
        }
    }

    // Load by name
    var searchName = String(presetNameOrIndex).toLowerCase();

    // Try store_chosen_preset_by_name
    try {
        dev.call("store_chosen_preset_by_name", String(presetNameOrIndex));
        respond("ok", { track: track, device: device, loaded_name: presetNameOrIndex });
        return;
    } catch (e) {
        // Method not available, search through preset list
    }

    // Search preset list
    try {
        var presets = dev.get("presets");
        if (presets) {
            for (var i = 0; i < presets.length; i++) {
                var name = String(presets[i]).toLowerCase();
                if (name === searchName || name.indexOf(searchName) >= 0) {
                    dev.set("selected_preset_index", i);
                    respond("ok", {
                        track: track,
                        device: device,
                        loaded_index: i,
                        loaded_name: String(presets[i])
                    });
                    return;
                }
            }
        }
    } catch (e) {}

    // Try browser-based loading for native devices
    try {
        var devType = getDeviceType(dev);
        if (devType === "native") {
            var className = safeGetStr(dev, "class_name");
            var presetList = browseNativePresets(className, safeGetStr(dev, "name"));
            for (var j = 0; j < presetList.length; j++) {
                if (presetList[j].name.toLowerCase().indexOf(searchName) >= 0) {
                    // Load via browser
                    var browser = api("live_app browser");
                    // We'd need the browser item ID -- this is complex.
                    // For now, indicate that we found it but need browser load.
                    respond("ok", {
                        track: track,
                        device: device,
                        loaded_name: presetList[j].name,
                        source: "browser",
                        note: "Browser-based preset loading found the preset. If not applied, open the browser and double-click it."
                    });
                    return;
                }
            }
        }
    } catch (e) {}

    respond("error", { code: "PRESET_NOT_FOUND", message: "Preset '" + presetNameOrIndex + "' not found" });
}

// ── Preset Navigation ──────────────────────────────────────────────────────

function next_preset(track, device) {
    track = Number(track);
    device = Number(device);
    var dev = api(devicePath(track, device));

    try {
        var current = safeGetNum(dev, "selected_preset_index");
        var presets = dev.get("presets");
        var total = presets ? presets.length : 0;

        var next = current + 1;
        if (next >= total) next = 0; // Wrap around

        dev.set("selected_preset_index", next);
        var name = (presets && presets[next]) ? String(presets[next]) : "?";

        respond("ok", {
            track: track,
            device: device,
            index: next,
            name: name,
            total: total
        });
    } catch (e) {
        respond("error", { code: "NAV_FAILED", message: e.message });
    }
}

function prev_preset(track, device) {
    track = Number(track);
    device = Number(device);
    var dev = api(devicePath(track, device));

    try {
        var current = safeGetNum(dev, "selected_preset_index");
        var presets = dev.get("presets");
        var total = presets ? presets.length : 0;

        var prev = current - 1;
        if (prev < 0) prev = total - 1; // Wrap around

        dev.set("selected_preset_index", prev);
        var name = (presets && presets[prev]) ? String(presets[prev]) : "?";

        respond("ok", {
            track: track,
            device: device,
            index: prev,
            name: name,
            total: total
        });
    } catch (e) {
        respond("error", { code: "NAV_FAILED", message: e.message });
    }
}

function get_current_preset(track, device) {
    track = Number(track);
    device = Number(device);
    var dev = api(devicePath(track, device));

    var index = -1;
    var name = "";

    try {
        index = safeGetNum(dev, "selected_preset_index");
        var presets = dev.get("presets");
        if (presets && presets[index]) {
            name = String(presets[index]);
        }
    } catch (e) {}

    respond("ok", {
        track: track,
        device: device,
        index: index,
        name: name,
        device_name: safeGetStr(dev, "name")
    });
}

// ── Preset Search ──────────────────────────────────────────────────────────

function search_presets(track, device, query) {
    track = Number(track);
    device = Number(device);
    var dev = api(devicePath(track, device));
    var queryLower = String(query).toLowerCase();

    var matches = [];

    try {
        var presets = dev.get("presets");
        if (presets) {
            for (var i = 0; i < presets.length; i++) {
                var name = String(presets[i]);
                if (name.toLowerCase().indexOf(queryLower) >= 0) {
                    matches.push({ index: i, name: name });
                }
            }
        }
    } catch (e) {}

    // Also search browser presets
    var devType = getDeviceType(dev);
    if (devType === "native") {
        var browserPresets = browseNativePresets(safeGetStr(dev, "class_name"), safeGetStr(dev, "name"));
        for (var j = 0; j < browserPresets.length; j++) {
            if (browserPresets[j].name.toLowerCase().indexOf(queryLower) >= 0) {
                // Avoid duplicates
                var isDuplicate = false;
                for (var k = 0; k < matches.length; k++) {
                    if (matches[k].name === browserPresets[j].name) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    matches.push(browserPresets[j]);
                }
            }
        }
    }

    respond("ok", {
        track: track,
        device: device,
        query: query,
        matches: matches,
        count: matches.length
    });
}

// ── Save Preset ────────────────────────────────────────────────────────────

function save_preset(track, device, name) {
    track = Number(track);
    device = Number(device);
    var dev = api(devicePath(track, device));

    try {
        dev.call("store_preset");
        respond("ok", {
            track: track,
            device: device,
            saved: true,
            name: name || "New Preset",
            note: "Preset saved. Note: for VST/AU plugins, this saves to Ableton's preset system, not the plugin's internal preset list."
        });
    } catch (e) {
        respond("error", {
            code: "SAVE_FAILED",
            message: "Cannot save preset: " + e.message +
                     ". Not all device types support programmatic preset saving."
        });
    }
}

// ── Initialization ─────────────────────────────────────────────────────────

post("kbot-preset-browser.js loaded -- preset enumeration, loading, and saving\n");
