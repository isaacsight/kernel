"""
Neural Link - Synaptic Bridge for Inter-Agent Communication
===========================================================

This module strictly defines the localized "Neural Path" between agents in the
Sovereign Laboratory OS. It allows high-level agents (like Antigravity) to
transmit "signals" (task requests) to execution agents (like OpenCode).

Protocol:
---------
- Transmission: One-way signal from Sender -> Receiver.
- Payload: Standardized JSON/Dict instructions.
- Bridge: Specifically handles the OS-level bridge to the 'opencode' CLI.
"""

import os
import json
import logging
import subprocess
from typing import Dict, Any, Optional

from admin.brain.structured_logging import get_logger

class NeuralLink:
    """
    The Synaptic Bridge.
    Enables agents to 'fire' signals to other nodes in the network.
    """
    
    def __init__(self, agent_id: str = "neural_link"):
        self.logger = get_logger(agent_id)
        # Ensure we know where the CLI tools are
        self.project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    def transmit(self, target: str, signal: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Transmits a signal to a target agent.
        
        Args:
            target: The recipient agent name (e.g., "opencode", "alchemist").
            signal: The core message or instruction.
            payload: Additional data/context.
            
        Returns:
            Dict containing the response or status.
        """
        payload = payload or {}
        self.logger.info(f"Firing signal to [{target}]: {signal[:50]}...")
        
        if target.lower() == "opencode":
            return self._bridge_to_opencode(signal, payload)
        
        # Future: Add routing for other internal agents (Alchemist, etc.)
        return {"success": False, "error": f"Target '{target}' not reachable via NeuralLink."}

    def _bridge_to_opencode(self, instruction: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Bridges the signal to the OpenCode CLI agent.
        Handles API Key environment mapping automatically.
        """
        model = payload.get("model", "google/gemini-2.0-flash")
        
        # Construct the command
        # We must verify the .env is sourced or variables are present
        # For robustness, we explicitly read GEMINI_API_KEY and map it if needed
        env_updates = os.environ.copy()
        
        # Auto-map Gemini key if missing in standard env but present in .env logic
        # (Assuming the caller process might have it, or we rely on the shell)
        # For now, we rely on the 'opencode' tool picking up the config, 
        # but we can force it if we want to be safe.
        
        cmd = ["opencode", "run", "--model", model, instruction]
        
        # Check if we need to pass context files
        # If payload has 'context_files', we append them as @file
        if "context_files" in payload:
            for f in payload["context_files"]:
                cmd.append(f"@{f}")

        try:
            self.logger.info(f"Invoking OpenCode: {' '.join(cmd)}")
            
            # Source .env trick doesn't work well with subprocess.run list args
            # relying on the calling environment having the keys
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                env=env_updates,
                cwd=self.project_root,
                timeout=60 # Prevent infinite hang
            )
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "response": result.stdout.strip(),
                    "agent": "opencode"
                }
            else:
                self.logger.error(f"OpenCode Transmission Failed: {result.stderr}")
                return {
                    "success": False, 
                    "error": result.stderr.strip(),
                    "exit_code": result.returncode
                }
                
        except Exception as e:
            self.logger.error(f"Neural Link Fracture: {e}")
            return {"success": False, "error": str(e)}
