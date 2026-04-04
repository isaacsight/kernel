/**
 * mobile-mcp-client.ts — kbot <-> mobile-mcp integration
 *
 * Singleton client that manages the mobile-mcp server process lifecycle.
 * Communicates via MCP protocol over stdio transport.
 * Auto-installs @mobilenext/mobile-mcp via npm if not present.
 *
 * mobile-mcp provides native accessibility-tree-based automation for
 * iOS and Android devices connected via USB or WiFi.
 *
 * @see https://github.com/mobile-next/mobile-mcp
 */
import { spawn, execSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
function encodeJsonRpc(msg) {
    const body = JSON.stringify(msg);
    return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}
// ── MobileMCPClient ────────────────────────────────────────────────────
export class MobileMCPClient {
    static instance = null;
    process = null;
    messageId = 0;
    pending = new Map();
    buffer = '';
    initialized = false;
    activeDeviceId = null;
    static getInstance() {
        if (!MobileMCPClient.instance) {
            MobileMCPClient.instance = new MobileMCPClient();
        }
        return MobileMCPClient.instance;
    }
    /** Whether the MCP server process is running and initialized */
    get isConnected() {
        return this.initialized && this.process !== null && !this.process.killed;
    }
    /** The device ID currently being controlled */
    get currentDeviceId() {
        return this.activeDeviceId;
    }
    // ── Process lifecycle ──────────────────────────────────────────────
    /** Start the mobile-mcp server process and perform MCP handshake */
    async start() {
        if (this.isConnected)
            return;
        // Ensure npx is available
        try {
            execSync('which npx', { stdio: 'pipe' });
        }
        catch {
            throw new Error('npx not found. Ensure Node.js >= 22 is installed.');
        }
        // Spawn the mobile-mcp server via npx (auto-installs if needed)
        this.process = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
        });
        this.buffer = '';
        this.messageId = 0;
        this.pending.clear();
        this.process.stdout?.on('data', (chunk) => {
            this.buffer += chunk.toString();
            this.parseMessages();
        });
        // Log stderr for debugging but don't crash
        this.process.stderr?.on('data', (chunk) => {
            const msg = chunk.toString().trim();
            if (msg && process.env.KBOT_DEBUG) {
                console.error(`[mobile-mcp stderr] ${msg}`);
            }
        });
        this.process.on('error', (err) => {
            this.initialized = false;
            this.process = null;
            if (process.env.KBOT_DEBUG) {
                console.error(`[mobile-mcp] Process error: ${err.message}`);
            }
        });
        this.process.on('exit', (code) => {
            this.initialized = false;
            this.process = null;
            // Reject any pending requests
            const pendingEntries = Array.from(this.pending.entries());
            for (const [id, { reject }] of pendingEntries) {
                reject(new Error(`mobile-mcp process exited with code ${code}`));
                this.pending.delete(id);
            }
        });
        // MCP initialize handshake
        try {
            await this.sendRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'kbot', version: '3.61.0' },
            });
            this.sendNotification('initialized', {});
            this.initialized = true;
        }
        catch (err) {
            this.stop();
            throw new Error(`mobile-mcp handshake failed: ${err instanceof Error ? err.message : String(err)}\n` +
                'Ensure @mobilenext/mobile-mcp is installed: npm install -g @mobilenext/mobile-mcp');
        }
    }
    /** Stop the mobile-mcp server process */
    stop() {
        if (this.process) {
            try {
                // Graceful shutdown
                this.sendNotification('exit', null);
            }
            catch { /* best effort */ }
            this.process.kill();
            this.process = null;
        }
        this.initialized = false;
        this.activeDeviceId = null;
        this.buffer = '';
        this.pending.clear();
    }
    // ── MCP protocol ───────────────────────────────────────────────────
    parseMessages() {
        while (true) {
            const headerEnd = this.buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1)
                break;
            const header = this.buffer.slice(0, headerEnd);
            const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
            if (!lengthMatch) {
                this.buffer = this.buffer.slice(headerEnd + 4);
                continue;
            }
            const contentLength = parseInt(lengthMatch[1], 10);
            const bodyStart = headerEnd + 4;
            if (this.buffer.length < bodyStart + contentLength)
                break;
            const body = this.buffer.slice(bodyStart, bodyStart + contentLength);
            this.buffer = this.buffer.slice(bodyStart + contentLength);
            try {
                const msg = JSON.parse(body);
                if (msg.id !== undefined && this.pending.has(msg.id)) {
                    const { resolve, reject } = this.pending.get(msg.id);
                    this.pending.delete(msg.id);
                    if (msg.error) {
                        reject(new Error(msg.error.message));
                    }
                    else {
                        resolve(msg.result);
                    }
                }
            }
            catch {
                // Skip malformed messages
            }
        }
    }
    sendRequest(method, params, timeout = 30_000) {
        return new Promise((resolve, reject) => {
            if (!this.process?.stdin?.writable) {
                reject(new Error('mobile-mcp process is not running. Call mobile_connect first.'));
                return;
            }
            const id = ++this.messageId;
            this.pending.set(id, { resolve, reject });
            const msg = { jsonrpc: '2.0', id, method, params };
            this.process.stdin.write(encodeJsonRpc(msg));
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`mobile-mcp request timeout after ${timeout / 1000}s: ${method}`));
                }
            }, timeout);
        });
    }
    sendNotification(method, params) {
        if (!this.process?.stdin?.writable)
            return;
        const msg = { jsonrpc: '2.0', method, params };
        this.process.stdin.write(encodeJsonRpc(msg));
    }
    /** Call a tool on the mobile-mcp server */
    async callTool(toolName, args) {
        if (!this.isConnected) {
            throw new Error('Not connected to mobile-mcp. Call mobile_connect first.');
        }
        const result = await this.sendRequest('tools/call', {
            name: toolName,
            arguments: args,
        }, 60_000);
        return result;
    }
    /** Extract text content from an MCP tool result */
    extractText(result) {
        const r = result;
        if (r?.content) {
            return r.content
                .filter(c => c.type === 'text' && c.text)
                .map(c => c.text)
                .join('\n');
        }
        return JSON.stringify(result, null, 2);
    }
    /** Extract image content (base64) from an MCP tool result */
    extractImage(result) {
        const r = result;
        if (r?.content) {
            const img = r.content.find(c => c.type === 'image' && c.data);
            if (img)
                return { data: img.data, mimeType: img.mimeType || 'image/png' };
        }
        return null;
    }
    // ── High-level device operations ───────────────────────────────────
    /** List all available devices */
    async listDevices() {
        const result = await this.callTool('mobile_list_available_devices', {});
        const text = this.extractText(result);
        try {
            return JSON.parse(text);
        }
        catch {
            // Try to parse from structured output
            return [];
        }
    }
    /** Set the active device for subsequent operations */
    setActiveDevice(deviceId) {
        this.activeDeviceId = deviceId;
    }
    /** Get the active device ID, throwing if none set */
    requireDevice(deviceId) {
        const id = deviceId || this.activeDeviceId;
        if (!id) {
            throw new Error('No device selected. Use mobile_connect to connect to a device, or pass a device ID.');
        }
        return id;
    }
    /** List apps on the active device */
    async listApps(deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_list_apps', { device });
        return this.extractText(result);
    }
    /** Launch an app by bundle ID */
    async launchApp(packageName, deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_launch_app', { device, packageName });
        return this.extractText(result);
    }
    /** Take a screenshot, returns base64 image data */
    async takeScreenshot(deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_take_screenshot', { device });
        const img = this.extractImage(result);
        if (img)
            return img;
        return this.extractText(result);
    }
    /** Save screenshot to a file */
    async saveScreenshot(saveTo, deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_save_screenshot', { device, saveTo });
        return this.extractText(result);
    }
    /** List UI elements on screen via accessibility tree */
    async listElements(deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_list_elements_on_screen', { device });
        return this.extractText(result);
    }
    /** Tap at coordinates */
    async tap(x, y, deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_click_on_screen_at_coordinates', { device, x, y });
        return this.extractText(result);
    }
    /** Swipe on screen */
    async swipe(direction, opts) {
        const device = this.requireDevice(opts?.deviceId);
        const args = { device, direction };
        if (opts?.x !== undefined)
            args.x = opts.x;
        if (opts?.y !== undefined)
            args.y = opts.y;
        if (opts?.distance !== undefined)
            args.distance = opts.distance;
        const result = await this.callTool('mobile_swipe_on_screen', args);
        return this.extractText(result);
    }
    /** Type text */
    async typeText(text, submit = false, deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_type_keys', { device, text, submit });
        return this.extractText(result);
    }
    /** Press a device button */
    async pressButton(button, deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_press_button', { device, button });
        return this.extractText(result);
    }
    /** Get screen size */
    async getScreenSize(deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_get_screen_size', { device });
        return this.extractText(result);
    }
    /** Open a URL in the device browser */
    async openUrl(url, deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_open_url', { device, url });
        return this.extractText(result);
    }
    /** Get device orientation */
    async getOrientation(deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_get_orientation', { device });
        return this.extractText(result);
    }
    /** Terminate an app */
    async terminateApp(packageName, deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_terminate_app', { device, packageName });
        return this.extractText(result);
    }
    /** Double tap at coordinates */
    async doubleTap(x, y, deviceId) {
        const device = this.requireDevice(deviceId);
        const result = await this.callTool('mobile_double_tap_on_screen', { device, x, y });
        return this.extractText(result);
    }
    /** Long press at coordinates */
    async longPress(x, y, duration, deviceId) {
        const device = this.requireDevice(deviceId);
        const args = { device, x, y };
        if (duration !== undefined)
            args.duration = duration;
        const result = await this.callTool('mobile_long_press_on_screen_at_coordinates', args);
        return this.extractText(result);
    }
}
//# sourceMappingURL=mobile-mcp-client.js.map