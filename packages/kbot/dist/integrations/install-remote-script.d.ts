/**
 * install-remote-script.ts — Install KBotBridge Remote Script into Ableton Live
 *
 * Copies the KBotBridge Python Remote Script to Ableton's User Library,
 * enabling the Browser API bridge on TCP port 9997.
 *
 * The Remote Script exposes Ableton's browser.load_item() API, which is
 * ONLY available from Python Remote Scripts (not from Max for Live).
 * This lets kbot programmatically load any native device (Saturator,
 * EQ Eight, Compressor, etc.) onto any track.
 *
 * Usage:
 *   npx tsx packages/kbot/src/integrations/install-remote-script.ts
 *   kbot ableton install-bridge
 */
export declare function installKBotBridge(): Promise<string>;
export declare function isKBotBridgeInstalled(): boolean;
export declare function uninstallKBotBridge(): string;
/**
 * Get the path to the KBotBridge log file inside Ableton's Remote Scripts.
 */
export declare function getKBotBridgeLogPath(): string | null;
//# sourceMappingURL=install-remote-script.d.ts.map