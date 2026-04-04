/**
 * ableton-bridge-tools.ts — Ableton Browser & Device Loading Tools
 *
 * Uses AbletonBridge (port 9001) for full Ableton Browser API access.
 * Falls back to KBotBridge (port 9998) if AbletonBridge is unavailable.
 *
 * Tools:
 *   ableton_load_effect  — Load any Ableton native effect by name onto a track
 *   ableton_browse       — Search Ableton's browser (instruments, effects, presets, samples)
 *   ableton_load_preset  — Load a preset onto a device
 *   ableton_effect_chain — Apply a full chain of effects to a track in sequence
 */
import { registerTool } from './index.js';
import { tryAbletonBridge, tryKBotRemote, formatBridgeError, } from '../integrations/ableton-bridge.js';
// ── Helpers ─────────────────────────────────────────────────────────────
/** Convert 1-based user track to 0-based internal index. */
function userTrack(track) {
    const n = Number(track);
    return Math.max(0, n - 1);
}
/** Category aliases for user convenience. */
const CATEGORY_ALIASES = {
    effects: 'audio_effects',
    effect: 'audio_effects',
    fx: 'audio_effects',
    audio_fx: 'audio_effects',
    midi_fx: 'midi_effects',
    midi: 'midi_effects',
    inst: 'instruments',
    instrument: 'instruments',
    drum: 'drums',
    kit: 'drums',
    sound: 'sounds',
    pack: 'packs',
    plugin: 'plugins',
    vst: 'plugins',
    au: 'plugins',
    sample: 'samples',
    preset: 'presets',
};
function resolveCategory(raw) {
    if (!raw)
        return undefined;
    const lower = raw.toLowerCase().trim();
    return CATEGORY_ALIASES[lower] ?? lower;
}
/** Format browser items for display. */
function formatBrowserItems(items, limit = 20) {
    if (items.length === 0)
        return 'No results found.';
    const shown = items.slice(0, limit);
    const lines = shown.map((item) => {
        const tags = [];
        if (item.isDevice)
            tags.push('device');
        if (item.isFolder)
            tags.push('folder');
        if (item.isLoadable)
            tags.push('loadable');
        const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
        return `- **${item.name}**${tagStr}\n  URI: \`${item.uri}\``;
    });
    let result = lines.join('\n');
    if (items.length > limit) {
        result += `\n\n_...and ${items.length - limit} more results_`;
    }
    return result;
}
// ── Tool Registration ───────────────────────────────────────────────────
export function registerAbletonBridgeTools() {
    // ─── 1. Load Effect ───────────────────────────────────────────────────
    registerTool({
        name: 'ableton_load_effect',
        description: 'Load any Ableton native audio effect by name onto a track. ' +
            'This is the primary tool for adding effects like Saturator, Reverb, Compressor, EQ Eight, Auto Filter, etc. ' +
            'Searches Ableton\'s browser via AbletonBridge and loads the device directly. ' +
            'Supports position control to place the effect before or after existing devices.',
        parameters: {
            track: { type: 'number', description: 'Track number (1-based)', required: true },
            name: { type: 'string', description: 'Effect name (e.g. "Saturator", "Reverb", "Compressor", "EQ Eight", "Auto Filter", "Chorus-Ensemble")', required: true },
            position: {
                type: 'string',
                description: 'Where to place the effect: "before" (start of chain), "after" (after last device), "end" (same as after). Default: "end"',
            },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const t = userTrack(args.track);
            const name = String(args.name).trim();
            const position = String(args.position ?? 'end').toLowerCase();
            try {
                // Try AbletonBridge first (full browser API)
                const ab = await tryAbletonBridge();
                if (ab) {
                    // Search specifically in audio_effects category
                    const items = await ab.searchBrowser(name, 'audio_effects');
                    // Find exact name match first, then partial match
                    const exactMatch = items.find((item) => item.isLoadable && item.name.toLowerCase() === name.toLowerCase());
                    const partialMatch = items.find((item) => item.isLoadable && item.name.toLowerCase().includes(name.toLowerCase()));
                    const target = exactMatch ?? partialMatch;
                    if (!target) {
                        // Try broader search without category filter
                        const broadItems = await ab.searchBrowser(name);
                        const broadMatch = broadItems.find((item) => item.isLoadable && (item.isDevice || item.name.toLowerCase().includes(name.toLowerCase())));
                        if (broadMatch) {
                            await ab.loadDevice(t, broadMatch.uri);
                            return `Loaded **${broadMatch.name}** on track ${args.track} (via browser search)`;
                        }
                        return `Effect "${name}" not found in Ableton's browser. Check the exact name (e.g. "EQ Eight" not "EQ8").`;
                    }
                    await ab.loadDevice(t, target.uri);
                    // Handle position if not "end" — move device within chain
                    if (position === 'before') {
                        const chain = await ab.getEffectChain(t);
                        if (chain.length > 1) {
                            // The newly loaded device is at the end — note this for the user
                            return `Loaded **${target.name}** on track ${args.track} (at end of chain — ${chain.length} devices total). Note: position reordering requires manual adjustment in Ableton.`;
                        }
                    }
                    return `Loaded **${target.name}** on track ${args.track}`;
                }
                // Fallback to KBotBridge Remote Script
                const kb = await tryKBotRemote();
                if (kb) {
                    const ok = await kb.loadDevice(t, name);
                    if (ok) {
                        return `Loaded **${name}** on track ${args.track} (via KBotBridge)`;
                    }
                    return `KBotBridge could not load "${name}". The device may not be found in the browser.`;
                }
                // Neither bridge available
                return formatBridgeError();
            }
            catch (err) {
                return `Failed to load effect: ${err.message}\n\n${formatBridgeError()}`;
            }
        },
    });
    // ─── 2. Browse ────────────────────────────────────────────────────────
    registerTool({
        name: 'ableton_browse',
        description: 'Search Ableton\'s browser for instruments, effects, presets, samples, packs, and plugins. ' +
            'Returns matching items with their URIs for loading. ' +
            'Use category to narrow results: "instruments", "audio_effects", "midi_effects", "drums", "sounds", "packs", "plugins", "samples", "presets".',
        parameters: {
            query: { type: 'string', description: 'Search query (e.g. "reverb", "piano", "808")', required: true },
            category: {
                type: 'string',
                description: 'Category filter: instruments, audio_effects (or "fx"), midi_effects (or "midi_fx"), drums, sounds, packs, plugins (or "vst"), samples, presets',
            },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const query = String(args.query).trim();
            const category = resolveCategory(args.category);
            try {
                // Try AbletonBridge first
                const ab = await tryAbletonBridge();
                if (ab) {
                    const items = await ab.searchBrowser(query, category);
                    const header = category
                        ? `## Browser Search: "${query}" in ${category}`
                        : `## Browser Search: "${query}"`;
                    return `${header}\n\n${formatBrowserItems(items)}`;
                }
                // Fallback to KBotBridge
                const kb = await tryKBotRemote();
                if (kb) {
                    const items = await kb.searchBrowser(query);
                    return `## Browser Search: "${query}" (via KBotBridge)\n\n${formatBrowserItems(items)}`;
                }
                return formatBridgeError();
            }
            catch (err) {
                return `Browse failed: ${err.message}\n\n${formatBridgeError()}`;
            }
        },
    });
    // ─── 3. Load Preset ───────────────────────────────────────────────────
    registerTool({
        name: 'ableton_load_preset',
        description: 'Load a preset onto a device on a track. Searches available presets for the device and loads the best match. ' +
            'Use ableton_browse first to find the device URI if needed.',
        parameters: {
            track: { type: 'number', description: 'Track number (1-based)', required: true },
            device: { type: 'number', description: 'Device index on the track (0-based, first device = 0)', required: true },
            preset_name: { type: 'string', description: 'Preset name to search for (e.g. "Warm Pad", "Clean Lead")', required: true },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const t = userTrack(args.track);
            const deviceIdx = Number(args.device);
            const presetName = String(args.preset_name).trim();
            try {
                const ab = await tryAbletonBridge();
                if (!ab) {
                    return 'Preset loading requires AbletonBridge (port 9001). KBotBridge does not support preset browsing.\n\n' + formatBridgeError();
                }
                // Get the device chain to find the device URI
                const chain = await ab.getEffectChain(t);
                if (chain.length === 0) {
                    return `No devices on track ${args.track}. Load a device first with ableton_load_effect.`;
                }
                if (deviceIdx >= chain.length) {
                    return `Track ${args.track} has ${chain.length} device(s) (indices 0-${chain.length - 1}). Device index ${deviceIdx} is out of range.`;
                }
                const device = chain[deviceIdx];
                // Search for presets matching the device + preset name
                const presetItems = await ab.searchBrowser(`${device.name} ${presetName}`, 'presets');
                // Try to find a matching preset
                const exactMatch = presetItems.find((p) => p.isLoadable && p.name.toLowerCase() === presetName.toLowerCase());
                const partialMatch = presetItems.find((p) => p.isLoadable && p.name.toLowerCase().includes(presetName.toLowerCase()));
                const target = exactMatch ?? partialMatch ?? presetItems.find((p) => p.isLoadable);
                if (!target) {
                    // List available presets for the device
                    const devicePresets = await ab.searchBrowser(device.name, 'presets');
                    if (devicePresets.length > 0) {
                        const presetList = devicePresets
                            .filter((p) => p.isLoadable)
                            .slice(0, 10)
                            .map((p) => `  - ${p.name}`)
                            .join('\n');
                        return `No preset matching "${presetName}" for ${device.name}.\n\nAvailable presets:\n${presetList}`;
                    }
                    return `No presets found for "${presetName}" on ${device.name} (device ${deviceIdx}).`;
                }
                await ab.loadPreset(t, deviceIdx, target.uri);
                return `Loaded preset **${target.name}** onto **${device.name}** (track ${args.track}, device ${deviceIdx})`;
            }
            catch (err) {
                return `Failed to load preset: ${err.message}`;
            }
        },
    });
    // ─── 4. Effect Chain ──────────────────────────────────────────────────
    registerTool({
        name: 'ableton_effect_chain',
        description: 'Apply a full chain of audio effects to a track in sequence. ' +
            'Loads each effect one by one from Ableton\'s browser. ' +
            'Great for setting up standard chains like "Compressor → EQ Eight → Saturator → Reverb".',
        parameters: {
            track: { type: 'number', description: 'Track number (1-based)', required: true },
            chain: {
                type: 'array',
                description: 'Array of effect names to load in order (e.g. ["Compressor", "EQ Eight", "Saturator", "Reverb"])',
                required: true,
                items: { type: 'string' },
            },
        },
        tier: 'free',
        timeout: 60_000,
        async execute(args) {
            const t = userTrack(args.track);
            const chain = args.chain;
            if (!Array.isArray(chain) || chain.length === 0) {
                return 'Error: `chain` must be an array of effect names (e.g. ["Compressor", "EQ Eight", "Reverb"]).';
            }
            const results = [`## Effect Chain → Track ${args.track}`, ''];
            let loaded = 0;
            let failed = 0;
            try {
                // Try AbletonBridge first
                const ab = await tryAbletonBridge();
                if (ab) {
                    for (const effectName of chain) {
                        const name = String(effectName).trim();
                        try {
                            const items = await ab.searchBrowser(name, 'audio_effects');
                            const exactMatch = items.find((item) => item.isLoadable && item.name.toLowerCase() === name.toLowerCase());
                            const partialMatch = items.find((item) => item.isLoadable && item.name.toLowerCase().includes(name.toLowerCase()));
                            const target = exactMatch ?? partialMatch;
                            if (target) {
                                await ab.loadDevice(t, target.uri);
                                results.push(`- **${target.name}** loaded`);
                                loaded++;
                            }
                            else {
                                results.push(`- **${name}** — not found in browser`);
                                failed++;
                            }
                        }
                        catch (err) {
                            results.push(`- **${name}** — error: ${err.message}`);
                            failed++;
                        }
                    }
                    results.push('');
                    results.push(`**${loaded}** loaded, **${failed}** failed out of ${chain.length} effects.`);
                    return results.join('\n');
                }
                // Fallback to KBotBridge — try loading each effect
                const kb = await tryKBotRemote();
                if (kb) {
                    for (const effectName of chain) {
                        const name = String(effectName).trim();
                        try {
                            const ok = await kb.loadDevice(t, name);
                            if (ok) {
                                results.push(`- **${name}** loaded`);
                                loaded++;
                            }
                            else {
                                results.push(`- **${name}** — not found`);
                                failed++;
                            }
                        }
                        catch (err) {
                            results.push(`- **${name}** — error: ${err.message}`);
                            failed++;
                        }
                    }
                    results.push('');
                    results.push(`**${loaded}** loaded, **${failed}** failed out of ${chain.length} effects (via KBotBridge).`);
                    return results.join('\n');
                }
                return formatBridgeError();
            }
            catch (err) {
                return `Effect chain failed: ${err.message}\n\n${formatBridgeError()}`;
            }
        },
    });
}
//# sourceMappingURL=ableton-bridge-tools.js.map