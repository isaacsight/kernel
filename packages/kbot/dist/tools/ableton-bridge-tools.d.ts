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
export declare function registerAbletonBridgeTools(): void;
//# sourceMappingURL=ableton-bridge-tools.d.ts.map