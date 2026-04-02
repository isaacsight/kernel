"""
tcp_server.py — Non-blocking TCP server for Ableton Live Remote Scripts

Uses socket + select (no threading) to avoid blocking Live's main thread.
Processes one complete JSON command per tick cycle.
"""

import socket
import select
import json
import logging

logger = logging.getLogger("kbot_bridge")

LISTEN_PORT = 9998
LISTEN_HOST = "127.0.0.1"
RECV_BUFFER = 65536


class TCPServer:
    """
    Non-blocking TCP server that accepts one client at a time.
    Accumulates incoming data and splits on newlines to extract
    complete JSON commands.
    """

    def __init__(self, host=LISTEN_HOST, port=LISTEN_PORT):
        self.host = host
        self.port = port
        self._server_socket = None
        self._client_socket = None
        self._client_buffer = ""
        self._command_queue = []
        self._running = False

    def start(self):
        """Bind and listen. Non-blocking."""
        try:
            self._server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._server_socket.setblocking(False)
            self._server_socket.bind((self.host, self.port))
            self._server_socket.listen(1)
            self._running = True
            logger.info("KBotBridge TCP server listening on %s:%d" % (self.host, self.port))
        except OSError as e:
            logger.error("KBotBridge: Could not bind to %s:%d — %s" % (self.host, self.port, e))
            self._server_socket = None
            raise

    def process(self):
        """
        Called once per tick from the ControlSurface.
        Accepts new connections, reads data, and queues complete commands.
        Returns a list of parsed JSON command dicts (may be empty).
        """
        commands = []

        if not self._running or not self._server_socket:
            return commands

        # Accept new connections (replace existing client)
        try:
            readable, _, _ = select.select([self._server_socket], [], [], 0)
            if readable:
                new_client, addr = self._server_socket.accept()
                new_client.setblocking(False)
                # Close previous client if any
                if self._client_socket:
                    try:
                        self._client_socket.close()
                    except Exception:
                        pass
                    self._client_buffer = ""
                self._client_socket = new_client
                logger.info("KBotBridge: Client connected from %s:%d" % addr)
        except Exception:
            pass

        # Read from client
        if self._client_socket:
            try:
                readable, _, errored = select.select([self._client_socket], [], [self._client_socket], 0)
                if errored:
                    self._disconnect_client()
                    return commands
                if readable:
                    data = self._client_socket.recv(RECV_BUFFER)
                    if not data:
                        # Client disconnected
                        self._disconnect_client()
                        return commands
                    self._client_buffer += data.decode("utf-8", errors="replace")
            except (ConnectionResetError, BrokenPipeError, OSError):
                self._disconnect_client()
                return commands

        # Parse complete lines from buffer
        while "\n" in self._client_buffer:
            line, self._client_buffer = self._client_buffer.split("\n", 1)
            line = line.strip()
            if not line:
                continue
            try:
                cmd = json.loads(line)
                if isinstance(cmd, dict):
                    commands.append(cmd)
            except json.JSONDecodeError:
                logger.warning("KBotBridge: Malformed JSON: %s" % line[:200])

        return commands

    def send_response(self, response):
        """Send a JSON response back to the connected client."""
        if not self._client_socket:
            return
        try:
            data = json.dumps(response, default=str) + "\n"
            self._client_socket.sendall(data.encode("utf-8"))
        except (ConnectionResetError, BrokenPipeError, OSError) as e:
            logger.warning("KBotBridge: Send failed — %s" % e)
            self._disconnect_client()

    def _disconnect_client(self):
        """Clean up client connection."""
        if self._client_socket:
            try:
                self._client_socket.close()
            except Exception:
                pass
            self._client_socket = None
            self._client_buffer = ""
            logger.info("KBotBridge: Client disconnected")

    def shutdown(self):
        """Stop the server and close all sockets."""
        self._running = False
        self._disconnect_client()
        if self._server_socket:
            try:
                self._server_socket.close()
            except Exception:
                pass
            self._server_socket = None
        logger.info("KBotBridge TCP server shut down")
