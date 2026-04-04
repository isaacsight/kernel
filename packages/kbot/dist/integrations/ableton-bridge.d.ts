/**
 * ableton-bridge.ts — kbot ↔ AbletonBridge TCP Client
 *
 * Connects to AbletonBridge (https://github.com/hidingwill/AbletonBridge),
 * a 353-tool Remote Script that exposes Ableton's full Browser API
 * via a TCP server on localhost:9001.
 *
 * Protocol:
 *   Send:    {"id": 1, "method": "search_browser", "params": {...}}\n
 *   Receive: {"id": 1, "result": {...}}\n
 *
 * Fallback chain (used by tools):
 *   1. AbletonBridge (port 9001) — full browser API
 *   2. KBotBridge (port 9997) — kbot's own Remote Script
 *   3. Error with install instructions
 *
 * Follows the same singleton + newline-delimited JSON pattern as AbletonM4L.
 */
export interface BrowserItem {
    name: string;
    uri: string;
    isLoadable: boolean;
    isDevice: boolean;
    isFolder: boolean;
}
export interface Preset {
    name: string;
    uri: string;
}
export interface Device {
    name: string;
    className: string;
    index: number;
}
export interface BridgeCommand {
    id: number;
    method: string;
    params?: Record<string, unknown>;
}
export interface BridgeResponse {
    id: number;
    result?: unknown;
    error?: string;
}
export declare class AbletonBridgeClient {
    private static instance;
    private socket;
    private connected;
    private pending;
    private nextId;
    private buffer;
    static PORT: number;
    static HOST: string;
    static TIMEOUT: number;
    static CONNECT_TIMEOUT: number;
    private constructor();
    /**
     * Get the singleton instance.
     */
    static getInstance(): AbletonBridgeClient;
    /**
     * Connect to AbletonBridge TCP server.
     * Returns true if connected and responds to a ping/handshake.
     */
    connect(): Promise<boolean>;
    /**
     * Check if connected.
     */
    isConnected(): boolean;
    /**
     * Disconnect from the bridge.
     */
    disconnect(): void;
    /**
     * Send a method call and wait for a response.
     */
    send(method: string, params?: Record<string, unknown>): Promise<BridgeResponse>;
    private handleResponse;
    private handleDisconnect;
    /**
     * Search Ableton's browser for items matching a query.
     * Optionally filter by category: "instruments", "audio_effects", "midi_effects",
     * "drums", "sounds", "packs", "plugins", "samples", "presets".
     */
    searchBrowser(query: string, category?: string): Promise<BrowserItem[]>;
    /**
     * Load a device onto a track by its browser URI.
     */
    loadDevice(trackIndex: number, uri: string): Promise<boolean>;
    /**
     * Search for a device by name and load the first loadable match onto a track.
     * Optionally filter by category to narrow results.
     */
    loadDeviceByName(trackIndex: number, name: string, category?: string): Promise<boolean>;
    /**
     * List presets available for a device by its URI.
     */
    listPresets(deviceUri: string): Promise<Preset[]>;
    /**
     * Load a preset onto a device on a specific track.
     */
    loadPreset(trackIndex: number, deviceIndex: number, presetUri: string): Promise<boolean>;
    /**
     * Get the effect/device chain on a track.
     */
    getEffectChain(trackIndex: number): Promise<Device[]>;
}
/**
 * Lightweight TCP probe for the kbot Remote Script on port 9997.
 * Uses the same newline-delimited JSON protocol as AbletonM4L.
 */
export declare class KBotRemoteClient {
    private static instance;
    private socket;
    private connected;
    private pending;
    private nextId;
    private buffer;
    static PORT: number;
    static HOST: string;
    static TIMEOUT: number;
    static CONNECT_TIMEOUT: number;
    private constructor();
    static getInstance(): KBotRemoteClient;
    connect(): Promise<boolean>;
    isConnected(): boolean;
    disconnect(): void;
    send(cmd: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** Load a device by name via the kbot Remote Script's search. */
    loadDevice(trackIndex: number, name: string): Promise<boolean>;
    /** Search the browser via the kbot Remote Script. */
    searchBrowser(query: string): Promise<BrowserItem[]>;
    private handleResponse;
    private handleDisconnect;
}
/**
 * Try to connect to AbletonBridge (port 9001).
 * Returns the connected client or null if unavailable.
 */
export declare function tryAbletonBridge(): Promise<AbletonBridgeClient | null>;
/**
 * Try to connect to KBotBridge Remote Script (port 9997).
 * Returns the connected client or null if unavailable.
 */
export declare function tryKBotRemote(): Promise<KBotRemoteClient | null>;
/**
 * Get any available bridge, trying AbletonBridge first, then KBotBridge.
 * Returns { bridge, type } or null if neither is available.
 */
export declare function getAvailableBridge(): Promise<{
    bridge: AbletonBridgeClient | KBotRemoteClient;
    type: 'ableton-bridge' | 'kbot-remote';
} | null>;
/**
 * Format a helpful error message when no bridge is available.
 */
export declare function formatBridgeError(): string;
//# sourceMappingURL=ableton-bridge.d.ts.map