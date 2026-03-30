/**
 * kbot-bridge.js -- Node for Max WebSocket server
 *
 * Runs inside Ableton Live via the node.script Max object.
 * Starts a WebSocket server on localhost:9999 that accepts JSON commands
 * from kbot, routes them to the LOM handler (kbot-bridge-lom.js running
 * in a Max js object), and returns JSON responses.
 *
 * This replaces AbletonOSC + kbot_bridge.py entirely.
 *
 * Protocol:
 *   Request:  { id, action, params }
 *   Response: { id, status, result | error }
 *   Event:    { event, data }
 */

const maxApi = require("max-api");
const WebSocket = require("ws");

// ── Configuration ──────────────────────────────────────────────────────────

const PORT = 9999;
const HEARTBEAT_INTERVAL = 10000; // 10s keepalive
const REQUEST_TIMEOUT = 30000;    // 30s timeout for LOM operations

// ── State ──────────────────────────────────────────────────────────────────

let wss = null;
let clients = new Set();
let pendingRequests = new Map();  // id -> { ws, timer, resolve }
let subscriptions = new Map();    // event_name -> Set<ws>
let requestCounter = 0;

// ── WebSocket Server ───────────────────────────────────────────────────────

function startServer() {
    wss = new WebSocket.Server({ port: PORT, host: "127.0.0.1" });

    wss.on("listening", () => {
        maxApi.post(`kbot bridge: listening on ws://127.0.0.1:${PORT}`);
        maxApi.outlet("status", "listening", PORT);
    });

    wss.on("connection", (ws, req) => {
        clients.add(ws);
        maxApi.post(`kbot bridge: client connected (${clients.size} total)`);
        maxApi.outlet("status", "connected", clients.size);

        // Send welcome message
        ws.send(JSON.stringify({
            event: "welcome",
            data: {
                bridge: "kbot-bridge",
                version: "1.0.0",
                port: PORT,
                capabilities: [
                    "transport", "tracks", "clips", "midi", "devices",
                    "drum_rack", "automation", "scenes", "mix", "returns",
                    "groove", "session", "stems", "arrangement", "presets",
                    "melody_gen", "auto_mixer"
                ]
            }
        }));

        // Heartbeat
        ws.isAlive = true;
        ws.on("pong", () => { ws.isAlive = true; });

        ws.on("message", (data) => {
            handleMessage(ws, data);
        });

        ws.on("close", () => {
            clients.delete(ws);
            // Remove from all subscriptions
            for (const [event, subs] of subscriptions) {
                subs.delete(ws);
                if (subs.size === 0) {
                    subscriptions.delete(event);
                    maxApi.outlet("unsubscribe", event);
                }
            }
            maxApi.post(`kbot bridge: client disconnected (${clients.size} remaining)`);
            maxApi.outlet("status", "disconnected", clients.size);
        });

        ws.on("error", (err) => {
            maxApi.post(`kbot bridge: WebSocket error: ${err.message}`);
        });
    });

    wss.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            maxApi.post(`kbot bridge: port ${PORT} in use -- retrying in 2s`);
            setTimeout(() => {
                wss.close();
                startServer();
            }, 2000);
        } else {
            maxApi.post(`kbot bridge: server error: ${err.message}`);
        }
    });

    // Heartbeat interval
    setInterval(() => {
        if (!wss) return;
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                maxApi.post("kbot bridge: client timed out, terminating");
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, HEARTBEAT_INTERVAL);
}

// ── Message Handling ───────────────────────────────────────────────────────

function handleMessage(ws, rawData) {
    let msg;
    try {
        msg = JSON.parse(rawData.toString());
    } catch (e) {
        ws.send(JSON.stringify({
            id: null,
            status: "error",
            error: { code: "PARSE_ERROR", message: "Invalid JSON" }
        }));
        return;
    }

    const { id, action, params } = msg;

    if (!id || !action) {
        ws.send(JSON.stringify({
            id: id || null,
            status: "error",
            error: { code: "INVALID_REQUEST", message: "Missing 'id' or 'action'" }
        }));
        return;
    }

    // Handle subscription actions locally
    if (action === "subscribe") {
        handleSubscribe(ws, id, params);
        return;
    }
    if (action === "unsubscribe") {
        handleUnsubscribe(ws, id, params);
        return;
    }
    if (action === "ping") {
        ws.send(JSON.stringify({ id, status: "ok", result: { pong: true, time: Date.now() } }));
        return;
    }
    if (action === "batch") {
        handleBatch(ws, id, params);
        return;
    }

    // Route to LOM handler
    routeToLOM(ws, id, action, params || {});
}

function handleSubscribe(ws, id, params) {
    const events = params && params.events ? params.events : [];
    for (const event of events) {
        if (!subscriptions.has(event)) {
            subscriptions.set(event, new Set());
            // Tell Max JS to set up a live.observer for this event
            maxApi.outlet("subscribe", event);
        }
        subscriptions.get(event).add(ws);
    }
    ws.send(JSON.stringify({
        id,
        status: "ok",
        result: { subscribed: events }
    }));
}

function handleUnsubscribe(ws, id, params) {
    const events = params && params.events ? params.events : [];
    for (const event of events) {
        if (subscriptions.has(event)) {
            subscriptions.get(event).delete(ws);
            if (subscriptions.get(event).size === 0) {
                subscriptions.delete(event);
                maxApi.outlet("unsubscribe", event);
            }
        }
    }
    ws.send(JSON.stringify({
        id,
        status: "ok",
        result: { unsubscribed: events }
    }));
}

async function handleBatch(ws, id, params) {
    const commands = params && params.commands ? params.commands : [];
    const results = [];

    for (const cmd of commands) {
        try {
            const result = await routeToLOMAsync(cmd.action, cmd.params || {});
            results.push({ action: cmd.action, status: "ok", result });
        } catch (err) {
            results.push({ action: cmd.action, status: "error", error: err });
        }
    }

    ws.send(JSON.stringify({ id, status: "ok", result: { batch: results } }));
}

// ── LOM Routing ────────────────────────────────────────────────────────────

/**
 * Route a command to the Max JS LOM handler.
 * Sends a message out of node.script's outlet, which is wired to the js object.
 * The js object processes the command and sends the result back via an inlet.
 */
function routeToLOM(ws, id, action, params) {
    // Store pending request for response correlation
    const timer = setTimeout(() => {
        if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            ws.send(JSON.stringify({
                id,
                status: "error",
                error: { code: "TIMEOUT", message: `LOM operation '${action}' timed out after ${REQUEST_TIMEOUT}ms` }
            }));
        }
    }, REQUEST_TIMEOUT);

    pendingRequests.set(id, { ws, timer });

    // Send to Max js object via outlet
    // Format: "lom_command <id> <action> <params_json>"
    maxApi.outlet("lom_command", id, action, JSON.stringify(params));
}

function routeToLOMAsync(action, params) {
    return new Promise((resolve, reject) => {
        const id = `_batch_${++requestCounter}`;
        const timer = setTimeout(() => {
            pendingRequests.delete(id);
            reject({ code: "TIMEOUT", message: `LOM operation '${action}' timed out` });
        }, REQUEST_TIMEOUT);

        pendingRequests.set(id, {
            ws: null,
            timer,
            resolve,
            reject
        });

        maxApi.outlet("lom_command", id, action, JSON.stringify(params));
    });
}

// ── Receive LOM Results ────────────────────────────────────────────────────

/**
 * Called by Max when the js object sends a result back.
 * Message format: "lom_result <id> <status> <result_json>"
 */
maxApi.addHandler("lom_result", (id, status, resultJson) => {
    const pending = pendingRequests.get(id);
    if (!pending) {
        maxApi.post(`kbot bridge: received result for unknown request: ${id}`);
        return;
    }

    pendingRequests.delete(id);
    clearTimeout(pending.timer);

    let result;
    try {
        result = JSON.parse(resultJson);
    } catch (e) {
        result = resultJson;
    }

    if (pending.ws) {
        // Normal request -- send response to WebSocket client
        if (status === "ok") {
            pending.ws.send(JSON.stringify({ id, status: "ok", result }));
        } else {
            pending.ws.send(JSON.stringify({ id, status: "error", error: result }));
        }
    } else if (pending.resolve) {
        // Batch request -- resolve promise
        if (status === "ok") {
            pending.resolve(result);
        } else {
            pending.reject(result);
        }
    }
});

/**
 * Called by Max when a subscribed event fires.
 * Message format: "lom_event <event_name> <data_json>"
 */
maxApi.addHandler("lom_event", (eventName, dataJson) => {
    const subs = subscriptions.get(eventName);
    if (!subs || subs.size === 0) return;

    let data;
    try {
        data = JSON.parse(dataJson);
    } catch (e) {
        data = dataJson;
    }

    const msg = JSON.stringify({ event: eventName, data });
    for (const ws of subs) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
        }
    }
});

// ── Lifecycle ──────────────────────────────────────────────────────────────

maxApi.addHandler("shutdown", () => {
    maxApi.post("kbot bridge: shutting down");
    if (wss) {
        for (const ws of clients) {
            ws.close(1001, "Bridge shutting down");
        }
        wss.close();
        wss = null;
    }
});

// Auto-start when script loads
startServer();
maxApi.post("kbot bridge: Node for Max script loaded");
