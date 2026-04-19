# kbot-control Protocol

**Transport:** TCP at `127.0.0.1:9000` (newline-delimited)
**Encoding:** JSON-RPC 2.0 (`id`, `method`, `params`, `result`/`error`)
**Framing:** one JSON message per line (`\n` delimited); messages may not contain literal newlines

## Method Namespaces

### `song.*` — song-level control
- `song.get_state` → full snapshot
- `song.play` / `song.stop` / `song.record` / `song.continue`
- `song.tempo` — get/set
- `song.time_signature` — get/set (num, denom)
- `song.metronome` / `song.loop` / `song.punch_in` / `song.punch_out` — toggles
- `song.loop_start` / `song.loop_length` — set
- `song.position` — get/set current_song_time
- `song.undo` / `song.redo`
- `song.tap_tempo`
- `song.capture_midi`
- `song.stop_all_clips`
- `song.back_to_arranger`
- `song.jump_by(beats)` / `song.jump_to_next_cue` / `song.jump_to_prev_cue`
- `song.cue.add` / `song.cue.delete` / `song.cue.rename`
- `song.groove_amount` — get/set
- `song.record_mode` — get/set

### `track.*` — track control (all accept track_index 0-based or track_name)
- `track.list` → all tracks with state
- `track.create(type)` — midi | audio | return
- `track.delete(index)`
- `track.duplicate(index)`
- `track.rename(index, name)`
- `track.color(index, color_index)` — 0-69 palette
- `track.volume(index)` / `track.pan(index)` — get/set
- `track.mute` / `track.solo` / `track.arm` — get/set/toggle
- `track.fold_state(index, bool)` — group track fold
- `track.input_routing(index, type, channel?)`
- `track.output_routing(index, type, channel?)`
- `track.monitoring(index, in|auto|off)`
- `track.send(track_index, send_index, value)` — send level
- `track.freeze(index)` / `track.flatten(index)`
- `track.get_devices(index)` → list of device names + class names

### `clip.*` — clip control
- `clip.fire(track, slot)` / `clip.stop(track, slot)`
- `clip.create(track, slot, length_beats, name?)`
- `clip.delete(track, slot)`
- `clip.duplicate(from_track, from_slot, to_track, to_slot)`
- `clip.get_state(track, slot)` → full clip info
- `clip.set_property(track, slot, property, value)` — any MIDI/audio clip property
- `clip.notes.get(track, slot)` / `clip.notes.set(track, slot, notes[])` / `clip.notes.clear(track, slot)`
- `clip.envelopes.get(track, slot, parameter_id)` / `clip.envelopes.set(...)` — automation inside the clip
- `clip.warp_markers.get(track, slot)` / `clip.warp_markers.set(...)` — audio clip warp control

### `scene.*` — scene control
- `scene.list` / `scene.count`
- `scene.fire(index)` / `scene.fire_as_selected`
- `scene.create(after_index?)` / `scene.delete(index)` / `scene.duplicate(index)`
- `scene.rename(index, name)` / `scene.color(index, color_index)`
- `scene.tempo(index, bpm)` / `scene.time_signature(index, num, denom)`

### `device.*` — device control (any VST/AU/M4L/native)
- `device.list(track)` / `device.info(track, device_index)`
- `device.parameters(track, device)` → [{ name, value, min, max, is_quantized, value_string }]
- `device.set_parameter(track, device, param_id_or_name, value)`
- `device.enable(track, device)` / `device.disable(track, device)`
- `device.load(track, uri)` — load by browser URI (returned from browser.search)
- `device.load_by_name(track, name)` — fuzzy-match in library, picks best
- `device.delete(track, device)`
- `device.move(from_track, from_device, to_track, to_position)`

### `browser.*` — Ableton library navigation
- `browser.categories` → ["sounds", "drums", "instruments", "audio_effects", "midi_effects", "max_for_live", "plug_ins", "clips", "samples", "user_library", "current_project", "packs"]
- `browser.list(category, subfolder?)` → items with uri, name, type
- `browser.search(query, category?)` → best matches across the library
- `browser.preview(uri)` / `browser.load(uri, target_track)` — direct load without UI fragility

### `view.*` — Ableton UI control (the thing that was broken)
- `view.focus_track(index)` — selects AND scrolls AND highlights. Fixes the `selected_track` bug.
- `view.focus_clip(track, slot)` — shows the clip in clip view
- `view.focus_device(track, device)` — opens the device in device view
- `view.focus_scene(index)` — selects and scrolls scene
- `view.show_arrangement` / `view.show_session` / `view.show_clip` / `view.show_device_chain` / `view.show_browser` / `view.show_detail`
- `view.hide_browser` / `view.hide_detail`
- `view.zoom_to_selection`
- `view.second_window` — pop detail view into a second window

### `arrangement.*` — arrangement view
- `arrangement.clips(track)` → all arrangement clips with start/length/color/name
- `arrangement.add_clip(track, start_time, length, source)` — place a clip
- `arrangement.move_clip(track, clip_id, new_start)` / `arrangement.resize_clip(track, clip_id, new_length)`
- `arrangement.delete_clip(track, clip_id)`
- `arrangement.locators.list` / `arrangement.locators.add(name?)` / `arrangement.locators.jump(index)`

### `listen.*` — real-time subscriptions (streamed as WebSocket notifications)
- `listen.subscribe(path)` — LOM property path, e.g. `"song.is_playing"`, `"tracks[0].output_meter_left"`, `"tracks[2].clip_slots[0].clip.playing_position"`
- `listen.unsubscribe(path)`
- `listen.list` → currently subscribed paths

Notifications are pushed as `{ "method": "notify", "params": { "path": "...", "value": ... } }` JSON-RPC messages without an `id`. Every connected TCP client receives every notification (broadcast).

### `midi.*` — MIDI mapping
- `midi.learn(source_type, source_id)` — attach next-received MIDI message to a parameter
- `midi.map(cc|note, channel, parameter_path, min?, max?)` — direct mapping
- `midi.unmap(parameter_path)`
- `midi.mappings` → all current mappings

### `kbot.*` — kbot-specific extensions
- `kbot.session_info` → kbot-shaped session snapshot (what `ableton_session_info` returns)
- `kbot.build_drum_rack(track, kit_name, pattern?)` — one-shot drum rack + kit + pattern
- `kbot.create_progression(track, key, progression, voicing, rhythm, bars, octave)` — chord progressions
- `kbot.load_m4l_device(track, device_name)` — load any kbot-built M4L device by short name
- `kbot.audio_analysis(track?)` — L/R RMS + peak
- `kbot.heartbeat` → version, uptime, LOM API version

## Error Format

```json
{ "jsonrpc": "2.0", "id": 42, "error": { "code": -32601, "message": "Method not found: foo.bar" } }
```

Standard JSON-RPC error codes + kbot-specific:
- `-32000` — Live API error (LOM call raised)
- `-32001` — Invalid track/clip/device reference
- `-32002` — Operation requires UI state (e.g. user in a modal dialog)
