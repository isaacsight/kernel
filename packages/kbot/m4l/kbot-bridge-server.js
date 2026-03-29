/**
 * kbot-bridge-server.js — Node for Max TCP server
 *
 * Runs inside a [node.script] object in a Max for Live device.
 * Opens a TCP server on 127.0.0.1:9999 that accepts newline-delimited
 * JSON commands from kbot, forwards them to the M4L patch (which has
 * LiveAPI access), and relays responses back over the socket.
 *
 * Protocol:
 *   kbot  -->  { "id": 1, "action": "ping" }\n    -->  this server
 *   this server  -->  Max.outlet('command', json)  -->  M4L patch
 *   M4L patch    -->  Max.addHandler('response')   -->  this server
 *   this server  -->  { "id": 1, "ok": true }\n    -->  kbot
 */

const Max = require("max-api");
const net = require("net");

const PORT = 9999;
const HOST = "127.0.0.1";

// Track active sockets so we can route responses back
let activeSockets = new Map(); // id -> socket
let socketBuffer = new Map(); // socket -> partial data buffer

const server = net.createServer((socket) => {
  Max.post("kbot: client connected from " + socket.remoteAddress);
  socketBuffer.set(socket, "");

  socket.on("data", (raw) => {
    // Accumulate data — commands are newline-delimited
    let buffer = socketBuffer.get(socket) + raw.toString();
    let lines = buffer.split("\n");

    // Last element is either empty (complete line) or partial (incomplete)
    socketBuffer.set(socket, lines.pop());

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const cmd = JSON.parse(trimmed);
        if (cmd.id != null) {
          activeSockets.set(cmd.id, socket);
        }
        // Forward to the M4L patch for LiveAPI execution
        Max.outlet("command", trimmed);
      } catch (err) {
        const errResp = JSON.stringify({
          id: null,
          ok: false,
          error: "invalid_json",
          detail: err.message,
        });
        socket.write(errResp + "\n");
      }
    }
  });

  socket.on("close", () => {
    Max.post("kbot: client disconnected");
    socketBuffer.delete(socket);
    // Clean up any pending requests for this socket
    for (const [id, s] of activeSockets) {
      if (s === socket) activeSockets.delete(id);
    }
  });

  socket.on("error", (err) => {
    Max.post("kbot: socket error — " + err.message);
    socketBuffer.delete(socket);
  });
});

// Receive responses from the M4L patch (routed through [js kbot-bridge.js])
Max.addHandler("response", (json) => {
  try {
    const resp = JSON.parse(json);
    const id = resp.id;
    const socket = activeSockets.get(id);
    if (socket && !socket.destroyed) {
      socket.write(json + "\n");
      activeSockets.delete(id);
    } else {
      Max.post("kbot: no socket for response id=" + id);
    }
  } catch (err) {
    Max.post("kbot: response parse error — " + err.message);
  }
});

// Broadcast a response to ALL connected sockets (for push notifications)
Max.addHandler("broadcast", (json) => {
  for (const [, socket] of activeSockets) {
    if (!socket.destroyed) {
      socket.write(json + "\n");
    }
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    Max.post("kbot: port " + PORT + " in use — retrying in 2s...");
    setTimeout(() => {
      server.close();
      server.listen(PORT, HOST);
    }, 2000);
  } else {
    Max.post("kbot: server error — " + err.message);
  }
});

server.listen(PORT, HOST, () => {
  Max.post("kbot bridge server running on " + HOST + ":" + PORT);
  Max.outlet("status", "ready");
});

// Graceful shutdown
Max.addHandler("shutdown", () => {
  Max.post("kbot: shutting down server...");
  for (const [, socket] of activeSockets) {
    if (!socket.destroyed) socket.destroy();
  }
  server.close(() => {
    Max.post("kbot: server closed");
  });
});
