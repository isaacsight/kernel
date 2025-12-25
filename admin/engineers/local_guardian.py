"""
Local Guardian - Local macOS Performance Agent
"""

import logging
from admin.brain.agent_base import BaseAgent
from admin.engineers.system_monitor import Systemmonitor

logger = logging.getLogger("LocalGuardian")

class LocalGuardian(BaseAgent):
    def __init__(self):
        super().__init__(agent_id="local_guardian")
        self.monitor = Systemmonitor()
        
    def get_report(self) -> dict:
        """Returns the current state of the local machine."""
        return self.monitor.execute()

    def propose_actions(self, observation: dict) -> list:
        """Suggests local-only actions."""
        actions = []
        if observation['cognitive_fatigue'] > 6.0:
            actions.append({
                "type": "clean_slate",
                "description": "Clear caches and unload non-essential background agents",
                "pragmatic_value": 0.8,
                "epistemic_value": 0.3
            })
        
        actions.append({
            "type": "local_idle",
            "description": "Maintain current local state",
            "pragmatic_value": 0.9 if observation['cognitive_fatigue'] < 4 else 0.2,
            "epistemic_value": 0.1
        })
        return actions
