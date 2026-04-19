/**
 * kbot-control-client — TCP client for kbot-control.amxd
 *
 * Singleton client that connects to the kbot-control Max for Live device
 * at 127.0.0.1:9000. Newline-delimited JSON-RPC 2.0 over plain TCP.
 * Zero npm dependencies — uses node:net only.
 */
import * as net from 'node:net';
export class KbotControlClient {
    static instance = null;
    socket = null;
    connected = false;
    buffer = '';
    pending = new Map();
    listeners = new Map();
    nextId = 1;
    connectAttempt = null;
    static HOST = '127.0.0.1';
    static PORT = 9000;
    static TIMEOUT = 15_000;
    static CONNECT_TIMEOUT = 3_000;
    constructor() { }
    static get() {
        if (!this.instance)
            this.instance = new KbotControlClient();
        return this.instance;
    }
    /** Test-only: tear down singleton so tests can start fresh. */
    static _resetForTests() {
        if (this.instance) {
            try {
                this.instance.disconnect();
            }
            catch { /* ignore */ }
        }
        this.instance = null;
    }
    async connect() {
        if (this.connected)
            return;
        if (this.connectAttempt)
            return this.connectAttempt;
        this.connectAttempt = new Promise((resolve, reject) => {
            const sock = new net.Socket();
            const timer = setTimeout(() => {
                sock.destroy();
                reject(new Error(`kbot-control: connect timeout (${KbotControlClient.CONNECT_TIMEOUT}ms)`));
            }, KbotControlClient.CONNECT_TIMEOUT);
            sock.connect(KbotControlClient.PORT, KbotControlClient.HOST, () => {
                clearTimeout(timer);
                this.socket = sock;
                this.connected = true;
                resolve();
            });
            sock.on('data', (chunk) => this.handleData(chunk.toString()));
            sock.on('close', () => {
                this.connected = false;
                this.socket = null;
                for (const [, p] of this.pending) {
                    clearTimeout(p.timer);
                    p.reject(new Error('kbot-control: connection closed'));
                }
                this.pending.clear();
            });
            sock.on('error', (e) => {
                clearTimeout(timer);
                this.connected = false;
                reject(new Error(`kbot-control: ${e.message} — is kbot-control.amxd loaded in Ableton on a track?`));
            });
        });
        try {
            await this.connectAttempt;
        }
        finally {
            this.connectAttempt = null;
        }
    }
    handleData(chunk) {
        this.buffer += chunk;
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            this.handleMessage(trimmed);
        }
    }
    handleMessage(raw) {
        let msg;
        try {
            msg = JSON.parse(raw);
        }
        catch {
            return;
        }
        // Notifications (listener events) — no id
        if ('method' in msg && msg.method === 'notify') {
            const { path, value } = msg.params || {};
            if (path) {
                const set = this.listeners.get(path);
                if (set)
                    for (const fn of set)
                        fn(value);
            }
            return;
        }
        // Server hello greeting
        if ('method' in msg && msg.method === 'hello')
            return;
        const response = msg;
        if (response.id == null)
            return;
        const p = this.pending.get(response.id);
        if (!p)
            return;
        this.pending.delete(response.id);
        clearTimeout(p.timer);
        if (response.error)
            p.reject(new Error(`[${response.error.code}] ${response.error.message}`));
        else
            p.resolve(response.result);
    }
    async call(method, params) {
        await this.connect();
        if (!this.socket)
            throw new Error('kbot-control: not connected');
        const id = this.nextId++;
        const req = { jsonrpc: '2.0', id, method, params };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`kbot-control: timeout on ${method} (${KbotControlClient.TIMEOUT}ms)`));
            }, KbotControlClient.TIMEOUT);
            this.pending.set(id, {
                resolve: (r) => resolve(r),
                reject,
                timer,
            });
            this.socket.write(JSON.stringify(req) + '\n');
        });
    }
    async subscribe(path, fn) {
        let set = this.listeners.get(path);
        if (!set) {
            set = new Set();
            this.listeners.set(path, set);
            await this.call('listen.subscribe', { path });
            this.startPolling(path);
        }
        set.add(fn);
    }
    async unsubscribe(path, fn) {
        const set = this.listeners.get(path);
        if (!set)
            return;
        set.delete(fn);
        if (set.size === 0) {
            this.listeners.delete(path);
            this.stopPolling(path);
            try {
                await this.call('listen.unsubscribe', { path });
            }
            catch { /* ignore */ }
        }
    }
    pollers = new Map();
    startPolling(path, intervalMs = 150) {
        if (this.pollers.has(path))
            return;
        const state = { timer: null, since: 0 };
        state.timer = setInterval(async () => {
            try {
                const r = await this.call('listen.poll', { path, since: state.since });
                if (r && r.events && r.events.length > 0) {
                    state.since = r.latest_seq;
                    const set = this.listeners.get(path);
                    if (set) {
                        for (const ev of r.events) {
                            // LiveAPI often reports values as [propertyName, value]; unwrap.
                            let v = ev.value;
                            if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string')
                                v = v[1];
                            for (const fn of set)
                                fn(v);
                        }
                    }
                }
                else if (r && typeof r.latest_seq === 'number') {
                    state.since = r.latest_seq;
                }
            }
            catch { /* ignore transient errors */ }
        }, intervalMs);
        this.pollers.set(path, state);
    }
    stopPolling(path) {
        const s = this.pollers.get(path);
        if (s) {
            clearInterval(s.timer);
            this.pollers.delete(path);
        }
    }
    disconnect() {
        for (const [, s] of this.pollers)
            clearInterval(s.timer);
        this.pollers.clear();
        if (this.socket)
            this.socket.destroy();
        this.socket = null;
        this.connected = false;
    }
    get isConnected() { return this.connected; }
}
/**
 * Convenience: connect + call + return result.
 * Throws if kbot-control.amxd isn't loaded in Ableton.
 */
export async function kc(method, params) {
    return KbotControlClient.get().call(method, params);
}
//# sourceMappingURL=client.js.map