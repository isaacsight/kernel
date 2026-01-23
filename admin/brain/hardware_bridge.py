"""
Hardware Bridge - The Software-to-Silicon Layer
Sovereign Laboratory OS - Hardware Integration

This module acts as the translator between the Antigravity agentic swarm
and physical peripherals (Consoles, Mirrors, Nodes).
"""

import json
import socket
import hmac
import hashlib
import os
from typing import Dict, Any, Optional
from admin.brain.structured_logging import get_logger
from admin.config import config

logger = get_logger("HardwareBridge")

class HardwareBridge:
    def __init__(self, broadcast_ip: str = "127.0.0.1", port: int = 9999):
        self.broadcast_ip = broadcast_ip
        self.port = port
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Use a secret key for signing signals. Fallback for local dev.
        self.secret_key = os.getenv("HARDWARE_SIGNAL_SECRET", "antigravity-dev-key").encode()
        logger.info(f"Hardware Bridge initialized on {broadcast_ip}:{port} (Signing: Enabled)")

    def signal_agent_state(self, agent_id: str, state: str, extra: Dict[str, Any] = None):
        """
        Broadcasts agent state changes to the Cognitive Console.
        """
        payload = {
            "type": "agent_state_update",
            "agent_id": agent_id,
            "state": state,
            "metadata": extra or {},
            "timestamp": "..." # Real timestamp would be here
        }
        self._broadcast(payload)

    def alert_socratic_repair(self, agent_id: str, error: str):
        """
        Triggers haptic feedback on the Console for errors.
        """
        payload = {
            "type": "haptic_alert",
            "intensity": "high",
            "pattern": "double_pulse",
            "message": f"Socratic Debug triggered: {error}"
        }
        self._broadcast(payload)

    def export_to_mirror(self, residue_path: str):
        """
        Notifies the Residue Mirror of a new artifact.
        """
        payload = {
            "type": "new_residue",
            "path": residue_path
        }
        self._broadcast(payload)

    def _broadcast(self, payload: Dict[str, Any]):
        try:
            message_body = json.dumps(payload)
            # Generate HMAC-SHA256 signature
            signature = hmac.new(self.secret_key, message_body.encode(), hashlib.sha256).hexdigest()
            
            signed_payload = {
                "body": message_body,
                "signature": signature
            }
            
            message = json.dumps(signed_payload).encode('utf-8')
            self.sock.sendto(message, (self.broadcast_ip, self.port))
            logger.debug(f"Broadcasted signed signal: {payload['type']}")
        except Exception as e:
            logger.warning(f"Hardware broadcast failed: {e}")

# Singleton Instance
_bridge = None
def get_hardware_bridge() -> HardwareBridge:
    global _bridge
    if _bridge is None:
        _bridge = HardwareBridge()
    return _bridge
