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
import { ensureAbleton, type OscArg } from './ableton-osc.js';
/**
 * Call a kbot-control method if the device is loaded. Returns undefined
 * if unavailable — caller should fall back to OSC.
 */
export declare function tryKc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T | undefined>;
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
export declare function routed<T>(kc: () => Promise<T | undefined>, osc: () => Promise<T>): Promise<T>;
export { ensureAbleton, type OscArg };
//# sourceMappingURL=ableton.d.ts.map