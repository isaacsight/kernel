/**
 * ableton-m4l.ts — kbot ↔ Max for Live Bridge Client
 *
 * Connects to the kbot-bridge M4L device via TCP on localhost:9999.
 * Sends JSON commands, receives JSON responses.
 * Replaces ableton-osc.ts for M4L-based Ableton control.
 *
 * Protocol:
 *   Send:    {"id": 1, "action": "ping"}\n
 *   Receive: {"id": 1, "ok": true, "version": "1.0.0"}\n
 *
 * Advantages over OSC:
 *   - Full LOM access (41 classes, every property/method)
 *   - Proper boolean values (no T/F encoding issues)
 *   - No UDP packet size limits
 *   - Request/response correlation via IDs
 *   - Direct drum pad sample loading
 *   - Plugin preset browsing
 */
export interface M4LCommand {
    id: number;
    action: string;
    [key: string]: unknown;
}
export interface M4LResponse {
    id: number;
    ok: boolean;
    error?: string;
    [key: string]: unknown;
}
export type M4LEventHandler = (event: M4LResponse) => void;
export declare class AbletonM4L {
    private static instance;
    private socket;
    private connected;
    private pending;
    private nextId;
    private buffer;
    private eventHandlers;
    private reconnectTimer;
    static PORT: number;
    static HOST: string;
    static TIMEOUT: number;
    static RECONNECT_DELAY: number;
    private constructor();
    /**
     * Get the singleton instance.
     */
    static getInstance(): AbletonM4L;
    /**
     * Connect to the M4L bridge device.
     * Returns true if connected and the bridge responds to ping.
     */
    connect(): Promise<boolean>;
    /**
     * Disconnect from the bridge.
     */
    disconnect(): void;
    /**
     * Send a command and wait for a response.
     */
    send(cmd: Omit<M4LCommand, 'id'> & {
        action: string;
    }): Promise<M4LResponse>;
    /**
     * Send a command without waiting for a response (fire-and-forget).
     * Still sends with an ID but doesn't track the response.
     */
    fire(cmd: Omit<M4LCommand, 'id'> & {
        action: string;
    }): void;
    /**
     * Register an event handler for push notifications from the bridge.
     */
    onEvent(handler: M4LEventHandler): () => void;
    /**
     * Check if connected.
     */
    get isConnected(): boolean;
    private handleResponse;
    private handleDisconnect;
    ping(): Promise<boolean>;
    setTempo(bpm: number): Promise<M4LResponse>;
    createMidiTrack(index?: number): Promise<M4LResponse>;
    deleteTrack(track: number): Promise<M4LResponse>;
    loadPlugin(track: number, name: string, manufacturer?: string): Promise<M4LResponse>;
    loadSampleToPad(track: number, pad: number, path: string): Promise<M4LResponse>;
    createClip(track: number, slot: number, length: number, name?: string): Promise<M4LResponse>;
    addNotes(track: number, slot: number, notes: Array<[number, number, number, number]>): Promise<M4LResponse>;
    fireClip(track: number, slot: number): Promise<M4LResponse>;
    setVolume(track: number, volume: number): Promise<M4LResponse>;
    setSend(track: number, sendIdx: number, level: number): Promise<M4LResponse>;
    getTrackInfo(track: number): Promise<M4LResponse>;
    getDeviceParams(track: number, device: number): Promise<M4LResponse>;
    setParam(track: number, device: number, param: string, value: number): Promise<M4LResponse>;
    getSessionInfo(): Promise<M4LResponse>;
    startPlaying(): Promise<M4LResponse>;
    stopPlaying(): Promise<M4LResponse>;
    setClipTriggerQuantization(value: number): Promise<M4LResponse>;
    setTrackName(track: number, name: string): Promise<M4LResponse>;
    setTrackColor(track: number, color: number): Promise<M4LResponse>;
    muteTrack(track: number, mute: boolean): Promise<M4LResponse>;
    armTrack(track: number, arm: boolean): Promise<M4LResponse>;
    getNotes(track: number, slot: number): Promise<M4LResponse>;
    removeNotes(track: number, slot: number): Promise<M4LResponse>;
    getDrumPads(track: number): Promise<M4LResponse>;
    browseAndLoad(track: number, category: string, search: string): Promise<M4LResponse>;
    /** Generic LOM getter — access any property at any path */
    lomGet(path: string, property: string): Promise<M4LResponse>;
    /** Generic LOM setter — set any property at any path */
    lomSet(path: string, property: string, value: unknown): Promise<M4LResponse>;
    /** Generic LOM method call — call any method at any path */
    lomCall(path: string, method: string, args?: unknown[]): Promise<M4LResponse>;
}
export interface BrowserSearchResult {
    name: string;
    uri: string;
    is_loadable: boolean;
    is_device: boolean;
}
export interface BrowserCategory {
    name: string;
    display_name: string;
    child_count: number;
}
/**
 * Client for the KBotBridge Remote Script (TCP 9997).
 *
 * This is separate from the M4L bridge (9999) because the Browser API
 * (browser.load_item) is ONLY available from Python Remote Scripts,
 * not from Max for Live.
 *
 * Use this to programmatically load any native device (Saturator,
 * EQ Eight, Compressor, etc.) onto any track.
 */
export declare class AbletonBrowserBridge {
    private static instance;
    private socket;
    private connected;
    private pending;
    private nextId;
    private buffer;
    static PORT: number;
    static HOST: string;
    static TIMEOUT: number;
    private constructor();
    static getInstance(): AbletonBrowserBridge;
    /**
     * Connect to the KBotBridge Remote Script on port 9997.
     * Returns true if connected and the bridge responds to ping.
     */
    connect(): Promise<boolean>;
    disconnect(): void;
    send(cmd: Omit<M4LCommand, 'id'> & {
        action: string;
    }): Promise<M4LResponse>;
    get isConnected(): boolean;
    private handleResponse;
    private handleDisconnect;
    ping(): Promise<boolean>;
    /**
     * Search Ableton's browser for items matching a query.
     * @param query - Search string (case-insensitive)
     * @param category - instruments/audio_effects/midi_effects/drums/samples/all
     */
    browserSearch(query: string, category?: string): Promise<BrowserSearchResult[]>;
    /**
     * Load a browser item by URI onto a track.
     * Use the URI from a browserSearch() result.
     */
    browserLoad(track: number, uri: string): Promise<M4LResponse>;
    /**
     * Search + load in one step. Finds first loadable match and loads it.
     * @param track - 0-indexed track number
     * @param name - Device name to search for (e.g., "Saturator", "EQ Eight")
     * @param category - instruments/audio_effects/midi_effects/drums/samples/all
     */
    browserLoadByName(track: number, name: string, category?: string): Promise<M4LResponse>;
    /**
     * List top-level browser categories with child counts.
     */
    browserCategories(): Promise<BrowserCategory[]>;
    /**
     * List all tracks with names and device counts.
     */
    listTracks(): Promise<M4LResponse>;
    /**
     * List devices on a track with full parameter details.
     */
    listDevices(track: number): Promise<M4LResponse>;
}
/**
 * Get a connected M4L bridge instance.
 * Throws if the bridge is not available.
 */
export declare function ensureM4L(): Promise<AbletonM4L>;
/**
 * Get a connected Browser bridge instance (KBotBridge Remote Script on port 9997).
 * Throws if not available.
 */
export declare function ensureBrowserBridge(): Promise<AbletonBrowserBridge>;
/**
 * Connect to both M4L bridge (9999) and Browser bridge (9997).
 * Returns whichever connections succeed. At least one must connect.
 */
export declare function connectBrowser(): Promise<{
    m4l: AbletonM4L | null;
    browser: AbletonBrowserBridge | null;
}>;
/**
 * Format a friendly error message for M4L connection failures.
 */
export declare function formatM4LError(): string;
/**
 * Format a friendly error message for Browser bridge connection failures.
 */
export declare function formatBrowserBridgeError(): string;
//# sourceMappingURL=ableton-m4l.d.ts.map