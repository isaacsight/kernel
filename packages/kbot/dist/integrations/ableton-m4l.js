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
import * as net from 'node:net';
// ── Client ────────────────────────────────────────────────────────────
export class AbletonM4L {
    static instance = null;
    socket = null;
    connected = false;
    pending = new Map();
    nextId = 1;
    buffer = '';
    eventHandlers = new Set();
    reconnectTimer = null;
    static PORT = 9999;
    static HOST = '127.0.0.1';
    static TIMEOUT = 10_000;
    static RECONNECT_DELAY = 3000;
    constructor() { }
    /**
     * Get the singleton instance.
     */
    static getInstance() {
        if (!AbletonM4L.instance) {
            AbletonM4L.instance = new AbletonM4L();
        }
        return AbletonM4L.instance;
    }
    /**
     * Connect to the M4L bridge device.
     * Returns true if connected and the bridge responds to ping.
     */
    async connect() {
        if (this.connected && this.socket) {
            // Already connected — verify with ping
            try {
                await this.send({ action: 'ping' });
                return true;
            }
            catch {
                // Connection stale, reconnect
                this.disconnect();
            }
        }
        return new Promise((resolve) => {
            this.socket = new net.Socket();
            this.buffer = '';
            this.socket.on('data', (data) => {
                this.buffer += data.toString();
                const lines = this.buffer.split('\n');
                this.buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    try {
                        const response = JSON.parse(trimmed);
                        this.handleResponse(response);
                    }
                    catch {
                        // Malformed JSON — skip
                    }
                }
            });
            this.socket.on('error', (err) => {
                if (!this.connected) {
                    resolve(false);
                }
                this.handleDisconnect();
            });
            this.socket.on('close', () => {
                this.handleDisconnect();
            });
            this.socket.connect(AbletonM4L.PORT, AbletonM4L.HOST, async () => {
                this.connected = true;
                // Verify with ping
                try {
                    const pong = await this.send({ action: 'ping' });
                    if (pong.ok) {
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    }
                }
                catch {
                    resolve(false);
                }
            });
            // Connection timeout
            setTimeout(() => {
                if (!this.connected) {
                    this.socket?.destroy();
                    resolve(false);
                }
            }, 5000);
        });
    }
    /**
     * Disconnect from the bridge.
     */
    disconnect() {
        this.connected = false;
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        // Reject all pending requests
        for (const [id, req] of this.pending) {
            clearTimeout(req.timer);
            req.reject(new Error('Disconnected'));
        }
        this.pending.clear();
        this.buffer = '';
    }
    /**
     * Send a command and wait for a response.
     */
    async send(cmd) {
        if (!this.connected || !this.socket) {
            throw new Error('Not connected to M4L bridge. Is the kbot-bridge device loaded in Ableton?');
        }
        const id = this.nextId++;
        const fullCmd = { id, ...cmd };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Timeout: ${cmd.action}`));
            }, AbletonM4L.TIMEOUT);
            this.pending.set(id, { resolve, reject, timer });
            const json = JSON.stringify(fullCmd) + '\n';
            this.socket.write(json);
        });
    }
    /**
     * Send a command without waiting for a response (fire-and-forget).
     * Still sends with an ID but doesn't track the response.
     */
    fire(cmd) {
        if (!this.connected || !this.socket)
            return;
        const id = this.nextId++;
        const fullCmd = { id, ...cmd };
        this.socket.write(JSON.stringify(fullCmd) + '\n');
    }
    /**
     * Register an event handler for push notifications from the bridge.
     */
    onEvent(handler) {
        this.eventHandlers.add(handler);
        return () => this.eventHandlers.delete(handler);
    }
    /**
     * Check if connected.
     */
    get isConnected() {
        return this.connected;
    }
    // ── Response handling ─────────────────────────────────────────────
    handleResponse(response) {
        if (response.id && this.pending.has(response.id)) {
            const req = this.pending.get(response.id);
            this.pending.delete(response.id);
            clearTimeout(req.timer);
            req.resolve(response);
        }
        else {
            // No pending request — this is a push event (observer notification)
            for (const handler of this.eventHandlers) {
                try {
                    handler(response);
                }
                catch { /* skip */ }
            }
        }
    }
    handleDisconnect() {
        if (!this.connected)
            return;
        this.connected = false;
        this.socket = null;
        // Reject pending
        for (const [, req] of this.pending) {
            clearTimeout(req.timer);
            req.reject(new Error('Connection lost'));
        }
        this.pending.clear();
    }
    // ── Convenience methods ───────────────────────────────────────────
    // These wrap common commands for ergonomic use in kbot tools.
    async ping() {
        try {
            const r = await this.send({ action: 'ping' });
            return r.ok;
        }
        catch {
            return false;
        }
    }
    async setTempo(bpm) {
        return this.send({ action: 'set_tempo', bpm });
    }
    async createMidiTrack(index) {
        return this.send({ action: 'create_midi_track', index });
    }
    async deleteTrack(track) {
        return this.send({ action: 'delete_track', track });
    }
    async loadPlugin(track, name, manufacturer) {
        return this.send({ action: 'load_plugin', track, name, manufacturer: manufacturer || '' });
    }
    async loadSampleToPad(track, pad, path) {
        return this.send({ action: 'load_sample_to_pad', track, pad, path });
    }
    async createClip(track, slot, length, name) {
        return this.send({ action: 'create_clip', track, slot, length, name });
    }
    async addNotes(track, slot, notes) {
        return this.send({ action: 'add_notes', track, slot, notes });
    }
    async fireClip(track, slot) {
        return this.send({ action: 'fire_clip', track, slot });
    }
    async setVolume(track, volume) {
        return this.send({ action: 'set_volume', track, volume });
    }
    async setSend(track, sendIdx, level) {
        return this.send({ action: 'set_send', track, send: sendIdx, level });
    }
    async getTrackInfo(track) {
        return this.send({ action: 'get_track_info', track });
    }
    async getDeviceParams(track, device) {
        return this.send({ action: 'get_device_params', track, device });
    }
    async setParam(track, device, param, value) {
        return this.send({ action: 'set_param', track, device, param, value });
    }
    async getSessionInfo() {
        return this.send({ action: 'get_session_info' });
    }
    async startPlaying() {
        return this.send({ action: 'start_playing' });
    }
    async stopPlaying() {
        return this.send({ action: 'stop_playing' });
    }
    async setClipTriggerQuantization(value) {
        return this.send({ action: 'set_clip_trigger_quantization', value });
    }
    async setTrackName(track, name) {
        return this.send({ action: 'set_track_name', track, name });
    }
    async setTrackColor(track, color) {
        return this.send({ action: 'set_track_color', track, color });
    }
    async muteTrack(track, mute) {
        return this.send({ action: 'mute_track', track, mute });
    }
    async armTrack(track, arm) {
        return this.send({ action: 'arm_track', track, arm });
    }
    async getNotes(track, slot) {
        return this.send({ action: 'get_notes', track, slot });
    }
    async removeNotes(track, slot) {
        return this.send({ action: 'remove_notes', track, slot });
    }
    async getDrumPads(track) {
        return this.send({ action: 'get_drum_pads', track });
    }
    async browseAndLoad(track, category, search) {
        return this.send({ action: 'browse_and_load', track, category, search });
    }
    /** Generic LOM getter — access any property at any path */
    async lomGet(path, property) {
        return this.send({ action: 'lom_get', path, property });
    }
    /** Generic LOM setter — set any property at any path */
    async lomSet(path, property, value) {
        return this.send({ action: 'lom_set', path, property, value });
    }
    /** Generic LOM method call — call any method at any path */
    async lomCall(path, method, args) {
        return this.send({ action: 'lom_call', path, method, args });
    }
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
export class AbletonBrowserBridge {
    static instance = null;
    socket = null;
    connected = false;
    pending = new Map();
    nextId = 1;
    buffer = '';
    static PORT = 9997;
    static HOST = '127.0.0.1';
    static TIMEOUT = 15_000; // Browser operations can be slow
    constructor() { }
    static getInstance() {
        if (!AbletonBrowserBridge.instance) {
            AbletonBrowserBridge.instance = new AbletonBrowserBridge();
        }
        return AbletonBrowserBridge.instance;
    }
    /**
     * Connect to the KBotBridge Remote Script on port 9997.
     * Returns true if connected and the bridge responds to ping.
     */
    async connect() {
        if (this.connected && this.socket) {
            try {
                await this.send({ action: 'ping' });
                return true;
            }
            catch {
                this.disconnect();
            }
        }
        return new Promise((resolve) => {
            this.socket = new net.Socket();
            this.buffer = '';
            this.socket.on('data', (data) => {
                this.buffer += data.toString();
                const lines = this.buffer.split('\n');
                this.buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    try {
                        const response = JSON.parse(trimmed);
                        this.handleResponse(response);
                    }
                    catch {
                        // Malformed JSON — skip
                    }
                }
            });
            this.socket.on('error', () => {
                if (!this.connected)
                    resolve(false);
                this.handleDisconnect();
            });
            this.socket.on('close', () => {
                this.handleDisconnect();
            });
            this.socket.connect(AbletonBrowserBridge.PORT, AbletonBrowserBridge.HOST, async () => {
                this.connected = true;
                try {
                    const pong = await this.send({ action: 'ping' });
                    resolve(pong.ok);
                }
                catch {
                    resolve(false);
                }
            });
            setTimeout(() => {
                if (!this.connected) {
                    this.socket?.destroy();
                    resolve(false);
                }
            }, 5000);
        });
    }
    disconnect() {
        this.connected = false;
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        for (const [, req] of this.pending) {
            clearTimeout(req.timer);
            req.reject(new Error('Disconnected'));
        }
        this.pending.clear();
        this.buffer = '';
    }
    async send(cmd) {
        if (!this.connected || !this.socket) {
            throw new Error('Not connected to KBotBridge Remote Script.\n' +
                'Make sure KBotBridge is selected as a Control Surface in Ableton Preferences.');
        }
        const id = this.nextId++;
        const fullCmd = { id, ...cmd };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Timeout: ${cmd.action}`));
            }, AbletonBrowserBridge.TIMEOUT);
            this.pending.set(id, { resolve, reject, timer });
            this.socket.write(JSON.stringify(fullCmd) + '\n');
        });
    }
    get isConnected() {
        return this.connected;
    }
    handleResponse(response) {
        if (response.id && this.pending.has(response.id)) {
            const req = this.pending.get(response.id);
            this.pending.delete(response.id);
            clearTimeout(req.timer);
            req.resolve(response);
        }
    }
    handleDisconnect() {
        if (!this.connected)
            return;
        this.connected = false;
        this.socket = null;
        for (const [, req] of this.pending) {
            clearTimeout(req.timer);
            req.reject(new Error('Connection lost'));
        }
        this.pending.clear();
    }
    // ── Browser convenience methods ─────────────────────────────────
    async ping() {
        try {
            const r = await this.send({ action: 'ping' });
            return r.ok;
        }
        catch {
            return false;
        }
    }
    /**
     * Search Ableton's browser for items matching a query.
     * @param query - Search string (case-insensitive)
     * @param category - instruments/audio_effects/midi_effects/drums/samples/all
     */
    async browserSearch(query, category = 'all') {
        const r = await this.send({ action: 'browser_search', query, category });
        if (!r.ok)
            throw new Error(r.error || 'Browser search failed');
        return r.results || [];
    }
    /**
     * Load a browser item by URI onto a track.
     * Use the URI from a browserSearch() result.
     */
    async browserLoad(track, uri) {
        return this.send({ action: 'browser_load', track, uri });
    }
    /**
     * Search + load in one step. Finds first loadable match and loads it.
     * @param track - 0-indexed track number
     * @param name - Device name to search for (e.g., "Saturator", "EQ Eight")
     * @param category - instruments/audio_effects/midi_effects/drums/samples/all
     */
    async browserLoadByName(track, name, category = 'all') {
        return this.send({ action: 'browser_load_by_name', track, name, category });
    }
    /**
     * List top-level browser categories with child counts.
     */
    async browserCategories() {
        const r = await this.send({ action: 'browser_categories' });
        if (!r.ok)
            throw new Error(r.error || 'Failed to list categories');
        return r.categories || [];
    }
    /**
     * List all tracks with names and device counts.
     */
    async listTracks() {
        return this.send({ action: 'list_tracks' });
    }
    /**
     * List devices on a track with full parameter details.
     */
    async listDevices(track) {
        return this.send({ action: 'list_devices', track });
    }
}
// ── Convenience exports ─────────────────────────────────────────────
/**
 * Get a connected M4L bridge instance.
 * Throws if the bridge is not available.
 */
export async function ensureM4L() {
    const m4l = AbletonM4L.getInstance();
    if (m4l.isConnected)
        return m4l;
    const ok = await m4l.connect();
    if (!ok) {
        throw new Error('Cannot connect to kbot M4L bridge.\n\n' +
            'Make sure:\n' +
            '1. Ableton Live is running\n' +
            '2. The kbot-bridge.amxd device is loaded on any track\n' +
            '3. The device shows "kbot bridge running on port 9999"\n');
    }
    return m4l;
}
/**
 * Get a connected Browser bridge instance (KBotBridge Remote Script on port 9997).
 * Throws if not available.
 */
export async function ensureBrowserBridge() {
    const bridge = AbletonBrowserBridge.getInstance();
    if (bridge.isConnected)
        return bridge;
    const ok = await bridge.connect();
    if (!ok) {
        throw new Error('Cannot connect to KBotBridge Remote Script.\n\n' +
            'Make sure:\n' +
            '1. Ableton Live is running\n' +
            '2. KBotBridge is selected as a Control Surface in Preferences > Link, Tempo & MIDI\n' +
            '3. Ableton status bar shows "KBotBridge: Listening on port 9997"\n\n' +
            'To install: kbot ableton install-bridge\n');
    }
    return bridge;
}
/**
 * Connect to both M4L bridge (9999) and Browser bridge (9997).
 * Returns whichever connections succeed. At least one must connect.
 */
export async function connectBrowser() {
    const m4l = AbletonM4L.getInstance();
    const browser = AbletonBrowserBridge.getInstance();
    const [m4lOk, browserOk] = await Promise.all([
        m4l.connect().catch(() => false),
        browser.connect().catch(() => false),
    ]);
    return {
        m4l: m4lOk ? m4l : null,
        browser: browserOk ? browser : null,
    };
}
/**
 * Format a friendly error message for M4L connection failures.
 */
export function formatM4LError() {
    return [
        '**M4L Bridge not connected**',
        '',
        'To use kbot with Ableton:',
        '1. Open Ableton Live',
        '2. Drag **kbot-bridge.amxd** onto any track',
        '3. The device status should show "Connected"',
        '',
        'The M4L bridge gives kbot full control over Ableton — instruments, effects, clips, mixing, everything.',
    ].join('\n');
}
/**
 * Format a friendly error message for Browser bridge connection failures.
 */
export function formatBrowserBridgeError() {
    return [
        '**KBotBridge Remote Script not connected**',
        '',
        'The Browser API (for loading native devices) requires the KBotBridge Remote Script:',
        '1. Install: `kbot ableton install-bridge`',
        '2. Open Ableton Live Preferences (Cmd+,)',
        '3. Go to Link, Tempo & MIDI',
        '4. Set a Control Surface to "KBotBridge"',
        '5. Close Preferences',
        '',
        'This runs alongside the M4L bridge — they use different ports:',
        '- KBotBridge: TCP 9997 (Browser API, device loading)',
        '- M4L Bridge: TCP 9999 (LOM access, clips, mixing)',
    ].join('\n');
}
//# sourceMappingURL=ableton-m4l.js.map