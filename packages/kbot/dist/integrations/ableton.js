/**
 * ableton.ts — unified Ableton client helper.
 *
 * Single entry point for all kbot Ableton tools. Tries kbot-control.amxd
 * (TCP:9000) first; falls back to AbletonOSC (UDP:11000) if the device
 * isn't loaded. Over time, as kbot-control's dispatcher covers the full
 * OSC surface, the OSC fallback goes away.
 *
 * Tool code should import from here, not from kbot-control-client.ts
 * or ableton-osc.ts directly.
 */
import { KbotControlClient } from './kbot-control-client.js';
import { ensureAbleton } from './ableton-osc.js';
let kbotControlAvailable = null;
let lastProbeAt = 0;
const PROBE_CACHE_MS = 5_000;
async function probeKbotControl() {
    const now = Date.now();
    if (kbotControlAvailable !== null && now - lastProbeAt < PROBE_CACHE_MS) {
        return kbotControlAvailable;
    }
    try {
        await KbotControlClient.get().connect();
        kbotControlAvailable = KbotControlClient.get().isConnected;
    }
    catch {
        kbotControlAvailable = false;
    }
    lastProbeAt = now;
    return kbotControlAvailable;
}
/**
 * Call a kbot-control method if the device is loaded. Returns undefined
 * if unavailable — caller should fall back to OSC.
 */
export async function tryKc(method, params) {
    if (!(await probeKbotControl()))
        return undefined;
    try {
        return await KbotControlClient.get().call(method, params);
    }
    catch {
        // Method might not be implemented yet in the dispatcher;
        // let the caller fall through to OSC.
        return undefined;
    }
}
/**
 * Route an OSC operation through kbot-control if possible, else AbletonOSC.
 * The two functions are called with the same args — whichever resolves wins.
 *
 * Use when you have parallel implementations. Example:
 *   await routed(
 *     () => tryKc('song.tempo', { value: 120 }),
 *     async () => { (await ensureAbleton()).send('/live/song/set/tempo', 120); return 120 },
 *   )
 */
export async function routed(kc, osc) {
    const v = await kc();
    if (v !== undefined)
        return v;
    return osc();
}
// Re-export the legacy OSC escape hatch for tools that haven't migrated yet.
export { ensureAbleton };
//# sourceMappingURL=ableton.js.map