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
import * as net from 'node:net';
// ── Client ────────────────────────────────────────────────────────────
export class AbletonBridgeClient {
    static instance = null;
    socket = null;
    connected = false;
    pending = new Map();
    nextId = 1;
    buffer = '';
    static PORT = 9001;
    static HOST = '127.0.0.1';
    static TIMEOUT = 15_000;
    static CONNECT_TIMEOUT = 5_000;
    constructor() { }
    /**
     * Get the singleton instance.
     */
    static getInstance() {
        if (!AbletonBridgeClient.instance) {
            AbletonBridgeClient.instance = new AbletonBridgeClient();
        }
        return AbletonBridgeClient.instance;
    }
    /**
     * Connect to AbletonBridge TCP server.
     * Returns true if connected and responds to a ping/handshake.
     */
    async connect() {
        if (this.connected && this.socket) {
            // Already connected — verify with a lightweight call
            try {
                await this.send('ping');
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
            this.socket.on('error', () => {
                if (!this.connected) {
                    resolve(false);
                }
                this.handleDisconnect();
            });
            this.socket.on('close', () => {
                this.handleDisconnect();
            });
            this.socket.connect(AbletonBridgeClient.PORT, AbletonBridgeClient.HOST, async () => {
                this.connected = true;
                // Verify connectivity
                try {
                    const pong = await this.send('ping');
                    resolve(!pong.error);
                }
                catch {
                    // Even if ping fails, we may still be connected to a bridge
                    // that doesn't support ping — consider it connected
                    resolve(true);
                }
            });
            // Connection timeout
            setTimeout(() => {
                if (!this.connected) {
                    this.socket?.destroy();
                    resolve(false);
                }
            }, AbletonBridgeClient.CONNECT_TIMEOUT);
        });
    }
    /**
     * Check if connected.
     */
    isConnected() {
        return this.connected;
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
        for (const [, req] of this.pending) {
            clearTimeout(req.timer);
            req.reject(new Error('Disconnected'));
        }
        this.pending.clear();
        this.buffer = '';
    }
    /**
     * Send a method call and wait for a response.
     */
    async send(method, params) {
        if (!this.connected || !this.socket) {
            throw new Error('Not connected to AbletonBridge. Is Ableton running with the AbletonBridge Remote Script?');
        }
        const id = this.nextId++;
        const cmd = { id, method };
        if (params)
            cmd.params = params;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Timeout: ${method}`));
            }, AbletonBridgeClient.TIMEOUT);
            this.pending.set(id, { resolve, reject, timer });
            const json = JSON.stringify(cmd) + '\n';
            this.socket.write(json);
        });
    }
    // ── Response handling ─────────────────────────────────────────────
    handleResponse(response) {
        if (response.id && this.pending.has(response.id)) {
            const req = this.pending.get(response.id);
            this.pending.delete(response.id);
            clearTimeout(req.timer);
            req.resolve(response);
        }
        // No event/push support for AbletonBridge — all request/response
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
    // ── Browser API ───────────────────────────────────────────────────
    /**
     * Search Ableton's browser for items matching a query.
     * Optionally filter by category: "instruments", "audio_effects", "midi_effects",
     * "drums", "sounds", "packs", "plugins", "samples", "presets".
     */
    async searchBrowser(query, category) {
        const params = { query };
        if (category)
            params.category = category;
        const resp = await this.send('search_browser', params);
        if (resp.error)
            throw new Error(resp.error);
        const items = resp.result;
        if (!Array.isArray(items))
            return [];
        return items.map((item) => ({
            name: String(item.name ?? ''),
            uri: String(item.uri ?? ''),
            isLoadable: Boolean(item.is_loadable ?? item.isLoadable ?? false),
            isDevice: Boolean(item.is_device ?? item.isDevice ?? false),
            isFolder: Boolean(item.is_folder ?? item.isFolder ?? false),
        }));
    }
    /**
     * Load a device onto a track by its browser URI.
     */
    async loadDevice(trackIndex, uri) {
        const resp = await this.send('load_device', { track: trackIndex, uri });
        if (resp.error)
            throw new Error(resp.error);
        return Boolean(resp.result);
    }
    /**
     * Search for a device by name and load the first loadable match onto a track.
     * Optionally filter by category to narrow results.
     */
    async loadDeviceByName(trackIndex, name, category) {
        const items = await this.searchBrowser(name, category);
        // Find the first loadable device
        const device = items.find((item) => item.isLoadable && item.isDevice);
        if (!device) {
            // Fallback: try any loadable item
            const loadable = items.find((item) => item.isLoadable);
            if (!loadable) {
                throw new Error(`No loadable device found for "${name}"${category ? ` in category "${category}"` : ''}`);
            }
            return this.loadDevice(trackIndex, loadable.uri);
        }
        return this.loadDevice(trackIndex, device.uri);
    }
    /**
     * List presets available for a device by its URI.
     */
    async listPresets(deviceUri) {
        const resp = await this.send('list_presets', { uri: deviceUri });
        if (resp.error)
            throw new Error(resp.error);
        const presets = resp.result;
        if (!Array.isArray(presets))
            return [];
        return presets.map((p) => ({
            name: String(p.name ?? ''),
            uri: String(p.uri ?? ''),
        }));
    }
    /**
     * Load a preset onto a device on a specific track.
     */
    async loadPreset(trackIndex, deviceIndex, presetUri) {
        const resp = await this.send('load_preset', {
            track: trackIndex,
            device: deviceIndex,
            uri: presetUri,
        });
        if (resp.error)
            throw new Error(resp.error);
        return Boolean(resp.result);
    }
    /**
     * Get the effect/device chain on a track.
     */
    async getEffectChain(trackIndex) {
        const resp = await this.send('get_device_chain', { track: trackIndex });
        if (resp.error)
            throw new Error(resp.error);
        const devices = resp.result;
        if (!Array.isArray(devices))
            return [];
        return devices.map((d, i) => ({
            name: String(d.name ?? ''),
            className: String(d.class_name ?? d.className ?? ''),
            index: typeof d.index === 'number' ? d.index : i,
        }));
    }
}
// ── KBotBridge fallback (port 9997) ────────────────────────────────────
/**
 * Lightweight TCP probe for the kbot Remote Script on port 9997.
 * Uses the same newline-delimited JSON protocol as AbletonM4L.
 */
export class KBotRemoteClient {
    static instance = null;
    socket = null;
    connected = false;
    pending = new Map();
    nextId = 1;
    buffer = '';
    static PORT = 9997;
    static HOST = '127.0.0.1';
    static TIMEOUT = 10_000;
    static CONNECT_TIMEOUT = 3_000;
    constructor() { }
    static getInstance() {
        if (!KBotRemoteClient.instance) {
            KBotRemoteClient.instance = new KBotRemoteClient();
        }
        return KBotRemoteClient.instance;
    }
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
                        // skip
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
            this.socket.connect(KBotRemoteClient.PORT, KBotRemoteClient.HOST, async () => {
                this.connected = true;
                try {
                    const pong = await this.send({ action: 'ping' });
                    resolve(Boolean(pong.ok));
                }
                catch {
                    resolve(true); // Connected but no ping support — still usable
                }
            });
            setTimeout(() => {
                if (!this.connected) {
                    this.socket?.destroy();
                    resolve(false);
                }
            }, KBotRemoteClient.CONNECT_TIMEOUT);
        });
    }
    isConnected() {
        return this.connected;
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
            throw new Error('Not connected to KBotBridge Remote Script');
        }
        const id = this.nextId++;
        const fullCmd = { id, ...cmd };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Timeout: ${cmd.action ?? 'unknown'}`));
            }, KBotRemoteClient.TIMEOUT);
            this.pending.set(id, { resolve, reject, timer });
            this.socket.write(JSON.stringify(fullCmd) + '\n');
        });
    }
    /** Load a device by name via the kbot Remote Script's search. */
    async loadDevice(trackIndex, name) {
        const resp = await this.send({ action: 'load_device', track: trackIndex, name });
        return Boolean(resp.ok);
    }
    /** Search the browser via the kbot Remote Script. */
    async searchBrowser(query) {
        const resp = await this.send({ action: 'search_browser', query });
        const items = resp.results;
        if (!Array.isArray(items))
            return [];
        return items.map((item) => ({
            name: String(item.name ?? ''),
            uri: String(item.uri ?? ''),
            isLoadable: Boolean(item.is_loadable ?? false),
            isDevice: Boolean(item.is_device ?? false),
            isFolder: Boolean(item.is_folder ?? false),
        }));
    }
    handleResponse(response) {
        const id = response.id;
        if (id && this.pending.has(id)) {
            const req = this.pending.get(id);
            this.pending.delete(id);
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
}
// ── Convenience exports ────────────────────────────────────────────────
/**
 * Try to connect to AbletonBridge (port 9001).
 * Returns the connected client or null if unavailable.
 */
export async function tryAbletonBridge() {
    const client = AbletonBridgeClient.getInstance();
    if (client.isConnected())
        return client;
    const ok = await client.connect();
    return ok ? client : null;
}
/**
 * Try to connect to KBotBridge Remote Script (port 9997).
 * Returns the connected client or null if unavailable.
 */
export async function tryKBotRemote() {
    const client = KBotRemoteClient.getInstance();
    if (client.isConnected())
        return client;
    const ok = await client.connect();
    return ok ? client : null;
}
/**
 * Get any available bridge, trying AbletonBridge first, then KBotBridge.
 * Returns { bridge, type } or null if neither is available.
 */
export async function getAvailableBridge() {
    // Try AbletonBridge first (full browser API)
    const ab = await tryAbletonBridge();
    if (ab)
        return { bridge: ab, type: 'ableton-bridge' };
    // Fallback to KBotBridge Remote Script
    const kb = await tryKBotRemote();
    if (kb)
        return { bridge: kb, type: 'kbot-remote' };
    return null;
}
/**
 * Format a helpful error message when no bridge is available.
 */
export function formatBridgeError() {
    return [
        '**No Ableton bridge connected**',
        '',
        'kbot tried two connection methods and neither is available:',
        '',
        '**Option 1 — AbletonBridge (recommended)**',
        '  Full browser API with 353 tools. Install:',
        '  1. Download from https://github.com/hidingwill/AbletonBridge',
        '  2. Copy the `AbletonBridge` folder to your Remote Scripts:',
        '     macOS: ~/Music/Ableton/User Library/Remote Scripts/',
        '     Win:   ~\\Documents\\Ableton\\User Library\\Remote Scripts\\',
        '  3. In Ableton: Preferences → Link/Tempo/MIDI → Control Surface → AbletonBridge',
        '  4. Verify: TCP server starts on localhost:9001',
        '',
        '**Option 2 — KBotBridge**',
        '  kbot\'s own Remote Script. Install:',
        '  1. Run `kbot ableton install` or copy KBotBridge to Remote Scripts',
        '  2. Enable in Ableton: Preferences → Link/Tempo/MIDI → Control Surface → KBotBridge',
        '  3. Verify: TCP server starts on localhost:9997',
        '',
        'Both require Ableton Live to be running.',
    ].join('\n');
}
//# sourceMappingURL=ableton-bridge.js.map