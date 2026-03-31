/**
 * kbot-bridge-lom.js -- Max JavaScript LOM Command Handler
 *
 * Runs inside a Max [js] object. Receives commands from kbot-bridge.js
 * (Node for Max) via Max messages, executes LOM operations using LiveAPI,
 * and sends results back.
 *
 * This file has direct access to:
 *   - LiveAPI (Max for Live JavaScript API)
 *   - LiveAPI.call(), .get(), .set(), .goto()
 *   - live.path navigation
 *
 * It does NOT have access to Node.js APIs (net, fs, ws, etc).
 *
 * Inlet 0: receives "lom_command <id> <action> <params_json>" from node.script
 * Outlet 0: sends "lom_result <id> <status> <result_json>" back to node.script
 * Outlet 1: sends "lom_event <event_name> <data_json>" for subscribed events
 */

// Max JS boilerplate
inlets = 1;
outlets = 2;  // 0 = results to node.script, 1 = events to node.script
autowatch = 1; // Auto-reload on file save

// ── Helpers ────────────────────────────────────────────────────────────────

function api(path) {
    return new LiveAPI(null, path);
}

function safeGet(apiObj, prop) {
    try {
        var val = apiObj.get(prop);
        // LiveAPI returns arrays -- single values are [value]
        if (val && val.length === 1) return val[0];
        return val;
    } catch (e) {
        return null;
    }
}

function safeGetNum(apiObj, prop) {
    var val = safeGet(apiObj, prop);
    return (val !== null && val !== undefined) ? Number(val) : 0;
}

function safeGetStr(apiObj, prop) {
    var val = safeGet(apiObj, prop);
    return (val !== null && val !== undefined) ? String(val) : "";
}

function sendResult(id, status, result) {
    outlet(0, "lom_result", id, status, JSON.stringify(result));
}

function sendEvent(eventName, data) {
    outlet(1, "lom_event", eventName, JSON.stringify(data));
}

function trackPath(idx) {
    return "live_set tracks " + idx;
}

function returnPath(idx) {
    return "live_set return_tracks " + idx;
}

function clipPath(track, slot) {
    return trackPath(track) + " clip_slots " + slot + " clip";
}

function clipSlotPath(track, slot) {
    return trackPath(track) + " clip_slots " + slot;
}

function devicePath(track, device) {
    return trackPath(track) + " devices " + device;
}

function paramPath(track, device, param) {
    return devicePath(track, device) + " parameters " + param;
}

// ── Incoming Message Handler ───────────────────────────────────────────────

function lom_command(id, action, paramsJson) {
    var params;
    try {
        params = JSON.parse(paramsJson);
    } catch (e) {
        sendResult(id, "error", { code: "PARSE_ERROR", message: "Invalid params JSON" });
        return;
    }

    try {
        var result = dispatch(action, params);
        sendResult(id, "ok", result);
    } catch (e) {
        sendResult(id, "error", {
            code: "LOM_ERROR",
            message: e.message || String(e),
            action: action
        });
    }
}

// ── Action Dispatcher ──────────────────────────────────────────────────────

function dispatch(action, p) {
    // Route by action name -- supports dotted namespaces (mixer.analyze, drum.load_sample, etc.)
    switch (action) {

        // ── Transport ──────────────────────────────────────────────────
        case "get_transport":      return getTransport();
        case "set_transport":      return setTransport(p);
        case "start_playing":      return startPlaying();
        case "stop_playing":       return stopPlaying();
        case "continue_playing":   return continuePlaying();

        // ── Tracks ─────────────────────────────────────────────────────
        case "list_tracks":        return listTracks();
        case "create_track":       return createTrack(p);
        case "delete_track":       return deleteTrack(p);
        case "set_track":          return setTrack(p);
        case "get_track":          return getTrack(p);

        // ── Clips ──────────────────────────────────────────────────────
        case "create_clip":        return createClip(p);
        case "delete_clip":        return deleteClip(p);
        case "fire_clip":          return fireClip(p);
        case "stop_clip":          return stopClip(p);
        case "get_clip_info":      return getClipInfo(p);
        case "duplicate_clip":     return duplicateClip(p);

        // ── MIDI ───────────────────────────────────────────────────────
        case "add_notes":          return addNotes(p);
        case "get_notes":          return getNotes(p);
        case "remove_notes":       return removeNotes(p);
        case "replace_notes":      return replaceNotes(p);

        // ── Devices ────────────────────────────────────────────────────
        case "load_plugin":        return loadPlugin(p);
        case "list_devices":       return listDevices(p);
        case "get_device_params":  return getDeviceParams(p);
        case "set_device_param":   return setDeviceParam(p);
        case "enable_device":      return enableDevice(p);

        // ── Presets ────────────────────────────────────────────────────
        case "browse_presets":
        case "preset.list":        return browsePresets(p);
        case "load_preset":
        case "preset.load":        return loadPreset(p);
        case "preset.save":        return savePreset(p);

        // ── Drum Rack ──────────────────────────────────────────────────
        case "load_drum_sample":
        case "drum.load_sample":   return loadDrumSample(p);
        case "list_drum_pads":
        case "drum.list_pads":     return listDrumPads(p);
        case "swap_drum_sample":
        case "drum.swap_sample":   return loadDrumSample(p); // same impl, just replace
        case "set_pad_params":
        case "drum.set_pad_params": return setPadParams(p);

        // ── Automation ─────────────────────────────────────────────────
        case "create_envelope":    return createEnvelope(p);
        case "clear_envelope":     return clearEnvelope(p);

        // ── Scenes ─────────────────────────────────────────────────────
        case "fire_scene":         return fireScene(p);
        case "list_scenes":        return listScenes();
        case "create_scene":       return createScene(p);

        // ── Mix ────────────────────────────────────────────────────────
        case "get_mix_snapshot":   return getMixSnapshot();
        case "set_sends":         return setSends(p);
        case "get_master":        return getMaster();
        case "set_master":        return setMaster(p);

        // ── Returns ────────────────────────────────────────────────────
        case "list_returns":       return listReturns();
        case "create_return":      return createReturn(p);
        case "set_return":         return setReturn(p);

        // ── Groove ─────────────────────────────────────────────────────
        case "list_grooves":       return listGrooves();
        case "apply_groove":       return applyGroove(p);

        // ── Session ────────────────────────────────────────────────────
        case "get_session_info":   return getSessionInfo();
        case "undo":               return doUndo();
        case "redo":               return doRedo();

        // ── Auto Mixer ─────────────────────────────────────────────────
        case "mixer.analyze":      return mixerAnalyze(p);
        case "mixer.auto_mix":     return mixerAutoMix(p);
        case "mixer.get_status":   return mixerGetStatus(p);

        // ── Melody Generator ───────────────────────────────────────────
        case "melody.generate":    return melodyGenerate(p);

        default:
            throw new Error("Unknown action: " + action);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSPORT
// ═══════════════════════════════════════════════════════════════════════════

function getTransport() {
    var song = api("live_set");
    return {
        is_playing:    safeGet(song, "is_playing") == 1,
        tempo:         safeGetNum(song, "tempo"),
        current_time:  safeGetNum(song, "current_song_time"),
        signature_numerator:   safeGetNum(song, "signature_numerator"),
        signature_denominator: safeGetNum(song, "signature_denominator"),
        clip_trigger_quantization: safeGetNum(song, "clip_trigger_quantization"),
        record_mode:   safeGet(song, "record_mode") == 1,
        overdub:       safeGet(song, "overdub") == 1
    };
}

function setTransport(p) {
    var song = api("live_set");
    if (p.tempo !== undefined)      song.set("tempo", p.tempo);
    if (p.position !== undefined)   song.set("current_song_time", p.position);
    if (p.is_playing !== undefined) {
        if (p.is_playing) song.call("start_playing");
        else              song.call("stop_playing");
    }
    if (p.clip_trigger_quantization !== undefined) {
        song.set("clip_trigger_quantization", p.clip_trigger_quantization);
    }
    return getTransport();
}

function startPlaying() {
    api("live_set").call("start_playing");
    return { is_playing: true };
}

function stopPlaying() {
    api("live_set").call("stop_playing");
    return { is_playing: false };
}

function continuePlaying() {
    api("live_set").call("continue_playing");
    return { is_playing: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// TRACKS
// ═══════════════════════════════════════════════════════════════════════════

function listTracks() {
    var song = api("live_set");
    var trackIds = song.get("tracks");
    var tracks = [];

    // trackIds is a flat array: ["id", num, "id", num, ...]
    var count = 0;
    if (trackIds && trackIds.length) {
        count = Math.floor(trackIds.length / 2);
    }

    for (var i = 0; i < count; i++) {
        var t = api(trackPath(i));
        var mixer = api(trackPath(i) + " mixer_device");
        var vol = api(trackPath(i) + " mixer_device volume");
        var pan = api(trackPath(i) + " mixer_device panning");

        tracks.push({
            index: i,
            name:       safeGetStr(t, "name"),
            color:      safeGetNum(t, "color_index"),
            mute:       safeGet(t, "mute") == 1,
            solo:       safeGet(t, "solo") == 1,
            arm:        safeGet(t, "arm") == 1,
            has_midi_input:  safeGet(t, "has_midi_input") == 1,
            has_audio_input: safeGet(t, "has_audio_input") == 1,
            volume:     safeGetNum(vol, "value"),
            pan:        safeGetNum(pan, "value")
        });
    }
    return { tracks: tracks, count: count };
}

function createTrack(p) {
    var song = api("live_set");
    var index = (p.index !== undefined) ? p.index : -1;

    if (p.type === "audio") {
        song.call("create_audio_track", index);
    } else {
        song.call("create_midi_track", index);
    }

    // Get the new track (it's at the index we specified, or at end)
    var trackCount = Math.floor(song.get("tracks").length / 2);
    var newIdx = (index >= 0 && index < trackCount) ? index : trackCount - 1;
    var t = api(trackPath(newIdx));

    if (p.name) t.set("name", p.name);
    if (p.color !== undefined) t.set("color_index", p.color);

    return { track: newIdx, name: p.name || safeGetStr(t, "name") };
}

function deleteTrack(p) {
    var song = api("live_set");
    song.call("delete_track", p.track);
    return { deleted: p.track };
}

function setTrack(p) {
    var t = api(trackPath(p.track));
    if (p.name !== undefined)   t.set("name", p.name);
    if (p.color !== undefined)  t.set("color_index", p.color);
    if (p.mute !== undefined)   t.set("mute", p.mute ? 1 : 0);
    if (p.solo !== undefined)   t.set("solo", p.solo ? 1 : 0);
    if (p.arm !== undefined)    t.set("arm", p.arm ? 1 : 0);

    if (p.volume !== undefined) {
        var vol = api(trackPath(p.track) + " mixer_device volume");
        vol.set("value", p.volume);
    }
    if (p.pan !== undefined) {
        var pan = api(trackPath(p.track) + " mixer_device panning");
        pan.set("value", p.pan);
    }
    return { track: p.track, updated: true };
}

function getTrack(p) {
    var t = api(trackPath(p.track));
    var vol = api(trackPath(p.track) + " mixer_device volume");
    var pan = api(trackPath(p.track) + " mixer_device panning");

    // Get devices
    var devIds = t.get("devices");
    var devCount = devIds ? Math.floor(devIds.length / 2) : 0;
    var devices = [];
    for (var d = 0; d < devCount; d++) {
        var dev = api(devicePath(p.track, d));
        devices.push({
            index: d,
            name: safeGetStr(dev, "name"),
            class_name: safeGetStr(dev, "class_name"),
            is_active: safeGet(dev, "is_active") == 1
        });
    }

    // Get clip slots
    var slotIds = t.get("clip_slots");
    var slotCount = slotIds ? Math.floor(slotIds.length / 2) : 0;
    var clips = [];
    for (var s = 0; s < Math.min(slotCount, 32); s++) { // Cap at 32 slots for performance
        var slot = api(clipSlotPath(p.track, s));
        var hasClip = safeGet(slot, "has_clip") == 1;
        if (hasClip) {
            var clip = api(clipPath(p.track, s));
            clips.push({
                slot: s,
                name: safeGetStr(clip, "name"),
                length: safeGetNum(clip, "length"),
                is_playing: safeGet(clip, "is_playing") == 1,
                is_recording: safeGet(clip, "is_recording") == 1
            });
        }
    }

    return {
        index: p.track,
        name:    safeGetStr(t, "name"),
        color:   safeGetNum(t, "color_index"),
        mute:    safeGet(t, "mute") == 1,
        solo:    safeGet(t, "solo") == 1,
        arm:     safeGet(t, "arm") == 1,
        volume:  safeGetNum(vol, "value"),
        pan:     safeGetNum(pan, "value"),
        devices: devices,
        clips:   clips
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIPS
// ═══════════════════════════════════════════════════════════════════════════

function createClip(p) {
    var slot = api(clipSlotPath(p.track, p.slot));
    slot.call("create_clip", p.length || 4.0);
    var clip = api(clipPath(p.track, p.slot));
    if (p.name) clip.set("name", p.name);
    return { track: p.track, slot: p.slot, length: p.length || 4.0 };
}

function deleteClip(p) {
    var slot = api(clipSlotPath(p.track, p.slot));
    slot.call("delete_clip");
    return { track: p.track, slot: p.slot, deleted: true };
}

function fireClip(p) {
    // Set immediate quantization if requested
    if (p.quantization !== undefined) {
        api("live_set").set("clip_trigger_quantization", p.quantization);
    } else {
        // Default: fire immediately (no quantization wait)
        api("live_set").set("clip_trigger_quantization", 0);
    }

    var clip = api(clipPath(p.track, p.slot));
    clip.call("fire");
    return { track: p.track, slot: p.slot, fired: true };
}

function stopClip(p) {
    var clip = api(clipPath(p.track, p.slot));
    clip.call("stop");
    return { track: p.track, slot: p.slot, stopped: true };
}

function getClipInfo(p) {
    var clip = api(clipPath(p.track, p.slot));
    return {
        track: p.track,
        slot: p.slot,
        name:          safeGetStr(clip, "name"),
        length:        safeGetNum(clip, "length"),
        is_playing:    safeGet(clip, "is_playing") == 1,
        is_recording:  safeGet(clip, "is_recording") == 1,
        is_midi_clip:  safeGet(clip, "is_midi_clip") == 1,
        loop_start:    safeGetNum(clip, "loop_start"),
        loop_end:      safeGetNum(clip, "loop_end"),
        start_marker:  safeGetNum(clip, "start_marker"),
        end_marker:    safeGetNum(clip, "end_marker"),
        looping:       safeGet(clip, "looping") == 1
    };
}

function duplicateClip(p) {
    var slot = api(clipSlotPath(p.track, p.slot));
    slot.call("duplicate_clip_to", p.target_slot || (p.slot + 1));
    return { track: p.track, slot: p.slot, duplicated_to: p.target_slot || (p.slot + 1) };
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDI NOTES
// ═══════════════════════════════════════════════════════════════════════════

function addNotes(p) {
    var clip = api(clipPath(p.track, p.slot));
    var notes = p.notes || [];

    // Live 12 API: call("add_new_notes") then set_note for each
    // Or use the older approach: select_all_notes, replace_selected_notes
    // The most reliable approach in M4L JS:
    clip.call("deselect_all_notes");

    // Use add_new_notes (Live 12+)
    clip.call("begin_add_notes");
    for (var i = 0; i < notes.length; i++) {
        var n = notes[i];
        // add_note(pitch, start_time, duration, velocity, mute)
        clip.call("add_note",
            n.pitch,
            n.start,
            n.duration,
            n.velocity || 100,
            n.mute ? 1 : 0
        );
    }
    clip.call("finish_add_notes");

    return { track: p.track, slot: p.slot, notes_added: notes.length };
}

function getNotes(p) {
    var clip = api(clipPath(p.track, p.slot));
    var start = p.start || 0;
    var length = p.length || safeGetNum(clip, "length");

    // get_notes_extended returns flat array:
    // [count, pitch, start, duration, velocity, mute, pitch, start, ...]
    clip.call("select_all_notes");
    var raw = clip.call("get_selected_notes");

    var notes = [];
    if (raw && raw.length > 1) {
        var count = raw[0];  // "notes" header sometimes present
        var idx = 1;
        // Parse note data -- format is: "notes" count, then groups of 5
        // Actually the format from get_selected_notes is:
        // "notes" count pitch start duration velocity mute pitch start ...
        if (typeof raw[0] === "string" && raw[0] === "notes") {
            count = raw[1];
            idx = 2;
        }
        while (idx + 4 < raw.length) {
            var note = {
                pitch:    Number(raw[idx]),
                start:    Number(raw[idx + 1]),
                duration: Number(raw[idx + 2]),
                velocity: Number(raw[idx + 3]),
                mute:     Number(raw[idx + 4]) == 1
            };
            if (note.start >= start && note.start < start + length) {
                notes.push(note);
            }
            idx += 5;
        }
    }

    clip.call("deselect_all_notes");
    return { track: p.track, slot: p.slot, notes: notes, count: notes.length };
}

function removeNotes(p) {
    var clip = api(clipPath(p.track, p.slot));
    var start = p.start || 0;
    var length = p.length || safeGetNum(clip, "length");

    if (p.pitch !== undefined) {
        // Remove specific pitch range
        clip.call("remove_notes", start, p.pitch, length, 1);
    } else {
        // Remove all notes in range
        clip.call("remove_notes", start, 0, length, 128);
    }
    return { track: p.track, slot: p.slot, removed: true };
}

function replaceNotes(p) {
    var clip = api(clipPath(p.track, p.slot));
    // Remove all existing notes
    var clipLength = safeGetNum(clip, "length");
    clip.call("remove_notes", 0, 0, clipLength, 128);
    // Add new notes
    return addNotes(p);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVICES
// ═══════════════════════════════════════════════════════════════════════════

function searchBrowserItem(browser, basePath, searchName, maxDepth) {
    // Recursively search browser tree for a device matching searchName
    if (maxDepth <= 0) return null;
    try {
        var item = api(basePath);
        var itemName = safeGetStr(item, "name").toLowerCase();
        var isLoadable = safeGet(item, "is_loadable") == 1;

        // Direct match and loadable — load it
        if (itemName.indexOf(searchName) >= 0 && isLoadable) {
            browser.call("load_item", item.id);
            return { name: safeGetStr(item, "name") };
        }

        // If it's a folder, search children
        var children = item.get("children");
        if (children && children.length > 0) {
            var count = Math.floor(children.length / 2);
            for (var k = 0; k < count; k++) {
                var result = searchBrowserItem(browser, basePath + " children " + k, searchName, maxDepth - 1);
                if (result) return result;
            }
        }
    } catch (e) {}
    return null;
}

function loadPlugin(p) {
    // Use Ableton's browser to find and load a plugin (deep search)
    var app = api("live_app");
    var browser = api("live_app browser");

    // Strategy: search through browser categories for the plugin
    // 1. Check instruments category
    // 2. Check audio effects category
    // 3. Check plugins category (VST/AU)

    var song = api("live_set");

    // Select the target track first
    var track = api(trackPath(p.track));
    song.set("appointed_track", track.id);

    // Navigate the browser to find the plugin
    var categories = ["instruments", "audio_effects", "midi_effects", "plugins"];

    for (var c = 0; c < categories.length; c++) {
        var category = categories[c];
        try {
            // Access the browser filter for this category
            var filterPath = "live_app browser " + category;
            var filter = api(filterPath);
            var children = filter.get("children");
            if (!children || children.length === 0) continue;

            var childCount = Math.floor(children.length / 2);
            for (var i = 0; i < childCount; i++) {
                var child = api(filterPath + " children " + i);
                var name = safeGetStr(child, "name");
                var isLoadable = safeGet(child, "is_loadable") == 1;

                // Check name match
                var searchName = (p.name || "").toLowerCase();
                var childName = name.toLowerCase();

                // Deep recursive search (up to 4 levels) for device name
                var found = searchBrowserItem(browser, filterPath + " children " + i, searchName, 3);
                if (found) return { device: found.name, track: p.track, category: category };

                // Also check direct match at this level
                if (childName.indexOf(searchName) >= 0 && isLoadable) {
                    browser.call("load_item", child.id);
                    return { device: name, track: p.track, category: category };
                }
            }
        } catch (e) {
            // Category might not exist, continue to next
            continue;
        }
    }

    throw new Error("Plugin not found: " + p.name + (p.manufacturer ? " by " + p.manufacturer : ""));
}

function listDevices(p) {
    var t = api(trackPath(p.track));
    var devIds = t.get("devices");
    var devCount = devIds ? Math.floor(devIds.length / 2) : 0;
    var devices = [];

    for (var d = 0; d < devCount; d++) {
        var dev = api(devicePath(p.track, d));
        var paramIds = dev.get("parameters");
        var paramCount = paramIds ? Math.floor(paramIds.length / 2) : 0;

        devices.push({
            index: d,
            name:       safeGetStr(dev, "name"),
            class_name: safeGetStr(dev, "class_name"),
            is_active:  safeGet(dev, "is_active") == 1,
            param_count: paramCount
        });
    }
    return { track: p.track, devices: devices };
}

function getDeviceParams(p) {
    var dev = api(devicePath(p.track, p.device));
    var paramIds = dev.get("parameters");
    var paramCount = paramIds ? Math.floor(paramIds.length / 2) : 0;

    var params = [];
    for (var i = 0; i < paramCount; i++) {
        var param = api(paramPath(p.track, p.device, i));
        params.push({
            index: i,
            name:    safeGetStr(param, "name"),
            value:   safeGetNum(param, "value"),
            min:     safeGetNum(param, "min"),
            max:     safeGetNum(param, "max"),
            default_value: safeGetNum(param, "default_value"),
            is_quantized: safeGet(param, "is_quantized") == 1
        });
    }
    return {
        track: p.track,
        device: p.device,
        device_name: safeGetStr(dev, "name"),
        params: params
    };
}

function setDeviceParam(p) {
    if (typeof p.param === "number") {
        // By index
        var param = api(paramPath(p.track, p.device, p.param));
        param.set("value", p.value);
        return { track: p.track, device: p.device, param: p.param, value: p.value };
    } else {
        // By name -- search parameters
        var dev = api(devicePath(p.track, p.device));
        var paramIds = dev.get("parameters");
        var paramCount = paramIds ? Math.floor(paramIds.length / 2) : 0;
        var searchName = String(p.param).toLowerCase();

        for (var i = 0; i < paramCount; i++) {
            var param = api(paramPath(p.track, p.device, i));
            var name = safeGetStr(param, "name").toLowerCase();
            if (name === searchName || name.indexOf(searchName) >= 0) {
                param.set("value", p.value);
                return { track: p.track, device: p.device, param: i, param_name: name, value: p.value };
            }
        }
        throw new Error("Parameter not found: " + p.param);
    }
}

function enableDevice(p) {
    var dev = api(devicePath(p.track, p.device));
    dev.set("is_active", p.enabled ? 1 : 0);
    return { track: p.track, device: p.device, is_active: p.enabled };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════════════════════════════════

function browsePresets(p) {
    var dev = api(devicePath(p.track, p.device));
    var className = safeGetStr(dev, "class_name");
    var devName = safeGetStr(dev, "name");

    var presets = [];
    try {
        // Try to get presets property (Live 12+ for VST/AU)
        var raw = dev.get("presets");
        if (raw && raw.length > 0) {
            for (var i = 0; i < raw.length; i++) {
                presets.push({ index: i, name: String(raw[i]) });
            }
        }
    } catch (e) {
        // presets property not available
    }

    // Check selected_preset_index
    var currentPreset = -1;
    try {
        currentPreset = safeGetNum(dev, "selected_preset_index");
    } catch (e) {}

    return {
        track: p.track,
        device: p.device,
        device_name: devName,
        class_name: className,
        presets: presets,
        current_preset_index: currentPreset
    };
}

function loadPreset(p) {
    var dev = api(devicePath(p.track, p.device));

    if (typeof p.preset === "number") {
        dev.set("selected_preset_index", p.preset);
        return { track: p.track, device: p.device, loaded_preset_index: p.preset };
    } else {
        // Load by name -- try store_chosen_preset_by_name first
        try {
            dev.call("store_chosen_preset_by_name", String(p.preset));
            return { track: p.track, device: p.device, loaded_preset_name: p.preset };
        } catch (e) {
            // Fallback: search preset list
            var presets = dev.get("presets");
            if (presets) {
                var searchName = String(p.preset).toLowerCase();
                for (var i = 0; i < presets.length; i++) {
                    if (String(presets[i]).toLowerCase().indexOf(searchName) >= 0) {
                        dev.set("selected_preset_index", i);
                        return {
                            track: p.track,
                            device: p.device,
                            loaded_preset_index: i,
                            loaded_preset_name: String(presets[i])
                        };
                    }
                }
            }
            throw new Error("Preset not found: " + p.preset);
        }
    }
}

function savePreset(p) {
    var dev = api(devicePath(p.track, p.device));
    try {
        dev.call("store_preset");
        return { track: p.track, device: p.device, saved: true, name: p.name || "New Preset" };
    } catch (e) {
        throw new Error("Cannot save preset for this device type: " + e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DRUM RACK -- THE FIX FOR SAMPLE LOADING
// ═══════════════════════════════════════════════════════════════════════════

function loadDrumSample(p) {
    var rackPath = devicePath(p.track, p.device || 0);
    var rack = api(rackPath);

    // Verify it's actually a Drum Rack
    var className = safeGetStr(rack, "class_name");
    if (className !== "DrumGroupDevice") {
        throw new Error("Device at index " + (p.device || 0) + " is a " + className + ", not a Drum Rack");
    }

    var padNote = p.pad;
    if (padNote < 0 || padNote > 127) {
        throw new Error("Pad note must be 0-127, got: " + padNote);
    }

    var filePath = p.path;

    // Navigate to the specific drum pad
    var padPath = rackPath + " drum_pads " + padNote;
    var pad;
    try {
        pad = api(padPath);
    } catch (e) {
        throw new Error("Drum pad " + padNote + " not found. Pad range is typically 36-84.");
    }

    // Check if pad has chains
    var chains = pad.get("chains");
    var chainCount = chains ? Math.floor(chains.length / 2) : 0;

    if (chainCount === 0) {
        // No chain on this pad -- need to create one
        // Live 12.3+: use insert_chain on the rack device
        try {
            // insert_chain creates a chain and puts it at the first available pad
            // We need to then set its in_note to our target pad
            rack.call("insert_chain", padNote);

            // Re-read chains
            chains = pad.get("chains");
            chainCount = chains ? Math.floor(chains.length / 2) : 0;

            if (chainCount === 0) {
                throw new Error("insert_chain succeeded but pad still has no chains");
            }
        } catch (e) {
            throw new Error(
                "Pad " + padNote + " has no chain and insert_chain failed: " + e.message +
                ". Drop a Simpler onto this pad manually first, then retry."
            );
        }
    }

    // Access the first device in the pad's first chain (should be a Simpler)
    var simplerPath = padPath + " chains 0 devices 0";
    var simpler;
    try {
        simpler = api(simplerPath);
    } catch (e) {
        throw new Error("No device found in pad " + padNote + " chain. Expected a Simpler.");
    }

    var simplerClass = safeGetStr(simpler, "class_name");

    // The key property: sample_file_path on OriginalSimpler / SimplerDevice
    // This works on Simpler, not on other devices
    if (simplerClass === "OriginalSimpler" || simplerClass === "InstrumentGroupDevice" || simplerClass.indexOf("Simpler") >= 0) {
        try {
            simpler.set("sample_file_path", filePath);

            // Verify the sample loaded
            var loadedPath = safeGetStr(simpler, "sample_file_path");

            return {
                track: p.track,
                device: p.device || 0,
                pad: padNote,
                path: filePath,
                loaded_path: loadedPath,
                success: true
            };
        } catch (e) {
            // sample_file_path might not work on all Simpler versions
            // Fallback: try the sample property on the Simpler's sample slot
            throw new Error(
                "Failed to set sample_file_path on " + simplerClass + ": " + e.message +
                ". The Simpler on pad " + padNote + " may not support direct sample loading."
            );
        }
    } else {
        throw new Error(
            "Device on pad " + padNote + " is a " + simplerClass + ", not a Simpler. " +
            "Cannot set sample_file_path. Replace it with a Simpler first."
        );
    }
}

function listDrumPads(p) {
    var rackPath = devicePath(p.track, p.device || 0);
    var rack = api(rackPath);

    var className = safeGetStr(rack, "class_name");
    if (className !== "DrumGroupDevice") {
        throw new Error("Device is a " + className + ", not a Drum Rack");
    }

    // Get visible drum pads
    var visiblePads = rack.get("visible_drum_pads");
    var padCount = visiblePads ? Math.floor(visiblePads.length / 2) : 0;

    var pads = [];
    // Standard drum pad range: 36-84 (C1 to C5)
    for (var note = 36; note <= 84; note++) {
        try {
            var padPath = rackPath + " drum_pads " + note;
            var pad = api(padPath);

            var chains = pad.get("chains");
            var chainCount = chains ? Math.floor(chains.length / 2) : 0;

            var padInfo = {
                note: note,
                name: safeGetStr(pad, "name"),
                has_chain: chainCount > 0,
                sample: null,
                device: null
            };

            if (chainCount > 0) {
                try {
                    var dev = api(padPath + " chains 0 devices 0");
                    padInfo.device = safeGetStr(dev, "class_name");
                    padInfo.sample = safeGetStr(dev, "sample_file_path") || null;
                } catch (e) {
                    // No device in chain
                }
            }

            // Only include pads that have content
            if (padInfo.has_chain) {
                pads.push(padInfo);
            }
        } catch (e) {
            // Pad might not exist
            continue;
        }
    }

    return { track: p.track, device: p.device || 0, pads: pads };
}

function setPadParams(p) {
    var rackPath = devicePath(p.track, p.device || 0);
    var padPath = rackPath + " drum_pads " + p.pad;

    // Access the chain mixer
    var mixerPath = padPath + " chains 0 mixer_device";

    if (p.volume !== undefined) {
        var vol = api(mixerPath + " volume");
        vol.set("value", p.volume);
    }
    if (p.pan !== undefined) {
        var pan = api(mixerPath + " panning");
        pan.set("value", p.pan);
    }
    if (p.tune !== undefined) {
        // Tune is on the Simpler device, not the mixer
        var simpler = api(padPath + " chains 0 devices 0");
        // Simpler's tuning parameter varies by version, try common names
        var paramIds = simpler.get("parameters");
        var paramCount = paramIds ? Math.floor(paramIds.length / 2) : 0;
        for (var i = 0; i < paramCount; i++) {
            var param = api(padPath + " chains 0 devices 0 parameters " + i);
            var name = safeGetStr(param, "name").toLowerCase();
            if (name === "transpose" || name === "tune" || name === "s transpose") {
                param.set("value", p.tune);
                break;
            }
        }
    }

    return { track: p.track, pad: p.pad, updated: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATION
// ═══════════════════════════════════════════════════════════════════════════

function createEnvelope(p) {
    // Access the clip's automation envelopes
    var clip = api(clipPath(p.track, p.slot || 0));
    var param = api(paramPath(p.track, p.device, p.param));

    // Clear existing envelope for this parameter
    try {
        clip.call("clear_envelope", param.id);
    } catch (e) {
        // No existing envelope, that's fine
    }

    // Create envelope and add breakpoints
    var points = p.points || [];
    for (var i = 0; i < points.length; i++) {
        // insert_envelope_point(parameter_id, time, value)
        clip.call("create_automation_envelope", param.id);
        // Now we need to use the envelope's insert method
        // The approach varies by Live version
    }

    return {
        track: p.track,
        device: p.device,
        param: p.param,
        points_count: points.length,
        note: "Automation envelope API varies by Live version -- verify in Max console"
    };
}

function clearEnvelope(p) {
    var clip = api(clipPath(p.track, p.slot || 0));
    var param = api(paramPath(p.track, p.device, p.param));
    clip.call("clear_envelope", param.id);
    return { track: p.track, cleared: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENES
// ═══════════════════════════════════════════════════════════════════════════

function fireScene(p) {
    var song = api("live_set");
    song.set("clip_trigger_quantization", 0);
    var scene = api("live_set scenes " + p.scene);
    scene.call("fire");
    return { scene: p.scene, fired: true };
}

function listScenes() {
    var song = api("live_set");
    var sceneIds = song.get("scenes");
    var count = sceneIds ? Math.floor(sceneIds.length / 2) : 0;
    var scenes = [];

    for (var i = 0; i < count; i++) {
        var scene = api("live_set scenes " + i);
        scenes.push({
            index: i,
            name: safeGetStr(scene, "name"),
            tempo: safeGetNum(scene, "tempo"),
            time_sig_numerator: safeGetNum(scene, "time_signature_numerator"),
            time_sig_denominator: safeGetNum(scene, "time_signature_denominator")
        });
    }
    return { scenes: scenes, count: count };
}

function createScene(p) {
    var song = api("live_set");
    song.call("create_scene", -1);
    var sceneIds = song.get("scenes");
    var count = sceneIds ? Math.floor(sceneIds.length / 2) : 0;
    var newScene = api("live_set scenes " + (count - 1));
    if (p && p.name) newScene.set("name", p.name);
    return { scene: count - 1, name: p ? p.name : "" };
}

// ═══════════════════════════════════════════════════════════════════════════
// MIX
// ═══════════════════════════════════════════════════════════════════════════

function getMixSnapshot() {
    var song = api("live_set");
    var trackIds = song.get("tracks");
    var trackCount = trackIds ? Math.floor(trackIds.length / 2) : 0;

    var tracks = [];
    for (var i = 0; i < trackCount; i++) {
        var t = api(trackPath(i));
        var vol = api(trackPath(i) + " mixer_device volume");
        var pan = api(trackPath(i) + " mixer_device panning");

        var trackInfo = {
            index: i,
            name: safeGetStr(t, "name"),
            volume: safeGetNum(vol, "value"),
            pan: safeGetNum(pan, "value"),
            mute: safeGet(t, "mute") == 1,
            solo: safeGet(t, "solo") == 1,
            meter_left: safeGetNum(t, "output_meter_left"),
            meter_right: safeGetNum(t, "output_meter_right"),
            sends: []
        };

        // Get sends
        var sendIds = api(trackPath(i) + " mixer_device").get("sends");
        var sendCount = sendIds ? Math.floor(sendIds.length / 2) : 0;
        for (var s = 0; s < sendCount; s++) {
            var send = api(trackPath(i) + " mixer_device sends " + s);
            trackInfo.sends.push({
                index: s,
                value: safeGetNum(send, "value")
            });
        }

        tracks.push(trackInfo);
    }

    // Master
    var master = api("live_set master_track");
    var masterVol = api("live_set master_track mixer_device volume");

    return {
        tracks: tracks,
        master: {
            volume: safeGetNum(masterVol, "value"),
            meter_left: safeGetNum(master, "output_meter_left"),
            meter_right: safeGetNum(master, "output_meter_right")
        }
    };
}

function setSends(p) {
    var sends = p.sends || [];
    for (var i = 0; i < sends.length; i++) {
        var s = sends[i];
        var send = api(trackPath(p.track) + " mixer_device sends " + s.return);
        send.set("value", s.level);
    }
    return { track: p.track, sends_set: sends.length };
}

function getMaster() {
    var master = api("live_set master_track");
    var vol = api("live_set master_track mixer_device volume");
    var pan = api("live_set master_track mixer_device panning");

    var devIds = master.get("devices");
    var devCount = devIds ? Math.floor(devIds.length / 2) : 0;
    var devices = [];
    for (var d = 0; d < devCount; d++) {
        var dev = api("live_set master_track devices " + d);
        devices.push({
            index: d,
            name: safeGetStr(dev, "name"),
            class_name: safeGetStr(dev, "class_name"),
            is_active: safeGet(dev, "is_active") == 1
        });
    }

    return {
        volume: safeGetNum(vol, "value"),
        pan: safeGetNum(pan, "value"),
        meter_left: safeGetNum(master, "output_meter_left"),
        meter_right: safeGetNum(master, "output_meter_right"),
        devices: devices
    };
}

function setMaster(p) {
    if (p.volume !== undefined) {
        api("live_set master_track mixer_device volume").set("value", p.volume);
    }
    if (p.pan !== undefined) {
        api("live_set master_track mixer_device panning").set("value", p.pan);
    }
    return getMaster();
}

// ═══════════════════════════════════════════════════════════════════════════
// RETURNS
// ═══════════════════════════════════════════════════════════════════════════

function listReturns() {
    var song = api("live_set");
    var retIds = song.get("return_tracks");
    var count = retIds ? Math.floor(retIds.length / 2) : 0;
    var returns = [];

    for (var i = 0; i < count; i++) {
        var r = api(returnPath(i));
        var vol = api(returnPath(i) + " mixer_device volume");
        var pan = api(returnPath(i) + " mixer_device panning");

        var devIds = r.get("devices");
        var devCount = devIds ? Math.floor(devIds.length / 2) : 0;
        var devices = [];
        for (var d = 0; d < devCount; d++) {
            var dev = api(returnPath(i) + " devices " + d);
            devices.push({
                index: d,
                name: safeGetStr(dev, "name"),
                class_name: safeGetStr(dev, "class_name")
            });
        }

        returns.push({
            index: i,
            name: safeGetStr(r, "name"),
            volume: safeGetNum(vol, "value"),
            pan: safeGetNum(pan, "value"),
            devices: devices
        });
    }
    return { returns: returns, count: count };
}

function createReturn(p) {
    api("live_set").call("create_return_track");
    var retIds = api("live_set").get("return_tracks");
    var count = retIds ? Math.floor(retIds.length / 2) : 0;
    var newRet = api(returnPath(count - 1));
    if (p && p.name) newRet.set("name", p.name);
    return { return_track: count - 1, name: p ? p.name : "" };
}

function setReturn(p) {
    var idx = p["return"];
    if (p.name !== undefined)   api(returnPath(idx)).set("name", p.name);
    if (p.volume !== undefined) api(returnPath(idx) + " mixer_device volume").set("value", p.volume);
    if (p.pan !== undefined)    api(returnPath(idx) + " mixer_device panning").set("value", p.pan);
    return { return_track: idx, updated: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// GROOVE
// ═══════════════════════════════════════════════════════════════════════════

function listGrooves() {
    var song = api("live_set");
    var grooveIds = song.get("groove_pool");
    // The groove pool access varies -- in some Live versions it's via
    // the song's groove_pool property
    return {
        note: "Groove pool enumeration requires Live 12+ LOM access. Check Max console for available properties.",
        grooves: []
    };
}

function applyGroove(p) {
    // Groove application is typically done through the clip's groove property
    var clip = api(clipPath(p.track, p.slot));
    // clip.set("groove", groove_id) -- requires knowing the groove slot ID
    return {
        note: "Groove application requires groove pool ID. Use Live's browser to load grooves first.",
        track: p.track,
        slot: p.slot
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION INFO
// ═══════════════════════════════════════════════════════════════════════════

function getSessionInfo() {
    var transport = getTransport();
    var trackList = listTracks();
    var sceneList = listScenes();
    var returnList = listReturns();
    var master = getMaster();

    return {
        transport: transport,
        tracks: trackList.tracks,
        track_count: trackList.count,
        scenes: sceneList.scenes,
        scene_count: sceneList.count,
        returns: returnList.returns,
        return_count: returnList.count,
        master: master
    };
}

function doUndo() {
    api("live_set").call("undo");
    return { undone: true };
}

function doRedo() {
    api("live_set").call("redo");
    return { redone: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO MIXER (analysis functions used by kbot-auto-mixer device)
// ═══════════════════════════════════════════════════════════════════════════

function mixerAnalyze(p) {
    var song = api("live_set");
    var trackIds = song.get("tracks");
    var trackCount = trackIds ? Math.floor(trackIds.length / 2) : 0;

    var analysis = [];
    for (var i = 0; i < trackCount; i++) {
        var t = api(trackPath(i));
        var vol = api(trackPath(i) + " mixer_device volume");

        var meterL = safeGetNum(t, "output_meter_left");
        var meterR = safeGetNum(t, "output_meter_right");
        var rms = (meterL + meterR) / 2;

        // Convert to dB (approximate)
        var rmsDb = rms > 0 ? 20 * Math.log(rms) / Math.LN10 : -100;

        var issues = [];

        // Basic analysis heuristics
        if (rmsDb > -3)  issues.push("clipping_risk");
        if (rmsDb > -6 && rmsDb <= -3) issues.push("hot_signal");
        if (rmsDb < -40 && safeGet(t, "mute") != 1) issues.push("very_quiet");

        analysis.push({
            index: i,
            name: safeGetStr(t, "name"),
            volume: safeGetNum(vol, "value"),
            meter_left: meterL,
            meter_right: meterR,
            rms_db: Math.round(rmsDb * 10) / 10,
            mute: safeGet(t, "mute") == 1,
            solo: safeGet(t, "solo") == 1,
            issues: issues
        });
    }

    // Master analysis
    var master = api("live_set master_track");
    var masterL = safeGetNum(master, "output_meter_left");
    var masterR = safeGetNum(master, "output_meter_right");
    var masterRms = (masterL + masterR) / 2;
    var masterDb = masterRms > 0 ? 20 * Math.log(masterRms) / Math.LN10 : -100;

    // Recommendations
    var recommendations = [];
    for (var j = 0; j < analysis.length; j++) {
        for (var k = 0; k < analysis[j].issues.length; k++) {
            if (analysis[j].issues[k] === "clipping_risk") {
                recommendations.push("Reduce volume on " + analysis[j].name + " (RMS: " + analysis[j].rms_db + " dB)");
            }
        }
    }
    if (masterDb > -6) {
        recommendations.push("Master is hot at " + (Math.round(masterDb * 10) / 10) + " dB -- reduce overall levels or add a limiter");
    }

    return {
        tracks: analysis,
        master: {
            meter_left: masterL,
            meter_right: masterR,
            rms_db: Math.round(masterDb * 10) / 10
        },
        recommendations: recommendations
    };
}

function mixerAutoMix(p) {
    var mode = p.mode || "passive";
    var targetLufs = p.target_lufs || -14;

    if (mode === "passive") {
        return mixerAnalyze(p);
    }

    // Active mode: apply automatic adjustments
    var analysis = mixerAnalyze(p);
    var adjustments = [];

    // Simple auto-mix: normalize all tracks relative to target
    var masterDb = analysis.master.rms_db;
    var correction = targetLufs - masterDb;

    if (Math.abs(correction) > 1) {
        // Adjust master volume
        var masterVol = api("live_set master_track mixer_device volume");
        var currentVol = safeGetNum(masterVol, "value");
        // Volume is 0-1 in Ableton (0.85 is 0dB)
        var newVol = Math.max(0, Math.min(1, currentVol + (correction / 60)));
        masterVol.set("value", newVol);
        adjustments.push("Master volume: " + currentVol.toFixed(2) + " -> " + newVol.toFixed(2));
    }

    analysis.adjustments = adjustments;
    analysis.mode = "active";
    analysis.target_lufs = targetLufs;
    return analysis;
}

function mixerGetStatus(p) {
    return mixerAnalyze(p);
}

// ═══════════════════════════════════════════════════════════════════════════
// MELODY GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

var MELODY_SCALES = {
    "major":            [0, 2, 4, 5, 7, 9, 11],
    "natural_minor":    [0, 2, 3, 5, 7, 8, 10],
    "harmonic_minor":   [0, 2, 3, 5, 7, 8, 11],
    "melodic_minor":    [0, 2, 3, 5, 7, 9, 11],
    "dorian":           [0, 2, 3, 5, 7, 9, 10],
    "phrygian":         [0, 1, 3, 5, 7, 8, 10],
    "lydian":           [0, 2, 4, 6, 7, 9, 11],
    "mixolydian":       [0, 2, 4, 5, 7, 9, 10],
    "minor_pentatonic": [0, 3, 5, 7, 10],
    "major_pentatonic": [0, 2, 4, 7, 9],
    "blues":            [0, 3, 5, 6, 7, 10],
    "whole_tone":       [0, 2, 4, 6, 8, 10],
    "diminished":       [0, 2, 3, 5, 6, 8, 9, 11],
    "hirajoshi":        [0, 2, 3, 7, 8],
    "minor_pentatonic_b5": [0, 3, 5, 6, 10]
};

var NOTE_NAMES = { "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11 };

function noteNameToMidi(name, octave) {
    var val = NOTE_NAMES[name];
    if (val === undefined) val = 0;
    return val + ((octave + 1) * 12);
}

function quantizeToScaleLocal(midi, root, scale) {
    var intervals = MELODY_SCALES[scale] || MELODY_SCALES["natural_minor"];
    var noteInOctave = midi % 12;
    var octave = Math.floor(midi / 12);
    var rootVal = NOTE_NAMES[root] || 0;

    // Find closest scale degree
    var relative = ((noteInOctave - rootVal) + 12) % 12;
    var closest = intervals[0];
    var minDist = 99;

    for (var i = 0; i < intervals.length; i++) {
        var dist = Math.abs(intervals[i] - relative);
        if (dist < minDist) {
            minDist = dist;
            closest = intervals[i];
        }
    }

    return octave * 12 + ((rootVal + closest) % 12);
}

function melodyGenerate(p) {
    var root = p.root || "C";
    var scale = p.scale || "natural_minor";
    var octave = p.octave || 4;
    var density = p.density !== undefined ? p.density : 0.5;
    var bars = p.length_bars || 4;
    var style = p.style || "trap_melody";
    var subdivision = p.rhythm || "16th";
    var velCurve = p.velocity_curve || "humanize";
    var noteLen = p.note_length || 0.5;
    var prob = p.probability !== undefined ? p.probability : 0.7;
    var leapProb = p.leap_probability !== undefined ? p.leap_probability : 0.2;
    var repetition = p.repetition !== undefined ? p.repetition : 0.3;

    var stepsPerBeat = (subdivision === "32nd") ? 8 : (subdivision === "16th") ? 4 : (subdivision === "8th") ? 2 : 1;
    var totalSteps = bars * 4 * stepsPerBeat;
    var stepDuration = 1.0 / stepsPerBeat; // in beats

    var intervals = MELODY_SCALES[scale] || MELODY_SCALES["natural_minor"];
    var rootMidi = noteNameToMidi(root, octave);

    // Build scale across 2 octaves
    var scaleNotes = [];
    for (var oct = octave - 1; oct <= octave + 1; oct++) {
        for (var s = 0; s < intervals.length; s++) {
            scaleNotes.push(noteNameToMidi(root, oct) + intervals[s]);
        }
    }

    var notes = [];
    var prevNote = rootMidi;
    var prevScaleIdx = Math.floor(scaleNotes.length / 2); // Start in middle of range

    for (var step = 0; step < totalSteps; step++) {
        var beat = step * stepDuration;

        // Decide if this step has a note (based on density and style)
        var shouldPlay = Math.random() < prob * density;

        // Style-specific modifications
        if (style === "trap_melody") {
            // Trap melodies: sparse, occasional 16th runs, lots of rests
            if (step % (stepsPerBeat * 4) === 0) shouldPlay = true; // Always play on bar downbeat
            if (step % stepsPerBeat === 0 && Math.random() < 0.6) shouldPlay = true; // Beat emphasis
        } else if (style === "drill_melody") {
            // Drill: repetitive, minor 2nd intervals, aggressive
            if (step % 2 === 0) shouldPlay = Math.random() < 0.7;
            repetition = 0.5; // High repetition
        } else if (style === "lofi_melody") {
            // Lo-fi: slow, jazzy, lots of sustained notes
            if (step % (stepsPerBeat * 2) === 0) shouldPlay = true;
            noteLen = 1.0; // Longer notes
        } else if (style === "ambient") {
            // Ambient: very sparse, long notes
            shouldPlay = Math.random() < density * 0.3;
            if (step % (stepsPerBeat * 8) === 0) shouldPlay = true;
            noteLen = 2.0;
        } else if (style === "arpeggio") {
            // Arpeggio: sequential scale notes
            shouldPlay = true;
            prevScaleIdx = (prevScaleIdx + 1) % scaleNotes.length;
        }

        if (!shouldPlay) continue;

        // Choose the next note
        var nextNote;
        if (Math.random() < repetition && notes.length > 0) {
            // Repeat previous note
            nextNote = prevNote;
        } else if (Math.random() < leapProb) {
            // Leap: jump 3-7 scale degrees
            var leap = Math.floor(Math.random() * 5) + 3;
            if (Math.random() < 0.5) leap = -leap;
            var newIdx = Math.max(0, Math.min(scaleNotes.length - 1, prevScaleIdx + leap));
            nextNote = scaleNotes[newIdx];
            prevScaleIdx = newIdx;
        } else {
            // Step: move 1-2 scale degrees
            var stepSize = Math.random() < 0.6 ? 1 : 2;
            if (Math.random() < 0.5) stepSize = -stepSize;
            var newIdx2 = Math.max(0, Math.min(scaleNotes.length - 1, prevScaleIdx + stepSize));
            nextNote = scaleNotes[newIdx2];
            prevScaleIdx = newIdx2;
        }

        // Velocity
        var velocity;
        if (velCurve === "flat") {
            velocity = 100;
        } else if (velCurve === "accent") {
            velocity = (step % stepsPerBeat === 0) ? 110 : 80;
        } else if (velCurve === "crescendo") {
            velocity = Math.floor(60 + (step / totalSteps) * 60);
        } else {
            // humanize
            velocity = Math.floor(80 + Math.random() * 40);
        }

        notes.push({
            pitch: nextNote,
            start: beat,
            duration: noteLen * (0.8 + Math.random() * 0.4), // Slight duration variation
            velocity: Math.min(127, Math.max(1, velocity))
        });

        prevNote = nextNote;
    }

    // Write to clip if track/slot specified
    if (p.track !== undefined && p.slot !== undefined) {
        // Ensure clip exists
        var slot = api(clipSlotPath(p.track, p.slot));
        var hasClip = safeGet(slot, "has_clip") == 1;
        if (!hasClip) {
            slot.call("create_clip", bars * 4.0);
        }

        // Write notes
        var clip = api(clipPath(p.track, p.slot));
        clip.call("remove_notes", 0, 0, bars * 4.0, 128);
        clip.call("begin_add_notes");
        for (var n = 0; n < notes.length; n++) {
            clip.call("add_note",
                notes[n].pitch,
                notes[n].start,
                notes[n].duration,
                notes[n].velocity,
                0 // mute = false
            );
        }
        clip.call("finish_add_notes");

        return {
            track: p.track,
            slot: p.slot,
            notes_generated: notes.length,
            bars: bars,
            root: root,
            scale: scale,
            style: style,
            written_to_clip: true
        };
    }

    // Return notes without writing (for preview)
    return {
        notes: notes,
        notes_count: notes.length,
        bars: bars,
        root: root,
        scale: scale,
        style: style,
        written_to_clip: false
    };
}

// ── Initialization ─────────────────────────────────────────────────────────

post("kbot-bridge-lom.js loaded -- " + Object.keys(dispatch).length + " actions available\n");
