/**
 * kbot-bridge.js — Max for Live JavaScript (runs in [js] object)
 *
 * Receives JSON commands from kbot-bridge-server.js (via Node for Max),
 * executes them against Ableton Live's LOM using the LiveAPI, and sends
 * JSON responses back.
 *
 * Patching:
 *   [node.script kbot-bridge-server.js]
 *        |  (outlet: "command" <json>)
 *        v
 *   [route command status]
 *        |
 *        v
 *   [js kbot-bridge.js]
 *        |  (outlet 0: "response" <json>)
 *        v
 *   [node.script kbot-bridge-server.js]  (via [send]/[receive] or direct)
 *
 * LiveAPI reference:
 *   var api = new LiveAPI(callback, "live_set");
 *   api.goto("live_set tracks 0");
 *   api.get("name");           // returns value
 *   api.set("name", "X");      // sets value
 *   api.call("method", args);  // calls method
 *   api.getcount("children");  // child count
 *   api.id                     // 0 = invalid
 */

// Max for Live globals
inlets = 1;
outlets = 1;
autowatch = 1;

// ── Helpers ────────────────────────────────────────────────────────────────

function reply(id, data) {
  var resp = { id: id, ok: true };
  for (var k in data) {
    if (data.hasOwnProperty(k)) resp[k] = data[k];
  }
  outlet(0, "response", JSON.stringify(resp));
}

function replyError(id, msg) {
  outlet(0, "response", JSON.stringify({ id: id, ok: false, error: String(msg) }));
}

function liveAPI(path) {
  var api = new LiveAPI(function () {}, path || "live_set");
  return api;
}

function trackAPI(index) {
  var api = new LiveAPI(function () {}, "live_set");
  api.goto("live_set tracks " + index);
  if (api.id === 0) throw new Error("Track " + index + " not found");
  return api;
}

function clipAPI(track, slot) {
  var api = new LiveAPI(function () {}, "live_set");
  api.goto("live_set tracks " + track + " clip_slots " + slot + " clip");
  if (api.id === 0) throw new Error("Clip not found at track " + track + " slot " + slot);
  return api;
}

function clipSlotAPI(track, slot) {
  var api = new LiveAPI(function () {}, "live_set");
  api.goto("live_set tracks " + track + " clip_slots " + slot);
  if (api.id === 0) throw new Error("Clip slot not found at track " + track + " slot " + slot);
  return api;
}

function deviceAPI(track, device) {
  var api = new LiveAPI(function () {}, "live_set");
  api.goto("live_set tracks " + track + " devices " + device);
  if (api.id === 0) throw new Error("Device " + device + " not found on track " + track);
  return api;
}

/**
 * Unwrap LiveAPI.get() return values.
 * LiveAPI.get() returns an array-like for some types. For single values
 * it often returns [value]. This normalizes the result.
 */
function unwrap(val) {
  if (val === undefined || val === null) return null;
  // LiveAPI returns arrays for multi-value properties
  if (typeof val === "object" && val.length !== undefined) {
    if (val.length === 0) return null;
    if (val.length === 1) return val[0];
    // Convert to a real JS array
    var arr = [];
    for (var i = 0; i < val.length; i++) arr.push(val[i]);
    return arr;
  }
  return val;
}

/**
 * Parse a string that might be "true"/"false"/number back to JS type
 */
function coerce(val) {
  if (val === "true" || val === 1) return true;
  if (val === "false" || val === 0) return false;
  var n = Number(val);
  if (!isNaN(n) && String(val).length > 0) return n;
  return val;
}

// ── Command dispatch ───────────────────────────────────────────────────────

/**
 * Entry point: called from Max when a message arrives.
 * The first argument is the JSON string of the command.
 */
function anything() {
  var args = arrayfromargs(messagename, arguments);
  var raw = args.join(" ");

  var cmd;
  try {
    cmd = JSON.parse(raw);
  } catch (e) {
    post("kbot-bridge: invalid JSON: " + raw + "\n");
    return;
  }

  var id = cmd.id != null ? cmd.id : null;
  var action = cmd.action;

  try {
    switch (action) {
      case "ping":
        handlePing(id, cmd);
        break;
      case "get_session_info":
        handleGetSessionInfo(id, cmd);
        break;
      case "start_playing":
        handleStartPlaying(id, cmd);
        break;
      case "stop_playing":
        handleStopPlaying(id, cmd);
        break;
      case "set_tempo":
        handleSetTempo(id, cmd);
        break;
      case "set_clip_trigger_quantization":
        handleSetClipTriggerQuantization(id, cmd);
        break;
      case "create_midi_track":
        handleCreateMidiTrack(id, cmd);
        break;
      case "delete_track":
        handleDeleteTrack(id, cmd);
        break;
      case "set_track_name":
        handleSetTrackName(id, cmd);
        break;
      case "set_track_color":
        handleSetTrackColor(id, cmd);
        break;
      case "mute_track":
        handleMuteTrack(id, cmd);
        break;
      case "arm_track":
        handleArmTrack(id, cmd);
        break;
      case "set_volume":
        handleSetVolume(id, cmd);
        break;
      case "set_send":
        handleSetSend(id, cmd);
        break;
      case "get_track_info":
        handleGetTrackInfo(id, cmd);
        break;
      case "create_clip":
        handleCreateClip(id, cmd);
        break;
      case "add_notes":
        handleAddNotes(id, cmd);
        break;
      case "get_notes":
        handleGetNotes(id, cmd);
        break;
      case "remove_notes":
        handleRemoveNotes(id, cmd);
        break;
      case "fire_clip":
        handleFireClip(id, cmd);
        break;
      case "load_plugin":
        handleLoadPlugin(id, cmd);
        break;
      case "load_sample_to_pad":
        handleLoadSampleToPad(id, cmd);
        break;
      case "get_device_params":
        handleGetDeviceParams(id, cmd);
        break;
      case "set_param":
        handleSetParam(id, cmd);
        break;
      case "list_plugins":
        handleListPlugins(id, cmd);
        break;
      case "browse_and_load":
        handleBrowseAndLoad(id, cmd);
        break;
      case "get_drum_pads":
        handleGetDrumPads(id, cmd);
        break;
      case "lom_get":
        handleLomGet(id, cmd);
        break;
      case "lom_set":
        handleLomSet(id, cmd);
        break;
      case "lom_call":
        handleLomCall(id, cmd);
        break;
      default:
        replyError(id, "unknown_action: " + action);
    }
  } catch (err) {
    replyError(id, String(err));
  }
}

// ── Handlers ───────────────────────────────────────────────────────────────

// --- ping ---
function handlePing(id) {
  reply(id, { action: "pong", version: "1.0.0", bridge: "m4l-liveapi" });
}

// --- get_session_info ---
function handleGetSessionInfo(id) {
  var song = liveAPI("live_set");
  var tempo = coerce(unwrap(song.get("tempo")));
  var playing = coerce(unwrap(song.get("is_playing")));
  var recording = coerce(unwrap(song.get("record_mode")));
  var sigNum = coerce(unwrap(song.get("signature_numerator")));
  var sigDen = coerce(unwrap(song.get("signature_denominator")));
  var songTime = coerce(unwrap(song.get("current_song_time")));

  var numTracks = song.getcount("tracks");
  var numScenes = song.getcount("scenes");
  var numReturns = song.getcount("return_tracks");

  var tracks = [];
  for (var i = 0; i < numTracks; i++) {
    try {
      var t = trackAPI(i);
      var info = {
        index: i,
        name: unwrap(t.get("name")),
        volume: coerce(unwrap(t.get("volume"))),
        panning: coerce(unwrap(t.get("panning"))),
        mute: coerce(unwrap(t.get("mute"))),
        solo: coerce(unwrap(t.get("solo"))),
        arm: coerce(unwrap(t.get("arm"))),
        color: coerce(unwrap(t.get("color"))),
      };
      // Device count
      info.device_count = t.getcount("devices");
      tracks.push(info);
    } catch (e) {
      // skip inaccessible tracks
    }
  }

  reply(id, {
    tempo: tempo,
    playing: playing,
    recording: recording,
    signature: sigNum + "/" + sigDen,
    song_time: songTime,
    track_count: numTracks,
    scene_count: numScenes,
    return_count: numReturns,
    tracks: tracks,
  });
}

// --- start_playing ---
function handleStartPlaying(id) {
  var song = liveAPI("live_set");
  song.call("start_playing");
  reply(id, { action: "start_playing" });
}

// --- stop_playing ---
function handleStopPlaying(id) {
  var song = liveAPI("live_set");
  song.call("stop_playing");
  reply(id, { action: "stop_playing" });
}

// --- set_tempo ---
function handleSetTempo(id, cmd) {
  var bpm = cmd.bpm;
  if (bpm == null || bpm < 20 || bpm > 999) {
    replyError(id, "bpm must be between 20 and 999");
    return;
  }
  var song = liveAPI("live_set");
  song.set("tempo", bpm);
  reply(id, { action: "set_tempo", bpm: bpm });
}

// --- set_clip_trigger_quantization ---
function handleSetClipTriggerQuantization(id, cmd) {
  var val = cmd.value != null ? cmd.value : 0;
  var song = liveAPI("live_set");
  song.set("clip_trigger_quantization", val);
  reply(id, { action: "set_clip_trigger_quantization", value: val });
}

// --- create_midi_track ---
function handleCreateMidiTrack(id, cmd) {
  var index = cmd.index != null ? cmd.index : -1;
  var song = liveAPI("live_set");
  song.call("create_midi_track", index);
  var newCount = song.getcount("tracks");
  reply(id, { action: "create_midi_track", track_count: newCount });
}

// --- delete_track ---
function handleDeleteTrack(id, cmd) {
  var track = cmd.track;
  if (track == null) {
    replyError(id, "track index required");
    return;
  }
  var song = liveAPI("live_set");
  song.call("delete_track", track);
  reply(id, { action: "delete_track", track: track });
}

// --- set_track_name ---
function handleSetTrackName(id, cmd) {
  var t = trackAPI(cmd.track);
  t.set("name", String(cmd.name));
  reply(id, { action: "set_track_name", track: cmd.track, name: cmd.name });
}

// --- set_track_color ---
function handleSetTrackColor(id, cmd) {
  var t = trackAPI(cmd.track);
  t.set("color", cmd.color);
  reply(id, { action: "set_track_color", track: cmd.track, color: cmd.color });
}

// --- mute_track ---
function handleMuteTrack(id, cmd) {
  var t = trackAPI(cmd.track);
  var mute = cmd.mute ? 1 : 0;
  t.set("mute", mute);
  reply(id, { action: "mute_track", track: cmd.track, mute: !!cmd.mute });
}

// --- arm_track ---
function handleArmTrack(id, cmd) {
  var t = trackAPI(cmd.track);
  var arm = cmd.arm ? 1 : 0;
  t.set("arm", arm);
  reply(id, { action: "arm_track", track: cmd.track, arm: !!cmd.arm });
}

// --- set_volume ---
function handleSetVolume(id, cmd) {
  var t = trackAPI(cmd.track);
  var vol = Math.max(0, Math.min(1, cmd.volume));
  // Ableton mixer volume: the LOM property is "mixer_device volume value"
  // but the simpler approach via the track's mixer_device:
  var mixer = new LiveAPI(function () {}, "live_set tracks " + cmd.track + " mixer_device volume");
  if (mixer.id === 0) {
    // Fallback: some versions expose volume directly
    replyError(id, "Could not access mixer_device volume for track " + cmd.track);
    return;
  }
  mixer.set("value", vol);
  reply(id, { action: "set_volume", track: cmd.track, volume: vol });
}

// --- set_send ---
function handleSetSend(id, cmd) {
  var sendIndex = cmd.send != null ? cmd.send : 0;
  var level = Math.max(0, Math.min(1, cmd.level));
  var send = new LiveAPI(
    function () {},
    "live_set tracks " + cmd.track + " mixer_device sends " + sendIndex
  );
  if (send.id === 0) {
    replyError(id, "Send " + sendIndex + " not found on track " + cmd.track);
    return;
  }
  send.set("value", level);
  reply(id, { action: "set_send", track: cmd.track, send: sendIndex, level: level });
}

// --- get_track_info ---
function handleGetTrackInfo(id, cmd) {
  var t = trackAPI(cmd.track);
  var info = {
    index: cmd.track,
    name: unwrap(t.get("name")),
    volume: coerce(unwrap(t.get("volume"))),
    panning: coerce(unwrap(t.get("panning"))),
    mute: coerce(unwrap(t.get("mute"))),
    solo: coerce(unwrap(t.get("solo"))),
    arm: coerce(unwrap(t.get("arm"))),
    color: coerce(unwrap(t.get("color"))),
    has_midi_input: coerce(unwrap(t.get("has_midi_input"))),
    has_audio_input: coerce(unwrap(t.get("has_audio_input"))),
  };

  // Devices
  var deviceCount = t.getcount("devices");
  info.devices = [];
  for (var d = 0; d < deviceCount; d++) {
    try {
      var dev = deviceAPI(cmd.track, d);
      info.devices.push({
        index: d,
        name: unwrap(dev.get("name")),
        class_name: unwrap(dev.get("class_name")),
        enabled: coerce(unwrap(dev.get("is_active"))),
      });
    } catch (e) {
      // skip
    }
  }

  // Clip slots
  var slotCount = t.getcount("clip_slots");
  info.clip_slots = [];
  for (var s = 0; s < Math.min(slotCount, 32); s++) {
    try {
      var cs = clipSlotAPI(cmd.track, s);
      var hasClip = coerce(unwrap(cs.get("has_clip")));
      var slotInfo = { index: s, has_clip: hasClip };
      if (hasClip) {
        try {
          var c = clipAPI(cmd.track, s);
          slotInfo.clip_name = unwrap(c.get("name"));
          slotInfo.clip_length = coerce(unwrap(c.get("length")));
          slotInfo.looping = coerce(unwrap(c.get("looping")));
        } catch (e) {
          // clip inaccessible
        }
      }
      info.clip_slots.push(slotInfo);
    } catch (e) {
      // slot inaccessible
    }
  }

  reply(id, info);
}

// --- create_clip ---
function handleCreateClip(id, cmd) {
  var track = cmd.track;
  var slot = cmd.slot;
  var length = cmd.length || 4;

  var cs = clipSlotAPI(track, slot);
  cs.call("create_clip", length);

  // Optionally set name
  if (cmd.name) {
    try {
      var c = clipAPI(track, slot);
      c.set("name", String(cmd.name));
    } catch (e) {
      // clip may not be immediately accessible
    }
  }

  reply(id, { action: "create_clip", track: track, slot: slot, length: length });
}

// --- add_notes ---
function handleAddNotes(id, cmd) {
  var track = cmd.track;
  var slot = cmd.slot;
  var notes = cmd.notes; // [[pitch, time, duration, velocity], ...]

  if (!notes || !notes.length) {
    replyError(id, "notes array required");
    return;
  }

  var clip = clipAPI(track, slot);

  // LiveAPI note manipulation:
  // clip.call("set_notes") prepares, then clip.call("notes", count),
  // then for each note: clip.call("note", pitch, time, duration, velocity, muted)
  //
  // Alternative in newer API: clip.call("add_new_notes") with a dict
  // The set_notes/notes/note pattern is the classic M4L approach:
  clip.call("deselect_all_notes");
  clip.call("set_notes");
  clip.call("notes", notes.length);
  for (var i = 0; i < notes.length; i++) {
    var n = notes[i];
    var pitch = n[0];
    var time = n[1];
    var dur = n[2] || 0.25;
    var vel = n[3] || 100;
    var muted = n[4] || 0;
    clip.call("note", pitch, time.toFixed(6), dur.toFixed(6), vel, muted);
  }
  clip.call("done");

  reply(id, { action: "add_notes", track: track, slot: slot, count: notes.length });
}

// --- get_notes ---
function handleGetNotes(id, cmd) {
  var track = cmd.track;
  var slot = cmd.slot;

  var clip = clipAPI(track, slot);
  var length = coerce(unwrap(clip.get("length")));

  // get_notes returns: "notes" count, then "note" pitch time dur vel muted for each
  // In M4L js, we use get_notes with (start_time, start_pitch, time_span, pitch_span)
  clip.call("select_all_notes");
  var rawNotes = clip.call("get_selected_notes");

  // Parse the note data from the returned values
  // get_selected_notes triggers a callback-based flow in M4L.
  // A simpler approach: use get_notes_extended or the notes property.
  // In practice, the call returns data to the callback. For synchronous access:
  var notes = [];

  // Use the direct approach: call get_notes with full range
  // This returns data via the js callback mechanism. For a [js] object,
  // clip.call("get_notes", 0, 0, length + 1, 128) won't return inline.
  //
  // Workaround: use clip.call("select_all_notes") then
  // clip.call("get_selected_notes_extended") if available,
  // or iterate over the note data that comes back.
  //
  // In the M4L JS context, get_selected_notes returns a flat array:
  // ["notes", count, "note", pitch, time, dur, vel, muted, "note", ...]
  if (rawNotes !== undefined && rawNotes !== null) {
    var data;
    if (typeof rawNotes === "object" && rawNotes.length !== undefined) {
      data = [];
      for (var r = 0; r < rawNotes.length; r++) data.push(rawNotes[r]);
    } else {
      data = [rawNotes];
    }

    // Parse: skip "notes", read count, then groups of 6 ("note", pitch, time, dur, vel, muted)
    var idx = 0;
    if (data[idx] === "notes") idx++;
    var count = parseInt(data[idx], 10) || 0;
    idx++;
    for (var n = 0; n < count; n++) {
      if (data[idx] === "note") idx++;
      if (idx + 4 <= data.length) {
        notes.push({
          pitch: parseInt(data[idx], 10),
          time: parseFloat(data[idx + 1]),
          duration: parseFloat(data[idx + 2]),
          velocity: parseInt(data[idx + 3], 10),
          muted: data[idx + 4] ? true : false,
        });
        idx += 5;
      }
    }
  }

  clip.call("deselect_all_notes");

  reply(id, {
    action: "get_notes",
    track: track,
    slot: slot,
    length: length,
    notes: notes,
  });
}

// --- remove_notes ---
function handleRemoveNotes(id, cmd) {
  var clip = clipAPI(cmd.track, cmd.slot);
  var length = coerce(unwrap(clip.get("length")));
  // remove_notes(start_time, start_pitch, time_span, pitch_span)
  clip.call("remove_notes", 0, 0, length + 1, 128);
  reply(id, { action: "remove_notes", track: cmd.track, slot: cmd.slot });
}

// --- fire_clip ---
function handleFireClip(id, cmd) {
  var cs = clipSlotAPI(cmd.track, cmd.slot);
  cs.call("fire");
  reply(id, { action: "fire_clip", track: cmd.track, slot: cmd.slot });
}

// --- load_plugin ---
function handleLoadPlugin(id, cmd) {
  // In Max for Live, we cannot directly browse and load devices via LiveAPI alone.
  // The Browser API is only available from the Python Control Surface scripts.
  // However, we CAN:
  //  1. Select the target track
  //  2. Use LiveAPI to navigate the browser if available
  //  3. Fall back to creating an empty track and reporting what to do
  //
  // The best M4L approach: use the "live_app browser" path to access the browser.

  var track = cmd.track;
  var name = cmd.name || "";
  var manufacturer = cmd.manufacturer || "";

  // Select the track
  var song = liveAPI("live_set");
  var view = new LiveAPI(function () {}, "live_set view");
  var targetTrack = new LiveAPI(function () {}, "live_set tracks " + track);
  if (targetTrack.id === 0) {
    replyError(id, "Track " + track + " not found");
    return;
  }
  view.set("selected_track", "id", targetTrack.id);

  // Try to access the browser
  var browser = new LiveAPI(function () {}, "live_app browser");
  if (browser.id !== 0) {
    // We have browser access. Use hotswap or filter approach.
    // In practice, the M4L browser API is limited. We can:
    // - Access browser.filter_type
    // - Check browser hotswap state
    // But full search/load requires iterating browser items which is slow.
    //
    // Strategy: set the browser filter and rely on user/kbot to use
    // the browse_and_load action which does the tree walk.
    reply(id, {
      action: "load_plugin",
      status: "track_selected",
      track: track,
      name: name,
      manufacturer: manufacturer,
      note: "Track selected. Use browse_and_load for browser-based loading, or load a device via Ableton's browser manually.",
    });
  } else {
    reply(id, {
      action: "load_plugin",
      status: "track_selected",
      track: track,
      name: name,
      manufacturer: manufacturer,
      note: "Browser API not available via LiveAPI. Track has been selected — use Ableton's browser or the Python bridge for device loading.",
    });
  }
}

// --- load_sample_to_pad ---
function handleLoadSampleToPad(id, cmd) {
  var track = cmd.track;
  var pad = cmd.pad; // MIDI note number (36 = C1, etc.)
  var path = cmd.path;

  // Navigate to the drum rack on the track
  var dev = deviceAPI(track, 0);
  var className = unwrap(dev.get("class_name"));

  if (className !== "DrumGroupDevice") {
    replyError(id, "First device on track " + track + " is " + className + ", not a DrumGroupDevice");
    return;
  }

  // Select the track and drum pad for view context
  var view = new LiveAPI(function () {}, "live_set view");
  var targetTrack = new LiveAPI(function () {}, "live_set tracks " + track);
  view.set("selected_track", "id", targetTrack.id);

  // Navigate to the specific drum pad
  var drumPad = new LiveAPI(
    function () {},
    "live_set tracks " + track + " devices 0 drum_pads " + pad
  );

  if (drumPad.id === 0) {
    replyError(id, "Drum pad " + pad + " not found");
    return;
  }

  // Select the drum pad in the device view
  var devView = new LiveAPI(
    function () {},
    "live_set tracks " + track + " devices 0 view"
  );
  devView.set("selected_drum_pad", "id", drumPad.id);

  // Get pad name for confirmation
  var padName = unwrap(drumPad.get("name"));

  // For file loading: M4L LiveAPI cannot directly call browser.load_item()
  // with an arbitrary file path. The standard approach is:
  //  1. Select the pad (done above)
  //  2. Use the browser's hotswap mechanism or
  //  3. Fall back to the Python bridge for actual file loading
  //
  // What we CAN do: if the pad already has a Simpler/Sampler chain,
  // we can set the sample path directly on the Simpler device.

  // Check if the pad has chains with a Simpler device
  var chainsCount = drumPad.getcount("chains");
  if (chainsCount > 0) {
    // Try to access the Simpler inside the pad's chain
    var simpler = new LiveAPI(
      function () {},
      "live_set tracks " + track + " devices 0 drum_pads " + pad + " chains 0 devices 0"
    );
    if (simpler.id !== 0) {
      var simplerClass = unwrap(simpler.get("class_name"));
      if (simplerClass === "OriginalSimpler" || simplerClass === "MultiSampler") {
        // Access the sample via the simpler's sample slot
        // For OriginalSimpler: sample.sample_file_path (read only in some versions)
        // The workaround: use simpler's "sample" child to get/set
        try {
          var sample = new LiveAPI(
            function () {},
            "live_set tracks " + track +
              " devices 0 drum_pads " + pad +
              " chains 0 devices 0 sample"
          );
          if (sample.id !== 0) {
            sample.set("file_path", path);
            reply(id, {
              action: "load_sample_to_pad",
              track: track,
              pad: pad,
              pad_name: padName,
              path: path,
              method: "simpler_file_path",
            });
            return;
          }
        } catch (e) {
          // file_path might be read-only; fall through
        }
      }
    }
  }

  // Pad selected but no direct load possible — report state
  reply(id, {
    action: "load_sample_to_pad",
    track: track,
    pad: pad,
    pad_name: padName,
    path: path,
    status: "pad_selected",
    note:
      "Drum pad " + pad + " selected in view. " +
      "Direct file loading requires the Python bridge (load_sample_file). " +
      "The pad is ready for browser-based loading.",
  });
}

// --- get_device_params ---
function handleGetDeviceParams(id, cmd) {
  var dev = deviceAPI(cmd.track, cmd.device);
  var name = unwrap(dev.get("name"));
  var className = unwrap(dev.get("class_name"));
  var paramCount = dev.getcount("parameters");

  var params = [];
  for (var i = 0; i < paramCount; i++) {
    try {
      var p = new LiveAPI(
        function () {},
        "live_set tracks " + cmd.track + " devices " + cmd.device + " parameters " + i
      );
      if (p.id !== 0) {
        params.push({
          index: i,
          name: unwrap(p.get("name")),
          value: coerce(unwrap(p.get("value"))),
          min: coerce(unwrap(p.get("min"))),
          max: coerce(unwrap(p.get("max"))),
          is_quantized: coerce(unwrap(p.get("is_quantized"))),
        });
      }
    } catch (e) {
      // skip inaccessible param
    }
  }

  reply(id, {
    action: "get_device_params",
    track: cmd.track,
    device: cmd.device,
    device_name: name,
    class_name: className,
    parameters: params,
  });
}

// --- set_param ---
function handleSetParam(id, cmd) {
  var dev = deviceAPI(cmd.track, cmd.device);
  var paramCount = dev.getcount("parameters");
  var paramName = (cmd.param || "").toLowerCase();
  var value = cmd.value;

  // Search by name
  for (var i = 0; i < paramCount; i++) {
    var p = new LiveAPI(
      function () {},
      "live_set tracks " + cmd.track + " devices " + cmd.device + " parameters " + i
    );
    if (p.id !== 0) {
      var pName = unwrap(p.get("name"));
      if (pName && pName.toLowerCase() === paramName) {
        var pMin = coerce(unwrap(p.get("min")));
        var pMax = coerce(unwrap(p.get("max")));
        var clamped = Math.max(pMin, Math.min(pMax, value));
        p.set("value", clamped);
        reply(id, {
          action: "set_param",
          track: cmd.track,
          device: cmd.device,
          param: pName,
          value: clamped,
          min: pMin,
          max: pMax,
        });
        return;
      }
    }
  }

  replyError(id, "Parameter '" + cmd.param + "' not found on device " + cmd.device);
}

// --- list_plugins ---
function handleListPlugins(id) {
  // In M4L, we cannot enumerate the browser's plugin list via LiveAPI.
  // Instead, we list all devices currently loaded on all tracks.
  var song = liveAPI("live_set");
  var numTracks = song.getcount("tracks");
  var devices = [];
  var seen = {};

  for (var t = 0; t < numTracks; t++) {
    var track = trackAPI(t);
    var devCount = track.getcount("devices");
    for (var d = 0; d < devCount; d++) {
      try {
        var dev = deviceAPI(t, d);
        var devName = unwrap(dev.get("name"));
        var devClass = unwrap(dev.get("class_name"));
        var key = devClass + ":" + devName;
        if (!seen[key]) {
          seen[key] = true;
          devices.push({
            name: devName,
            class_name: devClass,
            track: t,
            device_index: d,
          });
        }
      } catch (e) {
        // skip
      }
    }
  }

  reply(id, {
    action: "list_plugins",
    note: "Lists devices currently loaded in session. For full browser enumeration, use the Python bridge.",
    devices: devices,
  });
}

// --- browse_and_load ---
function handleBrowseAndLoad(id, cmd) {
  var track = cmd.track;
  var category = cmd.category || "instruments";
  var search = cmd.search || "";

  // Select the target track
  var view = new LiveAPI(function () {}, "live_set view");
  var targetTrack = new LiveAPI(function () {}, "live_set tracks " + track);
  if (targetTrack.id === 0) {
    replyError(id, "Track " + track + " not found");
    return;
  }
  view.set("selected_track", "id", targetTrack.id);

  // Try the application browser
  var browser = new LiveAPI(function () {}, "live_app browser");
  if (browser.id === 0) {
    replyError(
      id,
      "Browser API not accessible via LiveAPI. Use the Python bridge for browse_and_load."
    );
    return;
  }

  // The M4L LiveAPI browser access is limited compared to the Python API.
  // We can access some properties but not iterate browser items reliably.
  // Set the filter type to help narrow search:
  //   0 = All, 1 = Sounds, 2 = Drums, 3 = Instruments,
  //   4 = Audio Effects, 5 = MIDI Effects, 6 = Max for Live,
  //   7 = Plugins, 8 = Clips, 9 = Samples
  var filterMap = {
    instruments: 3,
    sounds: 1,
    drums: 2,
    audio_effects: 4,
    midi_effects: 5,
    plugins: 7,
    samples: 9,
    clips: 8,
  };
  var filterType = filterMap[category] || 0;

  try {
    browser.set("filter_type", filterType);
  } catch (e) {
    // filter_type may not be settable in all versions
  }

  reply(id, {
    action: "browse_and_load",
    track: track,
    category: category,
    search: search,
    status: "browser_prepared",
    filter_type: filterType,
    note:
      "Browser filter set to " + category + ". " +
      "Full browser tree search requires the Python bridge. " +
      "Track " + track + " is selected and ready.",
  });
}

// --- get_drum_pads ---
function handleGetDrumPads(id, cmd) {
  var dev = deviceAPI(cmd.track, 0);
  var className = unwrap(dev.get("class_name"));

  if (className !== "DrumGroupDevice") {
    replyError(id, "First device on track " + cmd.track + " is " + className + ", not a DrumGroupDevice");
    return;
  }

  // Drum pads are indexed by MIDI note (0-127), but the standard range is 0-127
  // with the visible 4x4 pad grid typically starting at pad 36 (C1).
  // DrumGroupDevice has 128 drum_pads children.
  var pads = [];
  var padCount = dev.getcount("drum_pads");

  for (var i = 0; i < padCount; i++) {
    try {
      var dp = new LiveAPI(
        function () {},
        "live_set tracks " + cmd.track + " devices 0 drum_pads " + i
      );
      if (dp.id !== 0) {
        var chainsCount = dp.getcount("chains");
        if (chainsCount > 0) {
          // Pad has content
          pads.push({
            note: i,
            name: unwrap(dp.get("name")),
            chains: chainsCount,
          });
        }
      }
    } catch (e) {
      // skip
    }
  }

  reply(id, {
    action: "get_drum_pads",
    track: cmd.track,
    pads: pads,
  });
}

// --- lom_get ---
function handleLomGet(id, cmd) {
  // Generic LOM getter
  // Path format: "live_set tracks 0 devices 0 parameters 1 value"
  // We split off the last word as the property to get
  var fullPath = cmd.path;
  var parts = fullPath.split(" ");

  if (parts.length < 2) {
    replyError(id, "Path too short. Need at least object + property.");
    return;
  }

  var property = parts.pop();
  var objPath = parts.join(" ");

  var api = new LiveAPI(function () {}, objPath);
  if (api.id === 0) {
    replyError(id, "LOM object not found: " + objPath);
    return;
  }

  var val = unwrap(api.get(property));
  reply(id, {
    action: "lom_get",
    path: fullPath,
    value: coerce(val),
  });
}

// --- lom_set ---
function handleLomSet(id, cmd) {
  // Generic LOM setter
  // path: the object path (e.g., "live_set tracks 0 devices 0 parameters 1")
  // property: the property name (e.g., "value")
  // value: the value to set
  var objPath = cmd.path;
  var property = cmd.property;
  var value = cmd.value;

  var api = new LiveAPI(function () {}, objPath);
  if (api.id === 0) {
    replyError(id, "LOM object not found: " + objPath);
    return;
  }

  api.set(property, value);
  reply(id, {
    action: "lom_set",
    path: objPath,
    property: property,
    value: value,
  });
}

// --- lom_call ---
function handleLomCall(id, cmd) {
  // Generic LOM method call
  // path: the object path
  // method: the method name
  // args (optional): array of arguments
  var objPath = cmd.path;
  var method = cmd.method;
  var args = cmd.args || [];

  var api = new LiveAPI(function () {}, objPath);
  if (api.id === 0) {
    replyError(id, "LOM object not found: " + objPath);
    return;
  }

  var result;
  switch (args.length) {
    case 0:
      result = api.call(method);
      break;
    case 1:
      result = api.call(method, args[0]);
      break;
    case 2:
      result = api.call(method, args[0], args[1]);
      break;
    case 3:
      result = api.call(method, args[0], args[1], args[2]);
      break;
    case 4:
      result = api.call(method, args[0], args[1], args[2], args[3]);
      break;
    case 5:
      result = api.call(method, args[0], args[1], args[2], args[3], args[4]);
      break;
    default:
      // For more args, use apply-style (M4L JS doesn't have Function.apply for LiveAPI.call)
      result = api.call(method, args[0], args[1], args[2], args[3], args[4], args[5]);
      break;
  }

  reply(id, {
    action: "lom_call",
    path: objPath,
    method: method,
    result: result !== undefined ? coerce(unwrap(result)) : null,
  });
}

// ── Initialization ─────────────────────────────────────────────────────────

post("kbot-bridge.js loaded — 30 commands ready\n");
