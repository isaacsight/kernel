// kbot Ableton Live Tools — Natural language DAW control over OSC
// Zero external dependencies. Talks to AbletonOSC via UDP on localhost.
//
// Tools:
//   ableton_transport       — play, stop, record, tempo, time sig, seek
//   ableton_track           — list/mute/solo/arm/volume/pan/rename/info + set color/routing/monitoring
//   ableton_clip            — fire/stop/create/delete/duplicate/info + set gain/warp/pitch/loop/color/launch
//   ableton_scene           — fire, list, create, duplicate
//   ableton_song            — undo/redo, tap_tempo, metronome, punch, cue points, loop, back_to_arranger
//   ableton_view            — selected scene/track/clip/device (get + set)
//   ableton_midi            — write/read/clear MIDI notes in clips
//   ableton_device          — list, get/set params, enable/disable devices
//   ableton_mixer           — snapshot levels, batch set, sends
//   ableton_create_progression — chord progressions → MIDI in clips
//   ableton_create_track    — create midi/audio/return track, optionally load instrument
//   ableton_session_info    — full session state snapshot
//   ableton_audio_analysis  — real-time audio level meters (track + master RMS)
//   ableton_knowledge       — deep Ableton knowledge base queries (registered in ableton-knowledge.ts)
//
// Requires: AbletonOSC loaded in Ableton Live (Preferences → Link/Tempo/MIDI → Control Surface)
// For UI-only operations OSC doesn't expose, fall back to Claude's computer-use MCP.
import { registerTool } from './index.js';
import { execSync } from 'node:child_process';
import { ensureAbleton, formatAbletonError } from '../integrations/ableton-osc.js';
import { tryKc } from '../integrations/ableton.js';
import { parseProgression, voiceChord, arpeggiate, NAMED_PROGRESSIONS, RHYTHM_PATTERNS, GENRE_DRUM_PATTERNS, noteNameToMidi, midiToNoteName, } from './music-theory.js';
// ── Helpers ─────────────────────────────────────────────────────────────────
function extractArgs(args) {
    return args.map(a => {
        if (a.type === 'b')
            return '[blob]';
        return a.value;
    });
}
function userTrack(track) {
    // Users say "track 1" (1-based), OSC uses 0-based
    const n = Number(track);
    return Math.max(0, n - 1);
}
function displayTrack(oscIndex) {
    return oscIndex + 1;
}
// ── Tool Registration ───────────────────────────────────────────────────────
export function registerAbletonTools() {
    // ─── 1. Transport ─────────────────────────────────────────────────────
    registerTool({
        name: 'ableton_transport',
        description: 'Control Ableton Live transport — play, stop, record, set tempo, time signature, and seek position. Requires AbletonOSC running in Live.',
        parameters: {
            action: { type: 'string', description: 'Action: "play", "stop", "record", "toggle", "tempo", "time_sig", "position", "status"', required: true },
            value: { type: 'number', description: 'BPM for tempo, beat position for seek, numerator for time_sig' },
            value2: { type: 'number', description: 'Denominator for time_sig (e.g. 4 for x/4)' },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const action = String(args.action).toLowerCase();
            try {
                // Try kbot-control first for supported methods
                switch (action) {
                    case 'play':
                    case 'start': {
                        const kc = await tryKc('song.play');
                        if (kc !== undefined)
                            return '▶ Playing (via kbot-control)';
                        break;
                    }
                    case 'stop': {
                        const kc = await tryKc('song.stop');
                        if (kc !== undefined)
                            return '⏹ Stopped (via kbot-control)';
                        break;
                    }
                    case 'tempo':
                    case 'bpm': {
                        const bpm = Number(args.value);
                        if (!bpm || bpm < 20 || bpm > 999)
                            return 'Error: BPM must be between 20 and 999';
                        const kc = await tryKc('song.tempo', { value: bpm });
                        if (kc !== undefined)
                            return `Tempo set to **${bpm} BPM** (via kbot-control)`;
                        break;
                    }
                    case 'status': {
                        const kc = await tryKc('song.get_state');
                        if (kc !== undefined) {
                            return [
                                '## Transport Status (via kbot-control)',
                                `- Tempo: **${Number(kc.tempo).toFixed(1)} BPM**`,
                                `- Playing: ${kc.is_playing ? '▶ Yes' : '⏹ No'}`,
                                `- Recording: ${kc.record_mode ? '⏺ Yes' : 'No'}`,
                                `- Loop: ${kc.loop ? 'on' : 'off'}`,
                                `- Metronome: ${kc.metronome ? 'on' : 'off'}`,
                            ].join('\n');
                        }
                        break;
                    }
                }
                const osc = await ensureAbleton();
                switch (action) {
                    case 'play':
                    case 'start':
                        osc.send('/live/song/start_playing');
                        return '▶ Playing';
                    case 'stop':
                        osc.send('/live/song/stop_playing');
                        return '⏹ Stopped';
                    case 'record':
                        osc.send('/live/song/set/record_mode', 1);
                        osc.send('/live/song/start_playing');
                        return '⏺ Recording';
                    case 'toggle':
                        osc.send('/live/song/start_playing');
                        return '⏯ Toggled playback';
                    case 'tempo':
                    case 'bpm': {
                        const bpm = Number(args.value);
                        if (!bpm || bpm < 20 || bpm > 999)
                            return 'Error: BPM must be between 20 and 999';
                        osc.send('/live/song/set/tempo', bpm);
                        return `Tempo set to **${bpm} BPM**`;
                    }
                    case 'time_sig':
                    case 'time_signature': {
                        const num = Number(args.value) || 4;
                        const den = Number(args.value2) || 4;
                        osc.send('/live/song/set/signature_numerator', num);
                        osc.send('/live/song/set/signature_denominator', den);
                        return `Time signature set to **${num}/${den}**`;
                    }
                    case 'position':
                    case 'seek': {
                        const pos = Number(args.value) || 0;
                        osc.send('/live/song/set/current_song_time', pos);
                        return `Seeked to beat **${pos}**`;
                    }
                    case 'status': {
                        const tempo = await osc.query('/live/song/get/tempo');
                        const playing = await osc.query('/live/song/get/is_playing');
                        const recording = await osc.query('/live/song/get/record_mode');
                        return [
                            '## Transport Status',
                            `- Tempo: **${extractArgs(tempo)[0]} BPM**`,
                            `- Playing: ${extractArgs(playing)[0] ? '▶ Yes' : '⏹ No'}`,
                            `- Recording: ${extractArgs(recording)[0] ? '⏺ Yes' : 'No'}`,
                        ].join('\n');
                    }
                    default:
                        return `Unknown action "${action}". Options: play, stop, record, toggle, tempo, time_sig, position, status`;
                }
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 2. Track Control ─────────────────────────────────────────────────
    registerTool({
        name: 'ableton_track',
        description: 'Control Ableton Live tracks — list all tracks, mute, solo, arm, set volume/pan/color/routing/monitoring, rename, info. Track numbers are 1-based.',
        parameters: {
            action: { type: 'string', description: '"list", "mute", "unmute", "solo", "unsolo", "arm", "disarm", "volume", "pan", "rename", "info", "color", "monitoring", "input_routing", "output_routing", "set"', required: true },
            track: { type: 'number', description: 'Track number (1-based). Required for all actions except "list"' },
            value: { type: 'string', description: 'Volume (0-1), pan (-1 to 1), name, color index (0-69), monitoring ("in"/"auto"/"off"), or routing type/channel string.' },
            property: { type: 'string', description: 'For "set" action: AbletonOSC property path (e.g. "color_index", "input_routing_type").' },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const action = String(args.action).toLowerCase();
            // kbot-control fast path
            if (action === 'list') {
                const kc = await tryKc('track.list');
                if (kc !== undefined) {
                    const lines = ['## Tracks (via kbot-control)', ''];
                    lines.push('| # | Name | Volume | Pan | Mute | Solo | Armed |');
                    lines.push('|---|------|--------|-----|------|------|-------|');
                    for (const t of kc) {
                        lines.push(`| ${Number(t.index) + 1} | ${t.name} | ${(Number(t.volume) * 100).toFixed(0)}% | ${Number(t.panning).toFixed(2)} | ${t.mute ? '🔇' : ''} | ${t.solo ? '🔊' : ''} | ${t.arm ? '⏺' : ''} |`);
                    }
                    return lines.join('\n');
                }
            }
            if (args.track !== undefined && ['mute', 'unmute', 'solo', 'unsolo', 'arm', 'disarm', 'volume', 'vol', 'pan', 'color', 'rename'].includes(action)) {
                const idx = userTrack(args.track);
                const kcMap = {
                    mute: { method: 'track.mute', params: { index: idx, value: 1 }, label: `Track ${args.track} muted 🔇` },
                    unmute: { method: 'track.mute', params: { index: idx, value: 0 }, label: `Track ${args.track} unmuted` },
                    solo: { method: 'track.solo', params: { index: idx, value: 1 }, label: `Track ${args.track} soloed 🔊` },
                    unsolo: { method: 'track.solo', params: { index: idx, value: 0 }, label: `Track ${args.track} unsoloed` },
                    arm: { method: 'track.arm', params: { index: idx, value: 1 }, label: `Track ${args.track} armed ⏺` },
                    disarm: { method: 'track.arm', params: { index: idx, value: 0 }, label: `Track ${args.track} disarmed` },
                    volume: { method: 'track.volume', params: { index: idx, value: Math.max(0, Math.min(1, Number(args.value))) }, label: `Track ${args.track} volume → ${(Math.max(0, Math.min(1, Number(args.value))) * 100).toFixed(0)}%` },
                    vol: { method: 'track.volume', params: { index: idx, value: Math.max(0, Math.min(1, Number(args.value))) }, label: `Track ${args.track} volume → ${(Math.max(0, Math.min(1, Number(args.value))) * 100).toFixed(0)}%` },
                    color: { method: 'track.color', params: { index: idx, color_index: Number(args.value) }, label: `Track ${args.track} color → ${args.value}` },
                    rename: { method: 'track.rename', params: { index: idx, name: String(args.value || 'Track') }, label: `Track ${args.track} renamed to ${args.value}` },
                };
                const entry = kcMap[action];
                if (entry) {
                    const kc = await tryKc(entry.method, entry.params);
                    if (kc !== undefined)
                        return entry.label + ' (via kbot-control)';
                }
            }
            try {
                const osc = await ensureAbleton();
                if (action === 'list') {
                    const countResult = await osc.query('/live/song/get/num_tracks');
                    const count = Number(extractArgs(countResult)[0]) || 0;
                    const lines = ['## Tracks', ''];
                    lines.push('| # | Name | Volume | Pan | Mute | Solo | Armed |');
                    lines.push('|---|------|--------|-----|------|------|-------|');
                    for (let i = 0; i < Math.min(count, 32); i++) {
                        try {
                            const name = await osc.query('/live/track/get/name', i);
                            const vol = await osc.query('/live/track/get/volume', i);
                            const pan = await osc.query('/live/track/get/panning', i);
                            const mute = await osc.query('/live/track/get/mute', i);
                            const solo = await osc.query('/live/track/get/solo', i);
                            const arm = await osc.query('/live/track/get/arm', i);
                            lines.push(`| ${i + 1} | ${extractArgs(name)[1] || '?'} | ${(Number(extractArgs(vol)[1]) * 100).toFixed(0)}% | ${Number(extractArgs(pan)[1]).toFixed(2)} | ${extractArgs(mute)[1] ? '🔇' : ''} | ${extractArgs(solo)[1] ? '🔊' : ''} | ${extractArgs(arm)[1] ? '⏺' : ''} |`);
                        }
                        catch { /* skip unreachable tracks */ }
                    }
                    return lines.join('\n');
                }
                const t = userTrack(args.track);
                if (!args.track)
                    return 'Error: track number required (1-based)';
                switch (action) {
                    case 'mute':
                        osc.send('/live/track/set/mute', t, 1);
                        return `Track ${args.track} muted 🔇`;
                    case 'unmute':
                        osc.send('/live/track/set/mute', t, 0);
                        return `Track ${args.track} unmuted`;
                    case 'solo':
                        osc.send('/live/track/set/solo', t, 1);
                        return `Track ${args.track} soloed 🔊`;
                    case 'unsolo':
                        osc.send('/live/track/set/solo', t, 0);
                        return `Track ${args.track} unsoloed`;
                    case 'arm':
                        osc.send('/live/track/set/arm', t, 1);
                        return `Track ${args.track} armed ⏺`;
                    case 'disarm':
                        osc.send('/live/track/set/arm', t, 0);
                        return `Track ${args.track} disarmed`;
                    case 'volume':
                    case 'vol': {
                        const v = Math.max(0, Math.min(1, Number(args.value)));
                        osc.send('/live/track/set/volume', t, v);
                        return `Track ${args.track} volume → **${(v * 100).toFixed(0)}%**`;
                    }
                    case 'pan': {
                        const p = Math.max(-1, Math.min(1, Number(args.value)));
                        osc.send('/live/track/set/panning', t, p);
                        const panLabel = p === 0 ? 'Center' : p < 0 ? `${Math.abs(p * 100).toFixed(0)}% Left` : `${(p * 100).toFixed(0)}% Right`;
                        return `Track ${args.track} pan → **${panLabel}**`;
                    }
                    case 'rename': {
                        const name = String(args.value || 'Track');
                        osc.send('/live/track/set/name', t, name);
                        return `Track ${args.track} renamed to **${name}**`;
                    }
                    case 'color': {
                        const idx = Math.max(0, Math.min(69, Number(args.value)));
                        osc.send('/live/track/set/color_index', t, idx);
                        return `Track ${args.track} color → ${idx}`;
                    }
                    case 'monitoring': {
                        // 0 = In, 1 = Auto, 2 = Off
                        const mode = String(args.value || '').toLowerCase();
                        const mapped = mode === 'in' ? 0 : mode === 'off' ? 2 : 1;
                        osc.send('/live/track/set/current_monitoring_state', t, mapped);
                        return `Track ${args.track} monitoring → **${['In', 'Auto', 'Off'][mapped]}**`;
                    }
                    case 'input_routing':
                    case 'inroute': {
                        osc.send('/live/track/set/input_routing_type', t, String(args.value));
                        return `Track ${args.track} input routing → ${args.value}`;
                    }
                    case 'output_routing':
                    case 'outroute': {
                        osc.send('/live/track/set/output_routing_type', t, String(args.value));
                        return `Track ${args.track} output routing → ${args.value}`;
                    }
                    case 'set': {
                        // Escape hatch for any AbletonOSC track setter not covered above.
                        // e.g. property="color_index", value=5 → /live/track/set/color_index
                        const prop = String(args.property || '').trim();
                        if (!prop)
                            return 'Error: "set" requires a property parameter.';
                        const address = `/live/track/set/${prop}`;
                        const raw = args.value;
                        const numeric = typeof raw === 'number' ? raw : (raw !== undefined && !isNaN(Number(raw)) ? Number(raw) : null);
                        if (numeric !== null)
                            osc.send(address, t, numeric);
                        else
                            osc.send(address, t, String(raw));
                        return `Set track ${args.track} ${prop} = ${raw}`;
                    }
                    case 'info': {
                        const name = await osc.query('/live/track/get/name', t);
                        const vol = await osc.query('/live/track/get/volume', t);
                        const pan = await osc.query('/live/track/get/panning', t);
                        const mute = await osc.query('/live/track/get/mute', t);
                        const solo = await osc.query('/live/track/get/solo', t);
                        const arm = await osc.query('/live/track/get/arm', t);
                        return [
                            `## Track ${args.track}: ${extractArgs(name)[1]}`,
                            `- Volume: ${(Number(extractArgs(vol)[1]) * 100).toFixed(0)}%`,
                            `- Pan: ${Number(extractArgs(pan)[1]).toFixed(2)}`,
                            `- Muted: ${extractArgs(mute)[1] ? 'Yes' : 'No'}`,
                            `- Soloed: ${extractArgs(solo)[1] ? 'Yes' : 'No'}`,
                            `- Armed: ${extractArgs(arm)[1] ? 'Yes' : 'No'}`,
                        ].join('\n');
                    }
                    default:
                        return `Unknown action "${action}". Options: list, mute, unmute, solo, unsolo, arm, disarm, volume, pan, rename, info, color, monitoring, input_routing, output_routing, set`;
                }
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 3. Clip Control ──────────────────────────────────────────────────
    registerTool({
        name: 'ableton_clip',
        description: 'Control Ableton Live clips in Session View — fire/stop/create/delete/duplicate/info/list, plus set gain, warp, pitch, loop_start/end, color, launch_mode, start_marker, end_marker, velocity_amount. Track and clip numbers are 1-based.',
        parameters: {
            action: { type: 'string', description: '"fire", "stop", "create", "delete", "duplicate", "info", "list", "set"', required: true },
            track: { type: 'number', description: 'Track number (1-based)', required: true },
            clip: { type: 'number', description: 'Clip slot number (1-based). Default: 1' },
            name: { type: 'string', description: 'Clip name (for create)' },
            length: { type: 'number', description: 'Clip length in beats (for create, default: 16 = 4 bars)' },
            property: { type: 'string', description: 'For "set" action: clip property. One of: name, gain, pitch_coarse, pitch_fine, loop_start, loop_end, start_marker, end_marker, velocity_amount, color_index, launch_mode, launch_quantization, warp_mode, warping, legato, muted, ram_mode.' },
            value: { type: 'string', description: 'For "set" action: the value to assign.' },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const action = String(args.action).toLowerCase();
            const t = userTrack(args.track);
            const c = Math.max(0, (Number(args.clip) || 1) - 1);
            // kbot-control fast path for common clip ops
            const kcMap = {
                fire: { method: 'clip.fire', params: { track: t, slot: c }, label: `Fired clip ${args.clip || 1} on track ${args.track} ▶ (via kbot-control)` },
                launch: { method: 'clip.fire', params: { track: t, slot: c }, label: `Fired clip ${args.clip || 1} on track ${args.track} ▶ (via kbot-control)` },
                stop: { method: 'clip.stop', params: { track: t, slot: c }, label: `Stopped clip ${args.clip || 1} on track ${args.track} ⏹ (via kbot-control)` },
                delete: { method: 'clip.delete', params: { track: t, slot: c }, label: `Deleted clip in slot ${c + 1} on track ${args.track} (via kbot-control)` },
                duplicate: { method: 'clip.duplicate', params: { track: t, slot: c }, label: `Duplicated clip to slot ${c + 2} on track ${args.track} (via kbot-control)` },
            };
            if (kcMap[action]) {
                const kc = await tryKc(kcMap[action].method, kcMap[action].params);
                if (kc !== undefined)
                    return kcMap[action].label;
            }
            if (action === 'create') {
                const length = Number(args.length) || 16;
                const name = String(args.name || `Clip ${c + 1}`);
                const kc = await tryKc('clip.create', { track: t, slot: c, length, name });
                if (kc !== undefined)
                    return `Created clip **${name}** (${length} beats / ${length / 4} bars) on track ${args.track}, slot ${c + 1} (via kbot-control)`;
            }
            if (action === 'info') {
                const kc = await tryKc('clip.get_state', { track: t, slot: c });
                if (kc !== undefined) {
                    return [
                        `## Clip Info — Track ${args.track}, Slot ${c + 1} (via kbot-control)`,
                        `- Name: ${kc.name || '?'}`,
                        `- Length: ${kc.length} beats`,
                        `- Type: ${kc.is_midi ? 'MIDI' : kc.is_audio ? 'Audio' : '?'}`,
                        `- Playing: ${kc.is_playing ? 'Yes' : 'No'}`,
                        `- Looping: ${kc.looping ? 'Yes' : 'No'}`,
                        kc.is_audio ? `- Gain: ${kc.gain}` : null,
                        kc.is_audio ? `- Warp: ${kc.warping ? 'on' : 'off'} (mode ${kc.warp_mode})` : null,
                    ].filter(Boolean).join('\n');
                }
            }
            if (action === 'set' && args.property) {
                const kc = await tryKc('clip.set_property', { track: t, slot: c, property: String(args.property), value: args.value });
                if (kc !== undefined)
                    return `Set clip on track ${args.track} slot ${c + 1}: ${args.property} = ${args.value} (via kbot-control)`;
            }
            try {
                const osc = await ensureAbleton();
                switch (action) {
                    case 'fire':
                    case 'launch':
                        osc.send('/live/song/set/clip_trigger_quantization', 0); // immediate launch
                        osc.send('/live/clip/fire', t, c); // auto-starts transport
                        return `Fired clip ${args.clip || 1} on track ${args.track} ▶`;
                    case 'stop':
                        osc.send('/live/clip_slot/stop', t, c);
                        return `Stopped clip ${args.clip || 1} on track ${args.track} ⏹`;
                    case 'create': {
                        const length = Number(args.length) || 16;
                        const name = String(args.name || `Clip ${c + 1}`);
                        osc.send('/live/clip_slot/create_clip', t, c, length);
                        // Small delay for clip creation
                        await new Promise(r => setTimeout(r, 200));
                        osc.send('/live/clip/set/name', t, c, name);
                        return `Created clip **${name}** (${length} beats / ${length / 4} bars) on track ${args.track}, slot ${(c + 1)}`;
                    }
                    case 'delete':
                        osc.send('/live/clip_slot/delete_clip', t, c);
                        return `Deleted clip in slot ${c + 1} on track ${args.track}`;
                    case 'duplicate':
                        osc.send('/live/clip_slot/duplicate_clip_to', t, c, t, c + 1);
                        return `Duplicated clip to slot ${c + 2} on track ${args.track}`;
                    case 'info': {
                        const name = await osc.query('/live/clip/get/name', t, c);
                        const length = await osc.query('/live/clip/get/length', t, c);
                        const looping = await osc.query('/live/clip/get/looping', t, c);
                        return [
                            `## Clip Info — Track ${args.track}, Slot ${c + 1}`,
                            `- Name: ${extractArgs(name)[2] || '?'}`,
                            `- Length: ${extractArgs(length)[2] || '?'} beats`,
                            `- Looping: ${extractArgs(looping)[2] ? 'Yes' : 'No'}`,
                        ].join('\n');
                    }
                    case 'list': {
                        const lines = [`## Clips on Track ${args.track}`, ''];
                        for (let i = 0; i < 16; i++) {
                            try {
                                const hasClip = await osc.query('/live/clip_slot/get/has_clip', t, i);
                                if (extractArgs(hasClip)[2]) {
                                    const name = await osc.query('/live/clip/get/name', t, i);
                                    lines.push(`- Slot ${i + 1}: **${extractArgs(name)[2] || 'Unnamed'}**`);
                                }
                            }
                            catch {
                                break;
                            }
                        }
                        if (lines.length === 2)
                            lines.push('No clips found');
                        return lines.join('\n');
                    }
                    case 'set': {
                        // Generic setter for any clip property AbletonOSC exposes.
                        // See /live/clip/set/* — name, gain, pitch_coarse, pitch_fine,
                        // loop_start, loop_end, start_marker, end_marker, velocity_amount,
                        // color_index, launch_mode, launch_quantization, warp_mode, warping,
                        // legato, muted, ram_mode.
                        const prop = String(args.property || '').trim();
                        if (!prop)
                            return 'Error: "set" requires a property parameter.';
                        const address = `/live/clip/set/${prop}`;
                        const raw = args.value;
                        const numeric = typeof raw === 'number' ? raw : (raw !== undefined && !isNaN(Number(raw)) ? Number(raw) : null);
                        if (prop === 'name' || numeric === null) {
                            osc.send(address, t, c, String(raw));
                        }
                        else {
                            osc.send(address, t, c, numeric);
                        }
                        return `Set clip on track ${args.track} slot ${c + 1}: ${prop} = ${raw}`;
                    }
                    default:
                        return `Unknown action "${action}". Options: fire, stop, create, delete, duplicate, info, list, set`;
                }
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 4. Scene Control ─────────────────────────────────────────────────
    registerTool({
        name: 'ableton_scene',
        description: 'Control Ableton Live scenes — fire (launch all clips in a row), list scenes, create, duplicate.',
        parameters: {
            action: { type: 'string', description: '"fire", "list", "create", "duplicate", "rename"', required: true },
            scene: { type: 'number', description: 'Scene number (1-based)' },
            name: { type: 'string', description: 'Scene name (for create/rename)' },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const action = String(args.action).toLowerCase();
            try {
                const osc = await ensureAbleton();
                switch (action) {
                    case 'fire':
                    case 'launch': {
                        const s = Math.max(0, (Number(args.scene) || 1) - 1);
                        osc.send('/live/scene/fire', s);
                        return `Fired scene ${(s + 1)} ▶`;
                    }
                    case 'list': {
                        const countResult = await osc.query('/live/song/get/num_scenes');
                        const count = Number(extractArgs(countResult)[0]) || 0;
                        const lines = ['## Scenes', ''];
                        for (let i = 0; i < Math.min(count, 32); i++) {
                            try {
                                const name = await osc.query('/live/scene/get/name', i);
                                lines.push(`- Scene ${i + 1}: **${extractArgs(name)[1] || 'Unnamed'}**`);
                            }
                            catch {
                                break;
                            }
                        }
                        return lines.join('\n');
                    }
                    case 'create':
                        osc.send('/live/song/create_scene', -1);
                        return `Created new scene`;
                    case 'rename': {
                        const s = Math.max(0, (Number(args.scene) || 1) - 1);
                        osc.send('/live/scene/set/name', s, String(args.name || 'Scene'));
                        return `Renamed scene ${s + 1} to **${args.name}**`;
                    }
                    default:
                        return `Unknown action "${action}". Options: fire, list, create, rename`;
                }
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 5. MIDI Note Writing ─────────────────────────────────────────────
    registerTool({
        name: 'ableton_midi',
        description: 'Write, read, or clear MIDI notes in Ableton Live clips. Can write individual notes, chords, or full patterns. Track and clip numbers are 1-based.',
        parameters: {
            action: { type: 'string', description: '"write", "read", "clear". Default: write', },
            track: { type: 'number', description: 'Track number (1-based)', required: true },
            clip: { type: 'number', description: 'Clip slot (1-based, default: 1)' },
            notes: { type: 'string', description: 'JSON array of notes: [{"pitch":60,"start":0,"duration":1,"velocity":100}] or shorthand: "C4 E4 G4" for chord at beat 0' },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const action = String(args.action || 'write').toLowerCase();
            const t = userTrack(args.track);
            const c = Math.max(0, (Number(args.clip) || 1) - 1);
            try {
                const osc = await ensureAbleton();
                if (action === 'clear') {
                    osc.send('/live/clip/remove/notes', t, c);
                    return `Cleared all notes from track ${args.track}, clip ${(c + 1)}`;
                }
                if (action === 'read') {
                    const notes = await osc.query('/live/clip/get/notes', t, c);
                    const rawArgs = extractArgs(notes);
                    if (rawArgs.length < 5)
                        return 'No notes in this clip';
                    const lines = ['## MIDI Notes', '', '| Pitch | Note | Start | Duration | Velocity |', '|-------|------|-------|----------|----------|'];
                    // Notes come as: count, then groups of 5 (pitch, start, duration, velocity, mute)
                    for (let i = 1; i + 4 < rawArgs.length; i += 5) {
                        const pitch = Number(rawArgs[i]);
                        const start = Number(rawArgs[i + 1]);
                        const dur = Number(rawArgs[i + 2]);
                        const vel = Number(rawArgs[i + 3]);
                        lines.push(`| ${pitch} | ${midiToNoteName(pitch)} | ${start.toFixed(2)} | ${dur.toFixed(2)} | ${vel} |`);
                    }
                    return lines.join('\n');
                }
                // Write mode
                const notesStr = String(args.notes || '');
                let midiNotes = [];
                // Try JSON parse first
                try {
                    const parsed = JSON.parse(notesStr);
                    if (Array.isArray(parsed)) {
                        midiNotes = parsed.map((n) => ({
                            pitch: Number(n.pitch) || 60,
                            start: Number(n.start) || 0,
                            duration: Number(n.duration) || 1,
                            velocity: Number(n.velocity) || 80,
                        }));
                    }
                }
                catch {
                    // Try note name shorthand: "C4 E4 G4" → chord at beat 0
                    const noteNames = notesStr.split(/[\s,]+/).filter(Boolean);
                    let beat = 0;
                    for (const name of noteNames) {
                        try {
                            const pitch = noteNameToMidi(name);
                            midiNotes.push({ pitch, start: beat, duration: 1, velocity: 80 });
                        }
                        catch {
                            // Maybe it's a beat marker like "b2:"
                            const beatMatch = name.match(/^b(\d+):?$/);
                            if (beatMatch)
                                beat = Number(beatMatch[1]);
                        }
                    }
                }
                if (midiNotes.length === 0)
                    return 'No valid notes to write. Use JSON array or note names (e.g. "C4 E4 G4")';
                // Send notes via OSC — batch in groups of 50
                for (let i = 0; i < midiNotes.length; i += 50) {
                    const batch = midiNotes.slice(i, i + 50);
                    for (const note of batch) {
                        osc.send('/live/clip/add/notes', t, c, note.pitch, note.start, note.duration, note.velocity, 0);
                    }
                }
                const noteList = midiNotes.slice(0, 10).map(n => `${midiToNoteName(n.pitch)} at beat ${n.start}`).join(', ');
                const extra = midiNotes.length > 10 ? ` + ${midiNotes.length - 10} more` : '';
                return `Wrote **${midiNotes.length} notes** to track ${args.track}, clip ${c + 1}: ${noteList}${extra}`;
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 6. Device Control ────────────────────────────────────────────────
    registerTool({
        name: 'ableton_device',
        description: 'Control devices (instruments and effects) on Ableton Live tracks. List devices, get/set parameters, enable/disable. Track numbers are 1-based, device/param indices are 0-based.',
        parameters: {
            action: { type: 'string', description: '"list", "params", "set", "enable", "disable", "info"', required: true },
            track: { type: 'number', description: 'Track number (1-based)', required: true },
            device: { type: 'number', description: 'Device index (0-based) in the device chain' },
            param: { type: 'number', description: 'Parameter index (0-based) for set action' },
            value: { type: 'number', description: 'Parameter value (usually 0-1 normalized) for set action' },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const action = String(args.action).toLowerCase();
            const t = userTrack(args.track);
            const d = Number(args.device) || 0;
            // kbot-control fast path
            if (action === 'list') {
                const kc = await tryKc('device.list', { track: t });
                if (kc !== undefined) {
                    if (kc.length === 0)
                        return `No devices on track ${args.track}`;
                    const lines = [`## Devices on Track ${args.track} (via kbot-control)`, ''];
                    for (const dev of kc) {
                        const marker = dev.is_active ? '' : ' *(bypassed)*';
                        lines.push(`- [${dev.index}] **${dev.name}**${marker}`);
                    }
                    return lines.join('\n');
                }
            }
            try {
                const osc = await ensureAbleton();
                switch (action) {
                    case 'list': {
                        const devices = await osc.query('/live/track/get/devices/name', t);
                        const names = extractArgs(devices).slice(1); // first arg is track index
                        if (names.length === 0)
                            return `No devices on track ${args.track}`;
                        const lines = [`## Devices on Track ${args.track}`, ''];
                        names.forEach((name, i) => {
                            lines.push(`- [${i}] **${name}**`);
                        });
                        return lines.join('\n');
                    }
                    case 'params':
                    case 'parameters': {
                        const paramNames = await osc.query('/live/device/get/parameters/name', t, d);
                        const paramValues = await osc.query('/live/device/get/parameters/value', t, d);
                        const names = extractArgs(paramNames).slice(2); // skip track + device idx
                        const values = extractArgs(paramValues).slice(2);
                        const lines = [`## Device ${d} Parameters (Track ${args.track})`, ''];
                        lines.push('| # | Parameter | Value |');
                        lines.push('|---|-----------|-------|');
                        for (let i = 0; i < Math.min(names.length, values.length, 50); i++) {
                            lines.push(`| ${i} | ${names[i]} | ${typeof values[i] === 'number' ? Number(values[i]).toFixed(3) : values[i]} |`);
                        }
                        return lines.join('\n');
                    }
                    case 'set': {
                        const p = Number(args.param);
                        const v = Number(args.value);
                        if (isNaN(p) || isNaN(v))
                            return 'Error: param and value required for set action';
                        osc.send('/live/device/set/parameter/value', t, d, p, v);
                        return `Set device ${d} param ${p} to **${v}** on track ${args.track}`;
                    }
                    case 'enable':
                        osc.send('/live/device/set/enabled', t, d, 1);
                        return `Enabled device ${d} on track ${args.track}`;
                    case 'disable':
                        osc.send('/live/device/set/enabled', t, d, 0);
                        return `Disabled device ${d} on track ${args.track}`;
                    default:
                        return `Unknown action "${action}". Options: list, params, set, enable, disable`;
                }
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 7. Mixer ─────────────────────────────────────────────────────────
    registerTool({
        name: 'ableton_mixer',
        description: 'Batch mixer operations — snapshot all track levels, set multiple tracks at once, adjust sends.',
        parameters: {
            action: { type: 'string', description: '"snapshot" to see all levels, "set" to batch-set volumes, "send" to set send level', required: true },
            levels: { type: 'string', description: 'For "set": JSON object mapping track numbers to volumes, e.g. {"1": 0.8, "3": 0.5}' },
            track: { type: 'number', description: 'Track number (for send action)' },
            send: { type: 'number', description: 'Send index (0-based, for send action)' },
            value: { type: 'number', description: 'Send level 0-1 (for send action)' },
        },
        tier: 'free',
        timeout: 20_000,
        async execute(args) {
            const action = String(args.action).toLowerCase();
            try {
                const osc = await ensureAbleton();
                if (action === 'snapshot') {
                    const countResult = await osc.query('/live/song/get/num_tracks');
                    const count = Number(extractArgs(countResult)[0]) || 0;
                    const lines = ['## Mixer Snapshot', ''];
                    lines.push('| Track | Name | Volume | Pan |');
                    lines.push('|-------|------|--------|-----|');
                    for (let i = 0; i < Math.min(count, 32); i++) {
                        try {
                            const name = await osc.query('/live/track/get/name', i);
                            const vol = await osc.query('/live/track/get/volume', i);
                            const pan = await osc.query('/live/track/get/panning', i);
                            const volPct = (Number(extractArgs(vol)[1]) * 100).toFixed(0);
                            const panVal = Number(extractArgs(pan)[1]);
                            const panStr = panVal === 0 ? 'C' : panVal < 0 ? `L${Math.abs(panVal * 100).toFixed(0)}` : `R${(panVal * 100).toFixed(0)}`;
                            lines.push(`| ${i + 1} | ${extractArgs(name)[1]} | ${volPct}% | ${panStr} |`);
                        }
                        catch {
                            break;
                        }
                    }
                    return lines.join('\n');
                }
                if (action === 'set') {
                    try {
                        const levels = JSON.parse(String(args.levels));
                        const changes = [];
                        for (const [trackNum, vol] of Object.entries(levels)) {
                            const t = Math.max(0, Number(trackNum) - 1);
                            const v = Math.max(0, Math.min(1, Number(vol)));
                            osc.send('/live/track/set/volume', t, v);
                            changes.push(`Track ${trackNum} → ${(v * 100).toFixed(0)}%`);
                        }
                        return `Set volumes:\n${changes.map(c => `- ${c}`).join('\n')}`;
                    }
                    catch {
                        return 'Error: levels must be valid JSON, e.g. {"1": 0.8, "3": 0.5}';
                    }
                }
                if (action === 'send') {
                    const t = userTrack(args.track);
                    const s = Number(args.send) || 0;
                    const v = Math.max(0, Math.min(1, Number(args.value)));
                    osc.send('/live/track/set/send', t, s, v);
                    return `Track ${args.track} send ${s} → **${(v * 100).toFixed(0)}%**`;
                }
                return `Unknown action "${action}". Options: snapshot, set, send`;
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 8. Chord Progression Writer ──────────────────────────────────────
    registerTool({
        name: 'ableton_create_progression',
        description: 'Generate a chord progression and write it as MIDI into an Ableton clip. Supports Roman numerals (ii V I), chord symbols (Cmaj7 Am7), named progressions (Andalusian, 12-bar blues, Coltrane changes), 6 voicing styles, and rhythm patterns. Creates the clip if it doesn\'t exist.',
        parameters: {
            track: { type: 'number', description: 'Track number (1-based)', required: true },
            clip: { type: 'number', description: 'Clip slot (1-based, default: 1)' },
            key: { type: 'string', description: 'Musical key: C, F#, Bb, etc. (default: C)', },
            scale: { type: 'string', description: 'Scale type: major, minor, dorian, etc. (default: major)' },
            progression: { type: 'string', description: 'Chord progression — Roman numerals ("ii V I"), chord symbols ("Cmaj7 Am7 Fmaj7 G7"), or named ("andalusian", "coltrane", "12_bar_blues"). Use progression="list" to see all named progressions.', required: true },
            bars: { type: 'number', description: 'Number of bars (default: 4)' },
            voicing: { type: 'string', description: 'Voicing style: close, open, drop2, drop3, spread, shell (default: close)' },
            rhythm: { type: 'string', description: 'Rhythm pattern: whole, half, quarter, eighth, arpeggio_up, arpeggio_down (default: whole)' },
            octave: { type: 'number', description: 'Base octave (default: 4)' },
        },
        tier: 'free',
        timeout: 20_000,
        async execute(args) {
            // List named progressions
            if (String(args.progression) === 'list') {
                const lines = ['## Named Progressions', ''];
                lines.push('| Name | Numerals | Description |');
                lines.push('|------|----------|-------------|');
                for (const [key, prog] of Object.entries(NAMED_PROGRESSIONS)) {
                    lines.push(`| ${key} | ${prog.numerals} | ${prog.description} |`);
                }
                return lines.join('\n');
            }
            const key = String(args.key || 'C');
            const scale = String(args.scale || 'major');
            const voicingStyle = String(args.voicing || 'close');
            const rhythm = String(args.rhythm || 'whole');
            const bars = Number(args.bars) || 4;
            const octave = Number(args.octave) || 4;
            const t = userTrack(args.track);
            const c = Math.max(0, (Number(args.clip) || 1) - 1);
            // Resolve named progression
            let progressionStr = String(args.progression);
            const named = NAMED_PROGRESSIONS[progressionStr.toLowerCase().replace(/[\s-]/g, '_')];
            if (named) {
                progressionStr = named.numerals;
            }
            // Parse progression into note arrays
            let chordNotes;
            try {
                chordNotes = parseProgression(progressionStr, key, scale, octave);
            }
            catch (err) {
                return `Error parsing progression: ${err.message}`;
            }
            if (chordNotes.length === 0)
                return 'No chords parsed from progression';
            // Apply voicing
            chordNotes = chordNotes.map(notes => voiceChord(notes, voicingStyle));
            // Generate MIDI notes with rhythm
            const beatsPerBar = 4;
            const totalBeats = bars * beatsPerBar;
            const beatsPerChord = totalBeats / chordNotes.length;
            const midiNotes = [];
            for (let i = 0; i < chordNotes.length; i++) {
                const chordStart = i * beatsPerChord;
                const notes = chordNotes[i];
                if (rhythm.startsWith('arpeggio')) {
                    const pattern = rhythm.includes('down') ? 'down' : 'up';
                    const arpNotes = arpeggiate(notes, pattern, 8, beatsPerChord);
                    for (const n of arpNotes) {
                        midiNotes.push({ ...n, start: n.start + chordStart });
                    }
                }
                else {
                    // Block chord with rhythm pattern
                    const divisions = RHYTHM_PATTERNS[rhythm] || RHYTHM_PATTERNS['whole'] || [0];
                    for (const div of divisions) {
                        if (div >= beatsPerChord)
                            break;
                        const noteDur = rhythm === 'whole' ? beatsPerChord :
                            rhythm === 'half' ? 2 :
                                rhythm === 'quarter' ? 1 :
                                    rhythm === 'eighth' ? 0.5 : beatsPerChord;
                        for (const pitch of notes) {
                            midiNotes.push({
                                pitch,
                                start: chordStart + div,
                                duration: Math.min(noteDur, beatsPerChord - div),
                                velocity: 80,
                            });
                        }
                    }
                }
            }
            // Send to Ableton
            try {
                const osc = await ensureAbleton();
                // Create clip if needed
                osc.send('/live/clip_slot/create_clip', t, c, totalBeats);
                await new Promise(r => setTimeout(r, 200));
                // Write notes
                for (const note of midiNotes) {
                    osc.send('/live/clip/add/notes', t, c, note.pitch, note.start, note.duration, note.velocity, 0);
                }
                // Name the clip
                const chordNames = chordNotes.map((notes, i) => {
                    const tokens = progressionStr.split(/[\s,|]+/);
                    return tokens[i % tokens.length] || '?';
                }).join(' | ');
                osc.send('/live/clip/set/name', t, c, `${key} ${chordNames}`);
                return [
                    `## Chord Progression Written`,
                    `**Key**: ${key} ${scale}`,
                    `**Progression**: ${chordNames}`,
                    `**Voicing**: ${voicingStyle}`,
                    `**Rhythm**: ${rhythm}`,
                    `**Location**: Track ${args.track}, Clip ${c + 1} (${totalBeats} beats / ${bars} bars)`,
                    `**Notes written**: ${midiNotes.length}`,
                    named ? `**Named**: ${named.name} — ${named.description}` : '',
                ].filter(Boolean).join('\n');
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 9. Session Info ──────────────────────────────────────────────────
    registerTool({
        name: 'ableton_session_info',
        description: 'Get a full snapshot of the current Ableton Live session — tracks, clips, tempo, time signature, playing state, armed tracks, and devices. The producer agent should call this first to understand the session.',
        parameters: {
            detail: { type: 'string', description: '"summary" (default), "full", "tracks", "devices"' },
        },
        tier: 'free',
        timeout: 30_000,
        async execute(args) {
            const detail = String(args.detail || 'summary').toLowerCase();
            try {
                const osc = await ensureAbleton();
                const lines = [];
                // Transport
                const tempo = await osc.query('/live/song/get/tempo');
                const playing = await osc.query('/live/song/get/is_playing');
                const recording = await osc.query('/live/song/get/record_mode');
                lines.push('## Ableton Live Session', '');
                lines.push(`- **Tempo**: ${extractArgs(tempo)[0]} BPM`);
                lines.push(`- **Playing**: ${extractArgs(playing)[0] ? '▶ Yes' : '⏹ No'}`);
                lines.push(`- **Recording**: ${extractArgs(recording)[0] ? '⏺ Yes' : 'No'}`);
                lines.push('');
                // Tracks
                const countResult = await osc.query('/live/song/get/num_tracks');
                const trackCount = Number(extractArgs(countResult)[0]) || 0;
                lines.push(`### Tracks (${trackCount})`, '');
                if (detail === 'summary') {
                    lines.push('| # | Name | Vol | Armed | Muted | Soloed |');
                    lines.push('|---|------|-----|-------|-------|--------|');
                }
                else {
                    lines.push('| # | Name | Vol | Pan | Armed | Muted | Soloed |');
                    lines.push('|---|------|-----|-----|-------|-------|--------|');
                }
                for (let i = 0; i < Math.min(trackCount, 32); i++) {
                    try {
                        const name = await osc.query('/live/track/get/name', i);
                        const vol = await osc.query('/live/track/get/volume', i);
                        const mute = await osc.query('/live/track/get/mute', i);
                        const solo = await osc.query('/live/track/get/solo', i);
                        const arm = await osc.query('/live/track/get/arm', i);
                        const volPct = (Number(extractArgs(vol)[1]) * 100).toFixed(0) + '%';
                        const armStr = extractArgs(arm)[1] ? '⏺' : '';
                        const muteStr = extractArgs(mute)[1] ? '🔇' : '';
                        const soloStr = extractArgs(solo)[1] ? '🔊' : '';
                        if (detail === 'summary') {
                            lines.push(`| ${i + 1} | ${extractArgs(name)[1]} | ${volPct} | ${armStr} | ${muteStr} | ${soloStr} |`);
                        }
                        else {
                            const pan = await osc.query('/live/track/get/panning', i);
                            const panVal = Number(extractArgs(pan)[1]);
                            const panStr = panVal === 0 ? 'C' : panVal < 0 ? `L${Math.abs(panVal * 100).toFixed(0)}` : `R${(panVal * 100).toFixed(0)}`;
                            lines.push(`| ${i + 1} | ${extractArgs(name)[1]} | ${volPct} | ${panStr} | ${armStr} | ${muteStr} | ${soloStr} |`);
                        }
                        // Show devices in full/devices mode
                        if (detail === 'full' || detail === 'devices') {
                            try {
                                const devices = await osc.query('/live/track/get/devices/name', i);
                                const deviceNames = extractArgs(devices).slice(1);
                                if (deviceNames.length > 0) {
                                    lines.push(`|   | *Devices: ${deviceNames.join(' → ')}* | | | | |`);
                                }
                            }
                            catch { /* no devices */ }
                        }
                    }
                    catch {
                        break;
                    }
                }
                return lines.join('\n');
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 10. Load Plugin ──────────────────────────────────────────────────
    registerTool({
        name: 'ableton_load_plugin',
        description: 'Load any instrument or plugin onto a track by name — native (Operator, Wavetable, Drift) or third-party VST/AU (Serum 2, Vital, Kontakt). Tries OSC first, then falls back to AppleScript browser automation on macOS.',
        parameters: {
            track: { type: 'number', description: 'Track number (1-based)', required: true },
            plugin: { type: 'string', description: 'Plugin name to search for (e.g. "Serum 2", "Operator", "Wavetable")', required: true },
            manufacturer: { type: 'string', description: 'Manufacturer name for VST/AU (e.g. "Xfer Records", "Native Instruments"). Optional — helps narrow search.' },
            skip_results: { type: 'number', description: 'Number of Down arrow presses before selecting (to skip past FX/presets). Default: 1' },
        },
        tier: 'free',
        timeout: 20_000,
        async execute(args) {
            const t = userTrack(args.track);
            const plugin = String(args.plugin);
            const manufacturer = args.manufacturer ? String(args.manufacturer) : '';
            const skipResults = Number(args.skip_results) || 1;
            // ── Attempt 1: OSC (fast, reliable for native instruments) ──
            try {
                const osc = await ensureAbleton();
                // Select the target track first so the plugin loads there
                osc.send('/live/song/set/current_track', t);
                await new Promise(r => setTimeout(r, 200));
                // Try native load_device endpoint (works for Ableton built-in instruments)
                const nativeResult = await osc.query('/live/track/load/device', t, plugin);
                const nativeStatus = extractArgs(nativeResult);
                if (nativeStatus.length > 0 && String(nativeStatus[0]) !== 'error') {
                    return `Loaded **${plugin}** on track ${args.track} (via OSC)`;
                }
            }
            catch {
                // OSC failed — fall through to AppleScript
            }
            // ── Attempt 2: AppleScript browser automation (macOS only) ──
            // Uses Ableton's built-in browser search: Cmd+F → type name → arrow down → Return
            // Proven approach from ZENOLOGY loading session
            if (process.platform !== 'darwin') {
                return `Plugin "${plugin}" could not be loaded via OSC. AppleScript fallback is macOS-only.`;
            }
            try {
                const searchTerm = manufacturer ? `${manufacturer} ${plugin}` : plugin;
                // Build AppleScript: activate Ableton, open browser search, type plugin name, select, load
                const downArrows = Array(skipResults).fill('key code 125').join('\ndelay 0.3\n'); // 125 = Down arrow
                const script = `
tell application "Ableton Live 12"
  activate
end tell
delay 0.5
tell application "System Events"
  tell process "Ableton Live 12"
    -- Open browser search: Cmd+F (View > Search in Browser)
    keystroke "f" using command down
    delay 0.8
    -- Clear any existing search text and type plugin name
    keystroke "a" using command down
    delay 0.1
    keystroke "${searchTerm.replace(/"/g, '\\"')}"
    delay 1.0
    -- Navigate down to the result (skip past categories/folders)
    ${downArrows}
    delay 0.3
    -- Press Return to load the selected item onto the current track
    key code 36
    delay 0.5
  end tell
end tell
return "ok"
`;
                const lines = script.split('\n').filter(l => l.trim());
                const escapedArgs = lines.map(l => `-e '${l.replace(/'/g, "'\\''")}'`).join(' ');
                const result = execSync(`osascript ${escapedArgs}`, {
                    encoding: 'utf-8',
                    timeout: 15_000,
                    stdio: ['pipe', 'pipe', 'pipe'],
                }).trim();
                if (result === 'ok') {
                    return `Loaded **${plugin}** on track ${args.track} (via AppleScript browser search)`;
                }
                return `AppleScript returned unexpected result: ${result}`;
            }
            catch (err) {
                const msg = err.message;
                if (msg.includes('not allowed') || msg.includes('assistive')) {
                    return `AppleScript failed — Accessibility permission required.\n\nGrant permission in System Settings > Privacy & Security > Accessibility for your terminal app.`;
                }
                return `Failed to load "${plugin}": OSC endpoint not available, AppleScript fallback failed.\n\nError: ${msg}`;
            }
        },
    });
    // ─── 11. Load Sample into Drum Rack ───────────────────────────────────
    registerTool({
        name: 'ableton_load_sample',
        description: 'Load a sample (WAV/AIF) from the User Library into a specific Drum Rack pad. The sample must be in Ableton\'s User Library (~/Music/Ableton/User Library/Samples/). Use with splice_download to get samples first.',
        parameters: {
            track: { type: 'number', description: 'Track number with Drum Rack (1-based)', required: true },
            pad: { type: 'number', description: 'MIDI note for the pad: 36=C1(kick), 37=C#1, 38=D1(snare), 39=Eb1(clap), 40=E1, 41=F1, 42=F#1(hihat), 43=G1, 44=Ab1, 45=A1, 46=Bb1(open hat)', required: true },
            sample: { type: 'string', description: 'Sample filename to search for (e.g. "kick_808", "snare", "hihat")', required: true },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const t = userTrack(args.track);
            const pad = Number(args.pad);
            const sample = String(args.sample);
            try {
                const osc = await ensureAbleton();
                const result = await osc.query('/live/kbot/load_sample_file', t, pad, sample);
                const status = extractArgs(result);
                if (status[0] === 'ok') {
                    const noteNames = { 36: 'C1', 37: 'C#1', 38: 'D1', 39: 'Eb1', 40: 'E1', 41: 'F1', 42: 'F#1', 43: 'G1', 44: 'Ab1', 45: 'A1', 46: 'Bb1' };
                    return `Loaded **${status[1]}** onto pad ${noteNames[pad] || pad} (track ${args.track})`;
                }
                return `Could not load "${sample}": ${status.join(', ')}`;
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 12. Build Drum Rack ──────────────────────────────────────────────
    registerTool({
        name: 'ableton_build_drum_rack',
        description: 'Build a complete Drum Rack from scratch — creates the rack, loads samples from User Library into pads, and writes a drum pattern. One command to go from nothing to a full drum track with Splice samples.',
        parameters: {
            track: { type: 'number', description: 'Track number to build on (1-based)', required: true },
            kick: { type: 'string', description: 'Kick sample search term (e.g. "kick_808")' },
            snare: { type: 'string', description: 'Snare sample search term (e.g. "snare")' },
            clap: { type: 'string', description: 'Clap sample search term (e.g. "clap")' },
            hihat: { type: 'string', description: 'Hihat sample search term (e.g. "hihat")' },
            pattern: { type: 'string', description: 'Drum pattern style: "trap", "house", "hiphop", "dnb", "lofi", "rock" (default: trap)' },
            bars: { type: 'number', description: 'Number of bars (default: 16)' },
        },
        tier: 'free',
        timeout: 30_000,
        async execute(args) {
            const t = userTrack(args.track);
            const bars = Number(args.bars) || 16;
            const totalBeats = bars * 4;
            const pattern = String(args.pattern || 'trap').toLowerCase();
            try {
                const osc = await ensureAbleton();
                const lines = ['## Building Drum Rack', ''];
                // Load samples into pads
                const padMap = [
                    { note: 36, name: 'Kick', search: String(args.kick || 'kick') },
                    { note: 38, name: 'Snare', search: String(args.snare || 'snare') },
                    { note: 39, name: 'Clap', search: String(args.clap || 'clap') },
                    { note: 42, name: 'Hihat', search: String(args.hihat || 'hihat') },
                ];
                for (const pad of padMap) {
                    if (pad.search && pad.search !== 'undefined') {
                        try {
                            const result = await osc.query('/live/kbot/load_sample_file', t, pad.note, pad.search);
                            const status = extractArgs(result);
                            lines.push(`- ${pad.name} (${pad.note}): ${status[0] === 'ok' ? '✓ ' + status[1] : '✗ ' + status.join(', ')}`);
                        }
                        catch {
                            lines.push(`- ${pad.name}: failed to load`);
                        }
                    }
                }
                lines.push('');
                // Create clip and write pattern
                osc.send('/live/clip_slot/delete_clip', t, 0);
                await new Promise(r => setTimeout(r, 300));
                osc.send('/live/clip_slot/create_clip', t, 0, totalBeats);
                await new Promise(r => setTimeout(r, 300));
                osc.send('/live/clip/set/name', t, 0, `${pattern} drums`);
                // Write pattern based on genre
                const patternData = GENRE_DRUM_PATTERNS[pattern] || GENRE_DRUM_PATTERNS['trap'];
                if (patternData) {
                    const bpmRange = patternData.bpm;
                    const drumPattern = patternData.pattern;
                    // Map pattern names to MIDI notes
                    const noteMap = {
                        kick: 36, snare: 38, closed_hihat: 42, open_hihat: 46,
                        clap: 39, rim: 37, tom_low: 43, tom_mid: 47, tom_high: 50,
                        crash: 49, ride: 51, shaker: 70, perc: 67,
                    };
                    for (const [drumName, hits] of Object.entries(drumPattern)) {
                        const midiNote = noteMap[drumName] || 36;
                        for (let bar = 0; bar < bars; bar++) {
                            for (const hit of hits) {
                                const beat = bar * 4 + hit * 0.25; // hits are in 16th note positions
                                const vel = drumName === 'kick' ? 110 : drumName === 'snare' || drumName === 'clap' ? 100 : 75 + Math.floor(Math.random() * 25);
                                osc.send('/live/clip/add/notes', t, 0, midiNote, beat, 0.2, vel, 0);
                            }
                        }
                    }
                    lines.push(`**Pattern**: ${pattern} (${bars} bars)`);
                    lines.push(`**BPM range**: ${bpmRange[0]}-${bpmRange[1]}`);
                }
                // Fire the clip — set immediate quantization and use clip/fire (auto-starts transport)
                osc.send('/live/song/set/clip_trigger_quantization', 0);
                osc.send('/live/clip/fire', t, 0);
                lines.push('');
                lines.push('▶ Drum Rack built and playing');
                return lines.join('\n');
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 13. Create Track ─────────────────────────────────────────────────
    registerTool({
        name: 'ableton_create_track',
        description: 'Create a new MIDI, audio, or return track in Ableton and optionally load an instrument on it.',
        parameters: {
            type: { type: 'string', description: '"midi", "audio", or "return" (default: midi)', },
            name: { type: 'string', description: 'Track name' },
            instrument: { type: 'string', description: 'Optional: instrument to load (midi tracks only — e.g. "Serum 2", "Operator")' },
            manufacturer: { type: 'string', description: 'Optional: plugin manufacturer (e.g. "Xfer Records")' },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const trackType = String(args.type || 'midi').toLowerCase();
            try {
                const osc = await ensureAbleton();
                // Create the track
                if (trackType === 'audio') {
                    osc.send('/live/kbot/create_audio_track', -1);
                }
                else if (trackType === 'return') {
                    // AbletonOSC native path for return tracks. kbot bridge may not
                    // wrap this, so we use the standard OSC address directly.
                    osc.send('/live/song/create_return_track');
                }
                else {
                    osc.send('/live/kbot/create_midi_track', -1);
                }
                await new Promise(r => setTimeout(r, 500));
                // Get the new track count to find the new track's index
                const countResult = await osc.query('/live/song/get/num_tracks');
                const newTrackIdx = Number(extractArgs(countResult)[0]) - 1;
                // Name it
                if (args.name) {
                    osc.send('/live/track/set/name', newTrackIdx, String(args.name));
                }
                // Load instrument if specified — try native OSC first, then load_plugin tool handles fallbacks
                if (args.instrument) {
                    try {
                        const loadResult = await osc.query('/live/track/load/device', newTrackIdx, String(args.instrument));
                        const loadStatus = extractArgs(loadResult);
                        if (loadStatus.length === 0 || String(loadStatus[0]) === 'error') {
                            // Native load failed — OSC doesn't have this device. The user can use
                            // ableton_load_plugin separately which has AppleScript fallback.
                        }
                    }
                    catch {
                        // Timeout or connection error — device may still have loaded, continue
                    }
                }
                return `Created ${trackType} track **${args.name || 'Track ' + (newTrackIdx + 1)}**${args.instrument ? ' with ' + args.instrument : ''} (track ${newTrackIdx + 1})`;
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 13b. Song-level control ──────────────────────────────────────────
    registerTool({
        name: 'ableton_song',
        description: 'Song-level Ableton controls — undo, redo, tap tempo, metronome, punch in/out, cue points, loop, back to arranger, capture MIDI, stop all clips, groove, record_mode.',
        parameters: {
            action: { type: 'string', description: '"undo", "redo", "tap_tempo", "metronome", "punch_in", "punch_out", "cue_add", "cue_delete", "cue_next", "cue_prev", "cue_jump", "loop", "loop_start", "loop_length", "back_to_arranger", "capture_midi", "stop_all_clips", "groove", "record_mode", "jump_by", "status"', required: true },
            value: { type: 'string', description: 'Value for the action: 1/0 for toggles (metronome/loop/punch/record_mode), beats for loop_start/length/jump_by/groove, name for cue_add.' },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const action = String(args.action).toLowerCase();
            // kbot-control fast path: most song.* methods map 1:1 to dispatcher.
            const kcMap = {
                undo: { method: 'song.undo', label: '↶ Undo' },
                redo: { method: 'song.redo', label: '↷ Redo' },
                tap_tempo: { method: 'song.tap_tempo', label: '👆 Tap tempo' },
                tap: { method: 'song.tap_tempo', label: '👆 Tap tempo' },
                capture_midi: { method: 'song.capture_midi', label: '🎹 Captured MIDI' },
                stop_all_clips: { method: 'song.stop_all_clips', label: '⏹ Stopped all clips' },
                back_to_arranger: { method: 'song.back_to_arranger', label: 'Switched to Arrangement view' },
                metronome: { method: 'song.metronome', buildParams: () => ({ value: String(args.value).match(/^(1|true|on|yes)$/i) ? 1 : 0 }) },
                loop: { method: 'song.loop', buildParams: () => ({ value: String(args.value).match(/^(1|true|on|yes)$/i) ? 1 : 0 }) },
                record_mode: { method: 'song.record_mode', buildParams: () => ({ value: String(args.value).match(/^(1|true|on|yes)$/i) ? 1 : 0 }) },
                jump_by: { method: 'song.jump_by', buildParams: () => ({ beats: Number(args.value) }) },
                status: { method: 'song.get_state' },
            };
            const entry = kcMap[action];
            if (entry) {
                const kc = await tryKc(entry.method, entry.buildParams?.());
                if (kc !== undefined) {
                    if (action === 'status' && kc && typeof kc === 'object') {
                        const s = kc;
                        return [
                            '## Song status (via kbot-control)',
                            `- Tempo: ${Number(s.tempo).toFixed(1)} BPM`,
                            `- Playing: ${s.is_playing ? 'Yes' : 'No'}`,
                            `- Loop: ${s.loop ? 'on' : 'off'}`,
                            `- Metronome: ${s.metronome ? 'on' : 'off'}`,
                            `- Punch in/out: ${s.punch_in ? 'on' : 'off'} / ${s.punch_out ? 'on' : 'off'}`,
                            `- Record mode: ${s.record_mode ? 'on' : 'off'}`,
                        ].join('\n');
                    }
                    return entry.label ?? `${entry.method} → ${typeof kc === 'string' ? kc : JSON.stringify(kc)}`;
                }
            }
            try {
                const osc = await ensureAbleton();
                const asBool = (v) => {
                    const s = String(v).toLowerCase();
                    if (s === '1' || s === 'true' || s === 'on' || s === 'yes')
                        return 1;
                    if (s === '0' || s === 'false' || s === 'off' || s === 'no')
                        return 0;
                    return Number(v) ? 1 : 0;
                };
                switch (action) {
                    case 'undo':
                        osc.send('/live/song/undo');
                        return '↶ Undo';
                    case 'redo':
                        osc.send('/live/song/redo');
                        return '↷ Redo';
                    case 'tap_tempo':
                    case 'tap':
                        osc.send('/live/song/tap_tempo');
                        return '👆 Tap tempo';
                    case 'metronome': {
                        const v = args.value === undefined ? 1 : asBool(args.value);
                        osc.send('/live/song/set/metronome', v);
                        return `Metronome → ${v ? 'on' : 'off'}`;
                    }
                    case 'punch_in': {
                        const v = args.value === undefined ? 1 : asBool(args.value);
                        osc.send('/live/song/set/punch_in', v);
                        return `Punch-in → ${v ? 'on' : 'off'}`;
                    }
                    case 'punch_out': {
                        const v = args.value === undefined ? 1 : asBool(args.value);
                        osc.send('/live/song/set/punch_out', v);
                        return `Punch-out → ${v ? 'on' : 'off'}`;
                    }
                    case 'cue_add':
                        osc.send('/live/song/cue_point/add_or_delete');
                        if (args.value)
                            osc.send('/live/song/cue_point/set/name', String(args.value));
                        return `Cue point added${args.value ? ` "${args.value}"` : ''}`;
                    case 'cue_delete':
                        osc.send('/live/song/cue_point/add_or_delete');
                        return 'Cue point at playhead deleted';
                    case 'cue_next':
                        osc.send('/live/song/jump_to_next_cue');
                        return '→ Next cue';
                    case 'cue_prev':
                        osc.send('/live/song/jump_to_prev_cue');
                        return '← Previous cue';
                    case 'cue_jump': {
                        const v = Number(args.value);
                        if (isNaN(v))
                            return 'Error: cue_jump needs a cue index in value.';
                        osc.send('/live/song/cue_point/jump', v);
                        return `Jumped to cue ${v}`;
                    }
                    case 'loop': {
                        const v = args.value === undefined ? 1 : asBool(args.value);
                        osc.send('/live/song/set/loop', v);
                        return `Loop → ${v ? 'on' : 'off'}`;
                    }
                    case 'loop_start': {
                        const v = Number(args.value);
                        if (isNaN(v))
                            return 'Error: loop_start needs a beat position in value.';
                        osc.send('/live/song/set/loop_start', v);
                        return `Loop start → beat ${v}`;
                    }
                    case 'loop_length': {
                        const v = Number(args.value);
                        if (isNaN(v))
                            return 'Error: loop_length needs a beat length in value.';
                        osc.send('/live/song/set/loop_length', v);
                        return `Loop length → ${v} beats`;
                    }
                    case 'back_to_arranger':
                        osc.send('/live/song/set/back_to_arranger', 1);
                        return 'Switched to Arrangement view (back_to_arranger)';
                    case 'capture_midi':
                        osc.send('/live/song/capture_midi');
                        return '🎹 Captured MIDI from armed tracks';
                    case 'stop_all_clips':
                        osc.send('/live/song/stop_all_clips');
                        return '⏹ Stopped all clips';
                    case 'groove': {
                        const v = Math.max(0, Math.min(1, Number(args.value)));
                        osc.send('/live/song/set/groove_amount', v);
                        return `Groove amount → ${(v * 100).toFixed(0)}%`;
                    }
                    case 'record_mode': {
                        const v = args.value === undefined ? 1 : asBool(args.value);
                        osc.send('/live/song/set/record_mode', v);
                        return `Arrangement record → ${v ? 'on' : 'off'}`;
                    }
                    case 'jump_by': {
                        const v = Number(args.value);
                        if (isNaN(v))
                            return 'Error: jump_by needs a beat delta in value.';
                        osc.send('/live/song/jump_by', v);
                        return `Jumped by ${v} beats`;
                    }
                    case 'status': {
                        const tempo = await osc.query('/live/song/get/tempo');
                        const playing = await osc.query('/live/song/get/is_playing');
                        const loop = await osc.query('/live/song/get/loop');
                        const metro = await osc.query('/live/song/get/metronome');
                        const punchIn = await osc.query('/live/song/get/punch_in');
                        const punchOut = await osc.query('/live/song/get/punch_out');
                        return [
                            `## Song status`,
                            `- Tempo: ${Number(extractArgs(tempo)[0]).toFixed(1)} BPM`,
                            `- Playing: ${extractArgs(playing)[0] ? 'Yes' : 'No'}`,
                            `- Loop: ${extractArgs(loop)[0] ? 'on' : 'off'}`,
                            `- Metronome: ${extractArgs(metro)[0] ? 'on' : 'off'}`,
                            `- Punch in/out: ${extractArgs(punchIn)[0] ? 'on' : 'off'} / ${extractArgs(punchOut)[0] ? 'on' : 'off'}`,
                        ].join('\n');
                    }
                    default:
                        return `Unknown action "${action}". Options: undo, redo, tap_tempo, metronome, punch_in, punch_out, cue_add, cue_delete, cue_next, cue_prev, cue_jump, loop, loop_start, loop_length, back_to_arranger, capture_midi, stop_all_clips, groove, record_mode, jump_by, status`;
                }
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 13c. View / selection control ────────────────────────────────────
    registerTool({
        name: 'ableton_view',
        description: 'Drive the Ableton UI cursor — get or set the currently selected scene, track, clip, or device. Use this to focus the user\'s view before opening a device, or to read what the user is looking at.',
        parameters: {
            action: { type: 'string', description: '"get" or "set"', required: true },
            target: { type: 'string', description: '"scene", "track", "clip", or "device"', required: true },
            track: { type: 'number', description: 'Track number (1-based) — required for set target=clip or set target=device' },
            clip: { type: 'number', description: 'Clip slot (1-based) — required for set target=clip' },
            device: { type: 'number', description: 'Device index (0-based) — required for set target=device' },
            value: { type: 'number', description: 'Scene number (1-based) or track number (1-based) when setting scene/track selection.' },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const action = String(args.action).toLowerCase();
            const target = String(args.target).toLowerCase();
            try {
                const osc = await ensureAbleton();
                if (action === 'get') {
                    switch (target) {
                        case 'scene': {
                            const r = await osc.query('/live/view/get/selected_scene');
                            const idx = Number(extractArgs(r)[0]);
                            return `Selected scene: ${idx + 1} (0-based ${idx})`;
                        }
                        case 'track': {
                            const r = await osc.query('/live/view/get/selected_track');
                            const idx = Number(extractArgs(r)[0]);
                            return `Selected track: ${idx + 1} (0-based ${idx})`;
                        }
                        case 'clip': {
                            const r = await osc.query('/live/view/get/selected_clip');
                            return `Selected clip: [${extractArgs(r).join(', ')}]`;
                        }
                        case 'device': {
                            const r = await osc.query('/live/view/get/selected_device');
                            return `Selected device: [${extractArgs(r).join(', ')}]`;
                        }
                        default:
                            return `Unknown target "${target}". Options: scene, track, clip, device`;
                    }
                }
                if (action === 'set') {
                    switch (target) {
                        case 'scene': {
                            const s = Math.max(0, (Number(args.value) || 1) - 1);
                            // Prefer kbot-control (actually scrolls + highlights)
                            const kc = await tryKc('view.focus_scene', { index: s });
                            if (kc !== undefined)
                                return `Focused scene ${s + 1} (via kbot-control)`;
                            osc.send('/live/view/set/selected_scene', s);
                            return `Focused scene ${s + 1}`;
                        }
                        case 'track': {
                            const t = Math.max(0, (Number(args.value) || 1) - 1);
                            // kbot-control's view.focus_track also scrolls + highlights,
                            // fixing the bug that made OSC-based device loads hit the wrong track.
                            const kc = await tryKc('view.focus_track', { index: t });
                            if (kc !== undefined)
                                return `Focused track ${t + 1} (via kbot-control — scrolled + highlighted)`;
                            osc.send('/live/view/set/selected_track', t);
                            return `Focused track ${t + 1}`;
                        }
                        case 'clip': {
                            if (!args.track || !args.clip)
                                return 'Error: set target=clip requires track and clip.';
                            const t = userTrack(args.track);
                            const c = Math.max(0, Number(args.clip) - 1);
                            const kc = await tryKc('view.focus_clip', { track: t, slot: c });
                            if (kc !== undefined)
                                return `Focused clip on track ${args.track} slot ${args.clip} (via kbot-control)`;
                            osc.send('/live/view/set/selected_clip', t, c);
                            return `Focused clip on track ${args.track} slot ${args.clip}`;
                        }
                        case 'device': {
                            if (!args.track || args.device === undefined)
                                return 'Error: set target=device requires track and device index.';
                            const t = userTrack(args.track);
                            const d = Number(args.device);
                            osc.send('/live/view/set/selected_device', t, d);
                            return `Focused device ${d} on track ${args.track}`;
                        }
                        default:
                            return `Unknown target "${target}". Options: scene, track, clip, device`;
                    }
                }
                return `Unknown action "${action}". Options: get, set`;
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
    // ─── 14. Splice Search & Download ─────────────────────────────────────
    registerTool({
        name: 'splice_search',
        description: 'Search Splice for samples — returns sample names, tags, and UUIDs from splice.com. Requires Playwright MCP for browser automation. Samples can then be downloaded with splice_download.',
        parameters: {
            query: { type: 'string', description: 'Search query (e.g. "trap 808 kick", "vocal chop rnb", "ambient pad")', required: true },
            limit: { type: 'number', description: 'Max results to return (default: 5)' },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const query = String(args.query);
            const limit = Number(args.limit) || 5;
            try {
                // Fetch search results from splice.com
                const https = await import('https');
                const html = await new Promise((resolve, reject) => {
                    https.get({
                        hostname: 'splice.com',
                        path: '/sounds/search/samples?q=' + encodeURIComponent(query),
                        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh)' }
                    }, (res) => {
                        let data = '';
                        res.on('data', (c) => data += c);
                        res.on('end', () => resolve(data));
                    }).on('error', reject);
                });
                // Extract sample info
                const uuids = [...new Set((html.match(/sounds\/sample\/([a-f0-9]{64})/g) || [])
                        .map((m) => m.replace('sounds/sample/', '')))];
                const names = (html.match(/"name":"([^"]+\.wav)"/g) || [])
                    .map((m) => m.replace(/"name":"/, '').replace(/"$/, ''));
                if (uuids.length === 0)
                    return `No results for "${query}" on Splice.`;
                const lines = [`## Splice Results: "${query}"`, '', `Found ${uuids.length} samples:`, ''];
                for (let i = 0; i < Math.min(limit, uuids.length); i++) {
                    lines.push(`${i + 1}. **${names[i] || 'Sample ' + (i + 1)}**`);
                    lines.push(`   UUID: \`${uuids[i].slice(0, 16)}...\``);
                }
                lines.push('');
                lines.push('Use `splice_download` with Playwright to license and download these samples (1 credit each).');
                return lines.join('\n');
            }
            catch (err) {
                return `Splice search failed: ${err.message}`;
            }
        },
    });
    // ─── 15. Audio Analysis ──────────────────────────────────────────────
    registerTool({
        name: 'ableton_audio_analysis',
        description: 'Get real-time audio level meters from Ableton Live — track output levels (L/R RMS), master output, and peak detection. Use this to hear what is playing, check if a track has signal, or monitor the mix.',
        parameters: {
            track: { type: 'number', description: 'Track number to analyze (1-based). Omit to get master output only.' },
            all_tracks: { type: 'boolean', description: 'If true, read levels for all tracks plus master. Default: false' },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            try {
                const osc = await ensureAbleton();
                const lines = ['## Audio Levels', ''];
                // Helper to read a meter value with error handling
                async function readMeter(address, ...oscArgs) {
                    try {
                        const result = await osc.query(address, ...oscArgs);
                        const vals = extractArgs(result);
                        // Meter values are typically floats 0.0 - 1.0 (or higher for clipping)
                        return typeof vals[vals.length - 1] === 'number' ? vals[vals.length - 1] : 0;
                    }
                    catch {
                        return -1; // timeout = no response
                    }
                }
                // Meter bar visualization
                function meterBar(level) {
                    if (level < 0)
                        return '[-no signal-]';
                    const db = level > 0 ? 20 * Math.log10(level) : -Infinity;
                    const dbStr = db === -Infinity ? '-inf' : db.toFixed(1);
                    const barLen = Math.min(20, Math.max(0, Math.round(level * 20)));
                    const bar = '\u2588'.repeat(barLen) + '\u2591'.repeat(20 - barLen);
                    return `[${bar}] ${dbStr} dB`;
                }
                if (args.all_tracks) {
                    // Read all track levels
                    const countResult = await osc.query('/live/song/get/num_tracks');
                    const numTracks = Number(extractArgs(countResult)[0]) || 0;
                    for (let t = 0; t < numTracks - 1; t++) { // -1 to skip master return
                        const nameResult = await osc.query('/live/track/get/name', t);
                        const name = extractArgs(nameResult)[1] || `Track ${t + 1}`;
                        const left = await readMeter('/live/track/get/output_meter_left', t);
                        const right = await readMeter('/live/track/get/output_meter_right', t);
                        const avg = left >= 0 && right >= 0 ? (left + right) / 2 : Math.max(left, right);
                        lines.push(`**${displayTrack(t)}. ${name}**: ${meterBar(avg)}`);
                        if (left >= 0 && right >= 0 && Math.abs(left - right) > 0.05) {
                            lines.push(`  L: ${meterBar(left)} | R: ${meterBar(right)}`);
                        }
                    }
                    lines.push('');
                }
                else if (args.track) {
                    // Read specific track
                    const t = userTrack(args.track);
                    const nameResult = await osc.query('/live/track/get/name', t);
                    const name = extractArgs(nameResult)[1] || `Track ${args.track}`;
                    const left = await readMeter('/live/track/get/output_meter_left', t);
                    const right = await readMeter('/live/track/get/output_meter_right', t);
                    lines.push(`**Track ${args.track} (${name})**`);
                    lines.push(`  Left:  ${meterBar(left)}`);
                    lines.push(`  Right: ${meterBar(right)}`);
                    // Check if signal is present
                    const avg = left >= 0 && right >= 0 ? (left + right) / 2 : Math.max(left, right);
                    if (avg <= 0) {
                        lines.push('');
                        lines.push('No signal detected. Check: is the track armed? Is transport playing? Does the track have clips?');
                    }
                    else if (avg > 1.0) {
                        lines.push('');
                        lines.push('**Warning**: Signal is clipping! Reduce track volume.');
                    }
                    lines.push('');
                }
                // Always show master output
                const masterLeft = await readMeter('/live/master/get/output_meter_left');
                const masterRight = await readMeter('/live/master/get/output_meter_right');
                lines.push('**Master Output**');
                lines.push(`  Left:  ${meterBar(masterLeft)}`);
                lines.push(`  Right: ${meterBar(masterRight)}`);
                const masterAvg = masterLeft >= 0 && masterRight >= 0 ? (masterLeft + masterRight) / 2 : Math.max(masterLeft, masterRight);
                if (masterAvg <= 0) {
                    lines.push('');
                    lines.push('No audio on master output. Is transport playing?');
                }
                else if (masterAvg > 0.9) {
                    lines.push('');
                    lines.push('**Loud!** Master is near clipping. Consider reducing levels.');
                }
                return lines.join('\n');
            }
            catch (err) {
                return `Ableton connection failed: ${err.message}\n\n${formatAbletonError()}`;
            }
        },
    });
}
//# sourceMappingURL=ableton.js.map