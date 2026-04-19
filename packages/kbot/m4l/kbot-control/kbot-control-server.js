// kbot-control-server.js — Node-for-Max TCP server.
//
// Runs in the [node.script kbot-control-server.js] object inside
// kbot-control.amxd. Opens a TCP server on 127.0.0.1:9000, accepts
// newline-delimited JSON-RPC 2.0 messages from the kbot CLI, forwards
// them to the Max [js kbot-control.js] dispatcher, relays responses back.
//
// Zero npm dependencies — uses only node:net (ships with Node for Max).
// Broadcasts listener notifications to every connected socket.
//
// Protocol:
//   kbot       -->  {"jsonrpc":"2.0","id":1,"method":"song.tempo"}\n  -->  this
//   this       -->  Max.outlet("request", json)                       -->  [js]
//   [js]       -->  Max.addHandler("response", json)                  -->  this
//   this       -->  {"jsonrpc":"2.0","id":1,"result":120}\n            -->  kbot
//   [js]       -->  Max.addHandler("notify", json)                    -->  this
//   this       -->  broadcast to every connected socket                -->  kbot*

const Max = require("max-api");
const net = require("net");

const PORT = 9000;
const HOST = "127.0.0.1";

// id → socket (for routing responses back to the right caller)
const pendingById = new Map();
// socket → partial line buffer (for framing)
const socketBuffer = new Map();
// all connected sockets (for broadcast)
const sockets = new Set();

const server = net.createServer((socket) => {
  sockets.add(socket);
  socketBuffer.set(socket, "");
  Max.post(`[kbot-control] client connected (${sockets.size} total)`);

  // Greet the client
  socket.write(JSON.stringify({ jsonrpc: "2.0", method: "hello", params: { version: "0.1.0" } }) + "\n");

  socket.on("data", (chunk) => {
    const merged = socketBuffer.get(socket) + chunk.toString();
    const lines = merged.split("\n");
    socketBuffer.set(socket, lines.pop() || "");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id != null) pendingById.set(msg.id, socket);
        Max.outlet("request", trimmed);
      } catch (e) {
        socket.write(JSON.stringify({
          jsonrpc: "2.0", id: null,
          error: { code: -32700, message: "Parse error: " + e.message }
        }) + "\n");
      }
    }
  });

  socket.on("close", () => {
    sockets.delete(socket);
    socketBuffer.delete(socket);
    Max.post(`[kbot-control] client disconnected (${sockets.size} remaining)`);
  });

  socket.on("error", (e) => {
    Max.post(`[kbot-control] socket error: ${e.message}`);
    sockets.delete(socket);
    socketBuffer.delete(socket);
  });
});

// Responses from the LOM dispatcher
Max.addHandler("response", (...args) => {
  const raw = args.length === 1 ? String(args[0]) : args.join(" ");
  try {
    const msg = JSON.parse(raw);
    const socket = pendingById.get(msg.id);
    if (socket && !socket.destroyed) socket.write(raw + "\n");
    pendingById.delete(msg.id);
  } catch (e) {
    Max.post(`[kbot-control] bad response (${args.length} args): ${e.message} raw=${raw.slice(0,80)}\n`);
  }
});

// Catch-all diagnostic: log any message that doesn't match another handler
Max.addHandler("bang", () => Max.post("[kbot-control] bang received\n"));

// Listener events — broadcast to every connected socket
let notifyBroadcastCount = 0;
Max.addHandler("notify", (...args) => {
  notifyBroadcastCount++;
  // Max may split the JSON into multiple atoms if it contains special chars.
  // Join everything back and try to parse.
  const raw = args.length === 1 ? String(args[0]) : args.join(" ");
  Max.post(`[kbot-control] notify handler got ${args.length} args, reconstructed: ${raw.slice(0, 120)} → ${sockets.size} clients\n`);
  for (const socket of sockets) {
    if (!socket.destroyed) socket.write(raw + "\n");
  }
});

server.on("listening", () => {
  Max.post(`[kbot-control] TCP listening on ${HOST}:${PORT}`);
});

server.on("error", (e) => {
  Max.post(`[kbot-control] server error: ${e.message}`);
});

server.listen(PORT, HOST);
