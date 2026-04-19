// kbot-control.js — LOM dispatcher running inside Max-for-Live.
//
// Runs in the [js kbot-control.js] object inside kbot-control.amxd.
// Receives JSON-RPC requests from the Node-for-Max WebSocket server
// over a Max message (via send/receive), dispatches to LOM, returns results.
//
// Max JS globals: LiveAPI, post, outlet, messnamed, Dict, Global.
//
// Protocol:
//   inlet 0: incoming JSON-RPC string (from WS server)
//   outlet 0: JSON-RPC response string (back to WS server)
//   outlet 1: notifications for listener events

autowatch = 1;
inlets = 1;
outlets = 2;

var VERSION = "0.1.0";
var startTime = Date.now();

// ── Listener registry ─────────────────────────────────────────────────
// listeners[path] = LiveAPI instance
// buffers[path] = array of { value, at } events (ring buffer, keep last 100)
// seqs[path] = monotonically increasing sequence number
var listeners = {};
var buffers = {};
var seqs = {};
var MAX_BUFFER = 100;
var listenerFireCount = 0;

// ── Helpers ──────────────────────────────────────────────────────────

function log() {
  var s = "[kbot-control] ";
  for (var i = 0; i < arguments.length; i++) s += arguments[i] + " ";
  post(s + "\n");
}

function send(obj) {
  // Plain JSON out of outlet 0; the Max patch prepends "response" before
  // feeding into node.script so Max.addHandler("response", ...) catches it.
  outlet(0, JSON.stringify(obj));
}

var notifyCount = 0;
function notify(path, value) {
  notifyCount++;
  var payload = JSON.stringify({ jsonrpc: "2.0", method: "notify", params: { path: path, value: value } });
  post("[kbot-control] notify() #" + notifyCount + " path=" + path + " value=" + JSON.stringify(value) + "\n");
  // Emit with the "notify" prefix already in place; patch should wire this
  // outlet directly to node.script (no prepend object in between).
  outlet(1, "notify", payload);
}

function ok(id, result) { send({ jsonrpc: "2.0", id: id, result: result }); }
function err(id, code, message) { send({ jsonrpc: "2.0", id: id, error: { code: code, message: message } }); }

function liveApi(path) {
  var a = new LiveAPI(null, path);
  return a;
}

// Safe getter: returns undefined on LOM exception
function lomGet(path, prop) {
  try {
    var a = liveApi(path);
    var v = a.get(prop);
    if (v && v.length === 1) return v[0];
    return v;
  } catch (e) { return undefined; }
}

function lomSet(path, prop, value) {
  var a = liveApi(path);
  a.set(prop, value);
}

function lomCall(path, fn) {
  var a = liveApi(path);
  var args = Array.prototype.slice.call(arguments, 2);
  return a.call.apply(a, [fn].concat(args));
}

// ── Method handlers ──────────────────────────────────────────────────

var handlers = {

  // ── kbot heartbeat ──────────────────────────────────────────────
  "kbot.heartbeat": function (_params) {
    var v;
    try { v = liveApi("live_app").call("get_version_string"); } catch (e) { v = "unknown"; }
    return {
      version: VERSION,
      uptime_ms: Date.now() - startTime,
      lom_path: "live_app",
      live_version: String(v)
    };
  },

  // ── song ────────────────────────────────────────────────────────
  "song.get_state": function () {
    return {
      tempo: lomGet("live_set", "tempo"),
      is_playing: !!lomGet("live_set", "is_playing"),
      loop: !!lomGet("live_set", "loop"),
      metronome: !!lomGet("live_set", "metronome"),
      record_mode: !!lomGet("live_set", "record_mode"),
      punch_in: !!lomGet("live_set", "punch_in"),
      punch_out: !!lomGet("live_set", "punch_out"),
      current_time: lomGet("live_set", "current_song_time"),
      signature_numerator: lomGet("live_set", "signature_numerator"),
      signature_denominator: lomGet("live_set", "signature_denominator"),
      loop_start: lomGet("live_set", "loop_start"),
      loop_length: lomGet("live_set", "loop_length"),
      groove_amount: lomGet("live_set", "groove_amount"),
      num_tracks: lomGet("live_set", "tracks"),
      num_scenes: lomGet("live_set", "scenes")
    };
  },

  "song.play": function () { lomCall("live_set", "start_playing"); return "playing"; },
  "song.stop": function () { lomCall("live_set", "stop_playing"); return "stopped"; },
  "song.continue": function () { lomCall("live_set", "continue_playing"); return "continued"; },
  "song.stop_all_clips": function () { lomCall("live_set", "stop_all_clips"); return "all clips stopped"; },
  "song.tap_tempo": function () { lomCall("live_set", "tap_tempo"); return "tapped"; },
  "song.capture_midi": function () { lomCall("live_set", "capture_midi"); return "captured"; },
  "song.undo": function () { lomCall("live_set", "undo"); return "undone"; },
  "song.redo": function () { lomCall("live_set", "redo"); return "redone"; },
  "song.back_to_arranger": function () { lomSet("live_set", "back_to_arranger", 1); return "back to arranger"; },
  "song.jump_by": function (p) { lomCall("live_set", "jump_by", p.beats); return "jumped"; },
  "song.jump_to_next_cue": function () { lomCall("live_set", "jump_to_next_cue"); return "next cue"; },
  "song.jump_to_prev_cue": function () { lomCall("live_set", "jump_to_prev_cue"); return "prev cue"; },

  "song.tempo": function (p) {
    if (p && typeof p.value === "number") { lomSet("live_set", "tempo", p.value); return p.value; }
    return lomGet("live_set", "tempo");
  },
  "song.metronome": function (p) {
    if (p && p.value !== undefined) { lomSet("live_set", "metronome", p.value ? 1 : 0); return !!p.value; }
    return !!lomGet("live_set", "metronome");
  },
  "song.loop": function (p) {
    if (p && p.value !== undefined) { lomSet("live_set", "loop", p.value ? 1 : 0); return !!p.value; }
    return !!lomGet("live_set", "loop");
  },
  "song.record_mode": function (p) {
    if (p && p.value !== undefined) { lomSet("live_set", "record_mode", p.value ? 1 : 0); return !!p.value; }
    return !!lomGet("live_set", "record_mode");
  },

  // ── track ───────────────────────────────────────────────────────
  "track.list": function () {
    var api = liveApi("live_set");
    var n = api.get("tracks").length / 2; // LOM returns [id, N, id, N, ...]
    // Alternative: count iteratively until missing.
    var tracks = [];
    for (var i = 0; i < 64; i++) {
      var path = "live_set tracks " + i;
      var t = liveApi(path);
      var name = t.get("name");
      if (!name || name.length === 0) break;
      tracks.push({
        index: i,
        name: String(name[0]),
        color_index: lomGet(path, "color_index"),
        volume: lomGet(path + " mixer_device volume", "value"),
        panning: lomGet(path + " mixer_device panning", "value"),
        mute: !!lomGet(path, "mute"),
        solo: !!lomGet(path, "solo"),
        arm: !!lomGet(path, "arm"),
        is_foldable: !!lomGet(path, "is_foldable"),
        is_grouped: !!lomGet(path, "is_grouped"),
        has_midi_input: !!lomGet(path, "has_midi_input"),
        has_audio_output: !!lomGet(path, "has_audio_output"),
      });
    }
    return tracks;
  },

  "track.create": function (p) {
    var t = (p && p.type) || "midi";
    if (t === "audio") lomCall("live_set", "create_audio_track", -1);
    else if (t === "return") lomCall("live_set", "create_return_track");
    else lomCall("live_set", "create_midi_track", -1);
    return "created " + t + " track";
  },
  "track.delete": function (p) { lomCall("live_set", "delete_track", p.index); return "deleted"; },
  "track.duplicate": function (p) { lomCall("live_set", "duplicate_track", p.index); return "duplicated"; },
  "track.rename": function (p) { lomSet("live_set tracks " + p.index, "name", p.name); return p.name; },
  "track.color": function (p) { lomSet("live_set tracks " + p.index, "color_index", p.color_index); return p.color_index; },
  "track.volume": function (p) {
    var path = "live_set tracks " + p.index + " mixer_device volume";
    if (p.value !== undefined) { lomSet(path, "value", p.value); return p.value; }
    return lomGet(path, "value");
  },
  "track.mute": function (p) {
    if (p.value !== undefined) { lomSet("live_set tracks " + p.index, "mute", p.value ? 1 : 0); return !!p.value; }
    return !!lomGet("live_set tracks " + p.index, "mute");
  },
  "track.solo": function (p) {
    if (p.value !== undefined) { lomSet("live_set tracks " + p.index, "solo", p.value ? 1 : 0); return !!p.value; }
    return !!lomGet("live_set tracks " + p.index, "solo");
  },
  "track.arm": function (p) {
    if (p.value !== undefined) { lomSet("live_set tracks " + p.index, "arm", p.value ? 1 : 0); return !!p.value; }
    return !!lomGet("live_set tracks " + p.index, "arm");
  },
  "track.monitoring": function (p) {
    var mode = p.value;
    var mapped = mode === "in" ? 0 : mode === "off" ? 2 : 1;
    lomSet("live_set tracks " + p.index, "current_monitoring_state", mapped);
    return ["In", "Auto", "Off"][mapped];
  },

  // ── view — the tool that actually focuses ──────────────────────
  // Unlike AbletonOSC's /live/view/set/selected_track, this one ALSO
  // scrolls the session view so the target track is visible AND
  // highlights the header. Fixes the device-load-on-wrong-track bug.
  "view.focus_track": function (p) {
    var t = liveApi("live_set tracks " + p.index);
    var view = liveApi("live_app view");
    view.call("select_object", "to_object", t.id);
    view.call("show_view", "Session");
    // scroll_view arguments: (orientation, viewname, focus_follows_selection)
    view.call("scroll_view", 1, "Session", 1); // 1 = horizontal (tracks)
    return "focused track " + p.index;
  },

  "view.focus_clip": function (p) {
    var c = liveApi("live_set tracks " + p.track + " clip_slots " + p.slot + " clip");
    var view = liveApi("live_app view");
    view.call("select_object", "to_object", c.id);
    view.call("show_view", "Detail/Clip");
    return "focused clip";
  },

  "view.focus_device": function (p) {
    var d = liveApi("live_set tracks " + p.track + " devices " + p.device);
    var view = liveApi("live_app view");
    view.call("select_object", "to_object", d.id);
    view.call("show_view", "Detail/DeviceChain");
    return "focused device";
  },

  "view.show_arrangement": function () { liveApi("live_app view").call("show_view", "Arranger"); return "arrangement"; },
  "view.show_session": function () { liveApi("live_app view").call("show_view", "Session"); return "session"; },

  // ── browser ─────────────────────────────────────────────────────
  "browser.categories": function () {
    var b = liveApi("live_app browser");
    return ["sounds", "drums", "instruments", "audio_effects", "midi_effects",
            "max_for_live", "plug_ins", "clips", "samples", "user_library",
            "current_project", "packs"];
  },

  // Diagnostic: dump the immediate children of a browser category.
  // Proven pattern (from kbot-bridge-lom.js): path = "live_app browser <cat>",
  // then .get("children") returns [id, N, id, N, ...] for the children.
  "browser.inspect": function (p) {
    var cat = p && p.category ? p.category : "instruments";
    var filterPath = "live_app browser " + cat;
    var filter = liveApi(filterPath);
    var filterId = filter.id;
    var kids = filter.get("children");
    var diag = { category: cat, filter_id: filterId, filter_path: filterPath };
    if (!kids) { diag.error = "children is null/undefined"; return diag; }
    if (typeof kids.length === "undefined") { diag.error = "children is not array-like"; diag.raw_type = typeof kids; diag.raw = String(kids).slice(0, 80); return diag; }
    diag.children_count = Math.floor(kids.length / 2);
    diag.items = [];
    for (var i = 0; i < kids.length && diag.items.length < 20; i += 2) {
      try {
        var child = liveApi(filterPath + " children " + (i / 2));
        var nm = child.get("name");
        diag.items.push({
          index: i / 2,
          name: nm == null ? null : String(nm),
          is_folder: child.get("is_folder") == 1,
          is_loadable: child.get("is_loadable") == 1,
        });
      } catch (e) { diag.items.push({ index: i / 2, error: e.message }); }
    }
    return diag;
  },

  // Diagnostic: probe various LOM paths to find the browser in this Live version.
  "browser.root": function () {
    var out = {};
    var paths = [
      "live_app browser",
      "live_app",
      "control_surfaces 0 selected_track",
      "live_set view browser",
      "live_app view browser",
    ];
    for (var i = 0; i < paths.length; i++) {
      try {
        var a = liveApi(paths[i]);
        out[paths[i]] = { id: a.id, type: a.type, info: String(a.info).slice(0, 120) };
      } catch (e) { out[paths[i]] = { error: e.message }; }
    }

    // Try calling get_browser() as a method on live_app
    try {
      var app = liveApi("live_app");
      out["live_app props"] = {};
      var p = ["browser", "view", "control_surfaces"];
      for (var j = 0; j < p.length; j++) {
        try { out["live_app props"][p[j]] = String(app.get(p[j])).slice(0, 80); }
        catch (e) { out["live_app props"][p[j]] = "err: " + e.message; }
      }
      // Try methods
      out["live_app methods"] = {};
      var m = ["get_browser", "get_application", "get_version_string", "get_major_version", "get_minor_version"];
      for (var k = 0; k < m.length; k++) {
        try { out["live_app methods"][m[k]] = String(app.call(m[k])).slice(0, 80); }
        catch (e) { out["live_app methods"][m[k]] = "err: " + e.message; }
      }
    } catch (e) { out.live_app_probe_err = e.message; }
    return out;
  },

  // ── device — the load that actually loads on the right track ───
  "device.load_by_name": function (p) {
    // Focus the target track first (so the browser's load_item goes to it)
    handlers["view.focus_track"]({ index: p.track });
    // Use the new recursive search to find by exact name
    var results = handlers["browser.search"]({ query: p.name, limit: 10 });
    if (!results || results.length === 0) return { error: "not found: " + p.name };
    // Prefer exact case-insensitive match
    var target = null;
    for (var i = 0; i < results.length; i++) {
      if (results[i].name.toLowerCase() === String(p.name).toLowerCase()) { target = results[i]; break; }
    }
    if (!target) target = results[0];
    var browser = liveApi("live_app browser");
    browser.call("load_item", target.id);
    return "loaded " + target.name + " on track " + p.track + " (from " + target.category + ")";
  },

  "device.list": function (p) {
    var devices = [];
    for (var i = 0; i < 32; i++) {
      var path = "live_set tracks " + p.track + " devices " + i;
      var name = lomGet(path, "name");
      if (!name) break;
      devices.push({
        index: i,
        name: String(name),
        class_name: String(lomGet(path, "class_name") || ""),
        is_active: !!lomGet(path, "is_active")
      });
    }
    return devices;
  },

  // ── clip ────────────────────────────────────────────────────────
  "clip.fire": function (p) { lomCall("live_set tracks " + p.track + " clip_slots " + p.slot, "fire"); return "fired"; },
  "clip.stop": function (p) { lomCall("live_set tracks " + p.track + " clip_slots " + p.slot, "stop"); return "stopped"; },
  "clip.create": function (p) {
    lomCall("live_set tracks " + p.track + " clip_slots " + p.slot, "create_clip", p.length || 4);
    if (p.name) lomSet("live_set tracks " + p.track + " clip_slots " + p.slot + " clip", "name", p.name);
    return "created";
  },
  "clip.delete": function (p) { lomCall("live_set tracks " + p.track + " clip_slots " + p.slot, "delete_clip"); return "deleted"; },
  "clip.duplicate": function (p) {
    lomCall("live_set tracks " + p.track + " clip_slots " + p.slot, "duplicate_clip_to",
            "id " + liveApi("live_set tracks " + p.track + " clip_slots " + (p.to_slot || p.slot + 1)).id);
    return "duplicated";
  },
  "clip.get_state": function (p) {
    var path = "live_set tracks " + p.track + " clip_slots " + p.slot + " clip";
    return {
      name: String(lomGet(path, "name") || ""),
      length: lomGet(path, "length"),
      color_index: lomGet(path, "color_index"),
      is_playing: !!lomGet(path, "is_playing"),
      is_audio: !!lomGet(path, "is_audio_clip"),
      is_midi: !!lomGet(path, "is_midi_clip"),
      looping: !!lomGet(path, "looping"),
      loop_start: lomGet(path, "loop_start"),
      loop_end: lomGet(path, "loop_end"),
      warp_mode: lomGet(path, "warp_mode"),
      warping: !!lomGet(path, "warping"),
      gain: lomGet(path, "gain"),
      pitch_coarse: lomGet(path, "pitch_coarse"),
      pitch_fine: lomGet(path, "pitch_fine"),
    };
  },
  "clip.set_property": function (p) {
    var path = "live_set tracks " + p.track + " clip_slots " + p.slot + " clip";
    lomSet(path, p.property, p.value);
    return p.property + " = " + p.value;
  },

  // ── scene ────────────────────────────────────────────────────────
  "scene.list": function () {
    var scenes = [];
    for (var i = 0; i < 64; i++) {
      var name = lomGet("live_set scenes " + i, "name");
      if (name === undefined) break;
      scenes.push({
        index: i,
        name: String(name),
        color_index: lomGet("live_set scenes " + i, "color_index"),
        is_empty: !!lomGet("live_set scenes " + i, "is_empty"),
        tempo: lomGet("live_set scenes " + i, "tempo"),
      });
    }
    return scenes;
  },
  "scene.fire": function (p) { lomCall("live_set scenes " + p.index, "fire"); return "fired scene " + p.index; },
  "scene.create": function (p) { lomCall("live_set", "create_scene", p.index == null ? -1 : p.index); return "created"; },
  "scene.delete": function (p) { lomCall("live_set", "delete_scene", p.index); return "deleted"; },
  "scene.duplicate": function (p) { lomCall("live_set", "duplicate_scene", p.index); return "duplicated"; },
  "scene.rename": function (p) { lomSet("live_set scenes " + p.index, "name", p.name); return p.name; },

  // ── song position ────────────────────────────────────────────────
  "song.position": function (p) {
    if (p && typeof p.value === "number") { lomSet("live_set", "current_song_time", p.value); return p.value; }
    return lomGet("live_set", "current_song_time");
  },
  "song.signature_numerator": function (p) {
    if (p && typeof p.value === "number") { lomSet("live_set", "signature_numerator", p.value); return p.value; }
    return lomGet("live_set", "signature_numerator");
  },
  "song.signature_denominator": function (p) {
    if (p && typeof p.value === "number") { lomSet("live_set", "signature_denominator", p.value); return p.value; }
    return lomGet("live_set", "signature_denominator");
  },

  // ── track.send (send-level on a track) ──────────────────────────
  "track.send": function (p) {
    var path = "live_set tracks " + p.track + " mixer_device sends " + p.send;
    if (p.value !== undefined) { lomSet(path, "value", p.value); return p.value; }
    return lomGet(path, "value");
  },

  // ── browser.search (RECURSIVE walk across categories + subfolders) ──
  //
  // Live 12's browser: `live_app browser instruments` is the category item;
  // its `children` property is the array of id pairs we actually walk.
  "browser.search": function (p) {
    var query = String(p.query || "").toLowerCase();
    var cats = p.category ? [p.category] : ["instruments", "audio_effects", "midi_effects", "max_for_live", "plug_ins", "drums", "sounds"];
    var hits = [];
    var maxHits = p.limit || 25;
    var maxDepth = p.depth == null ? 3 : p.depth;

    function walk(apiId, depth, categoryLabel) {
      if (hits.length >= maxHits) return;
      if (depth > maxDepth) return;
      var node = new LiveAPI(null, "id " + apiId);
      var kids = node.get("children");
      if (!kids || kids.length === 0) return;
      for (var i = 0; i < kids.length && hits.length < maxHits; i += 2) {
        var childId = kids[i + 1];
        var child = new LiveAPI(null, "id " + childId);
        var n = child.get("name");
        if (!n) continue;
        var nameStr = String(n);
        var isFolder = child.get("is_folder") == 1;
        var loadable = child.get("is_loadable") == 1;
        if (nameStr.toLowerCase().indexOf(query) >= 0 && loadable) {
          hits.push({ name: nameStr, category: categoryLabel, id: childId, loadable: true });
        }
        if (isFolder && depth < maxDepth) walk(childId, depth + 1, categoryLabel);
      }
    }

    var browser = liveApi("live_app browser");
    for (var ci = 0; ci < cats.length; ci++) {
      var ref = browser.get(cats[ci]);
      if (!ref || ref.length < 2) continue;
      walk(ref[1], 0, cats[ci]);
    }
    return hits;
  },

  // ── device.parameters (full list with min/max/quantized info) ──────
  "device.parameters": function (p) {
    var base = "live_set tracks " + p.track + " devices " + p.device;
    var count = lomGet(base, "parameters");
    // parameters getter returns array [id, N_id, id, N_id, ...]
    var params = [];
    var max = p.limit || 100;
    for (var i = 0; i < max; i++) {
      var ppath = base + " parameters " + i;
      var nm = lomGet(ppath, "name");
      if (nm === undefined) break;
      params.push({
        index: i,
        name: String(nm),
        value: lomGet(ppath, "value"),
        min: lomGet(ppath, "min"),
        max: lomGet(ppath, "max"),
        is_quantized: !!lomGet(ppath, "is_quantized"),
        value_string: String(lomGet(ppath, "value_string") || ""),
      });
    }
    return params;
  },
  "device.set_parameter": function (p) {
    var base = "live_set tracks " + p.track + " devices " + p.device;
    if (typeof p.index === "number") {
      lomSet(base + " parameters " + p.index, "value", p.value);
      return { index: p.index, value: p.value };
    }
    if (p.name) {
      // Find by name
      for (var i = 0; i < 200; i++) {
        var ppath = base + " parameters " + i;
        var nm = lomGet(ppath, "name");
        if (nm === undefined) break;
        if (String(nm) === p.name) {
          lomSet(ppath, "value", p.value);
          return { index: i, name: p.name, value: p.value };
        }
      }
      return { error: "parameter not found: " + p.name };
    }
    return { error: "device.set_parameter needs index or name" };
  },
  "device.enable": function (p) {
    var base = "live_set tracks " + p.track + " devices " + p.device;
    lomSet(base, "is_active", 1);
    return "enabled";
  },
  "device.disable": function (p) {
    var base = "live_set tracks " + p.track + " devices " + p.device;
    lomSet(base, "is_active", 0);
    return "disabled";
  },

  // ── Ableton 12 Beta — song key, scale, and tuning ─────────────────
  // Requires Live 12+. root_note is 0-11 (C=0), scale_name is a string
  // like "Major", "Minor", "Dorian", "Harmonic Minor".
  "song.key": function (p) {
    if (p && typeof p.value === "number") { lomSet("live_set", "root_note", p.value); return p.value; }
    return lomGet("live_set", "root_note");
  },
  "song.scale": function (p) {
    if (p && typeof p.value === "string") { lomSet("live_set", "scale_name", p.value); return p.value; }
    return String(lomGet("live_set", "scale_name") || "");
  },
  "song.tuning": function (_p) {
    // Live 12 Beta: tuning system. Live.Application.get_application().get_tuning_systems()
    var app = liveApi("live_app");
    try { return app.call("get_tuning_systems"); } catch (e) { return { error: "tuning not available: " + e.message }; }
  },

  // ── Ableton 12 Beta — track modulation chain ───────────────────────
  // Live 12 introduced track modulators. Walk the 'modulation_matrix' if present.
  "track.modulators": function (p) {
    var base = "live_set tracks " + p.track;
    var mods = [];
    try {
      // Modulator sources live in a separate chain in Live 12
      for (var i = 0; i < 8; i++) {
        var mpath = base + " modulators " + i;
        var nm = lomGet(mpath, "name");
        if (nm === undefined) break;
        mods.push({ index: i, name: String(nm), class_name: String(lomGet(mpath, "class_name") || "") });
      }
    } catch (e) { return { error: "modulators unavailable (Live 12 required): " + e.message }; }
    return mods;
  },

  // ── Arrangement view ──────────────────────────────────────────────
  "arrangement.clips": function (p) {
    var base = "live_set tracks " + p.track;
    var clips = [];
    var n = lomGet(base, "arrangement_clips");
    // arrangement_clips is a list of [id, X, id, X, ...] id pairs
    if (!n) return clips;
    for (var i = 0; i < n.length; i += 2) {
      var cid = n[i + 1];
      var clip = new LiveAPI(null, "id " + cid);
      clips.push({
        id: cid,
        name: String(clip.get("name") || ""),
        start_time: clip.get("start_time"),
        length: clip.get("length"),
        end_time: clip.get("end_time"),
        color_index: clip.get("color_index"),
        is_midi: clip.get("is_midi_clip") == 1,
      });
    }
    return clips;
  },

  // ── listen ──────────────────────────────────────────────────────
  //
  // Path convention:
  //   "song.tempo"               → live_set, property "tempo"
  //   "tracks[0].mute"           → live_set tracks 0, property "mute"
  //   "tracks[2].clip_slots[0].clip.playing_position"
  //                              → live_set tracks 2 clip_slots 0 clip, property "playing_position"
  //
  // We translate "." into spaces, drop the leading "song" (because LOM's
  // song root is "live_set"), and convert "[N]" into " N".
  "listen.subscribe": function (p) {
    var userPath = p.path;
    if (listeners[userPath]) return "already subscribed";
    var parts = userPath.split(".");
    var prop = parts.pop();
    // Drop leading "song" — "song" IS live_set.
    if (parts.length && parts[0] === "song") parts.shift();
    // Convert "tracks[3]" → "tracks 3"
    var segs = parts.map(function (s) { return s.replace(/\[(\d+)\]/g, " $1"); });
    var lomPath = "live_set";
    if (segs.length) lomPath += " " + segs.join(" ").replace(/\s+/g, " ").trim();
    buffers[userPath] = [];
    seqs[userPath] = 0;
    var api = new LiveAPI(function () {
      listenerFireCount++;
      try {
        var a = [];
        for (var ai = 0; ai < arguments.length; ai++) a.push(arguments[ai]);
        var val = a.length >= 2 ? a[1] : (a.length === 1 ? a[0] : a);
        seqs[userPath]++;
        buffers[userPath].push({ seq: seqs[userPath], value: val, at: Date.now() });
        if (buffers[userPath].length > MAX_BUFFER) buffers[userPath].shift();
        // Also try the outlet path — if the maxpat wiring works, this hits the client live.
        notify(userPath, val);
      } catch (e) { post("[kbot-control] listener error: " + e + "\n"); }
    }, lomPath);
    api.property = prop;
    listeners[userPath] = api;
    return { subscribed: userPath, lom_path: lomPath, property: prop };
  },

  "listen.unsubscribe": function (p) {
    if (listeners[p.path]) {
      listeners[p.path].property = ""; // detach
      delete listeners[p.path];
      delete buffers[p.path];
      delete seqs[p.path];
      return "unsubscribed";
    }
    return "not subscribed";
  },

  // Pull-based listener API. Returns events with seq > since.
  "listen.poll": function (p) {
    var path = p.path;
    var since = p.since == null ? 0 : Number(p.since);
    if (!listeners[path]) return { error: "not subscribed: " + path };
    var buf = buffers[path] || [];
    var out = [];
    for (var i = 0; i < buf.length; i++) {
      if (buf[i].seq > since) out.push(buf[i]);
    }
    return { path: path, events: out, latest_seq: seqs[path] || 0 };
  },

  "listen.list": function () {
    return Object.keys(listeners);
  },

  // Diagnostic: have any listener callbacks fired since the script loaded?
  "listen.debug": function () {
    return {
      fire_count: listenerFireCount,
      notify_count: notifyCount,
      active: Object.keys(listeners).length
    };
  }
};

// Find an item in the browser by exact name match (recursive one level)
function findItem(browser, category, name) {
  var cat = browser.get(category); // returns array of id pairs
  if (!cat || cat.length === 0) return null;
  for (var i = 0; i < cat.length; i += 2) {
    var child = new LiveAPI(null, "id " + cat[i + 1]);
    var childName = child.get("name");
    if (childName && String(childName) === name && child.get("is_loadable") == 1) {
      return { id: cat[i + 1], name: String(childName) };
    }
  }
  return null;
}

// ── Entry point ──────────────────────────────────────────────────────
//
// After [route request] strips the "request" prefix, the JSON payload
// arrives here as Max's `messagename` (the selector) with zero arguments.
// In the forward-compat case where the patch is changed to "prepend X"
// before js, the payload would be arguments[0]. We handle both so the
// dispatcher works regardless of the routing topology upstream.

function anything() {
  var raw = arguments.length > 0 ? arguments[0] : messagename;
  if (!raw || raw === "bang") return;
  try {
    var msg = JSON.parse(String(raw));
    var handler = handlers[msg.method];
    if (!handler) {
      err(msg.id, -32601, "Method not found: " + msg.method);
      return;
    }
    var result = handler(msg.params || {});
    ok(msg.id, result);
  } catch (e) {
    err(-1, -32603, "Internal: " + e.message + " raw=" + String(raw).slice(0, 80));
  }
}

function bang() {
  log("kbot-control v" + VERSION + " ready, Live API version " + (lomGet("live_app", "get_version_string") || "?"));
}

log("kbot-control.js loaded, version " + VERSION);
