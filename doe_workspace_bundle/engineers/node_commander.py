"""
Node Commander - Remote Infrastructure Agent
"""

import logging
from admin.brain.agent_base import BaseAgent
from admin.infrastructure.data_center import DataCenter
from admin.config import config

logger = logging.getLogger("NodeCommander")

class NodeCommander(BaseAgent):
    def __init__(self):
        super().__init__(agent_id="node_commander")
        self.dc = DataCenter(config)
        
    def get_report(self) -> dict:
        """Returns the current state of the Studio Node."""
        return self.dc.check_node_health("studio_node")

    def propose_actions(self, observation: dict) -> list:
        """Suggests node-related actions."""
        actions = []
        is_online = observation.get('status') == "online"
        
        if is_online:
            actions.append({
                "type": "ready_for_offload",
                "description": "Desktop Node is healthy and ready for high-compute jobs.",
                "pragmatic_value": 0.9,
                "epistemic_value": 0.2
            })
        else:
            actions.append({
                "type": "node_offline_remediation",
                "description": "Alert user that the Desktop Node is unreachable.",
                "pragmatic_value": 1.0, # High priority if it's supposed to be up
                "epistemic_value": 0.8 # Learning why it's down
            })
            
        actions.append({
            "type": "node_idle",
            "description": "Maintain node connection state",
            "pragmatic_value": 0.5,
            "epistemic_value": 0.1
        })
        return actions
