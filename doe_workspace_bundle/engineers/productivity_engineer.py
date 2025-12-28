"""
Productivity Engineer - Systems & Focus Optimization Agent
Uses Active Inference to balance system performance and user productivity.
"""

import logging
from admin.brain.agent_base import BaseAgent
from admin.engineers.local_guardian import LocalGuardian
from admin.engineers.node_commander import NodeCommander

logger = logging.getLogger("ProductivityEngineer")

class ProductivityEngineer(BaseAgent):
    def __init__(self):
        super().__init__(agent_id="productivity_engineer")
        self.local_guardian = LocalGuardian()
        self.node_commander = NodeCommander()
        
    def execute_swarm_loop(self):
        """
        Orchestrates the Productivity Swarm using Active Inference.
        1. Perceive: Gather reports from specialized agents.
        2. Infer: Update collective belief states.
        3. Act: Select the global policy that minimizes total Expected Free Energy.
        """
        print(f"\n--- 🏛️ {self.name} Swarm Council Convening ---")
        
        # 1. PERCEPTION (Intelligence Gathering)
        local_state = self.local_guardian.get_report()
        node_state = self.node_commander.get_report()
        
        # 2. INFERENCE (Updating Beliefs per Agent)
        self.update_beliefs("local_environment", local_state, "macOS background monitoring")
        self.update_beliefs("remote_infrastructure", node_state, "Studio Node connectivity")
        
        # 3. GLOBAL POLICY SELECTION
        # Each agent proposes actions, Coordinator finds the Pareto Optimal decision
        local_actions = self.local_guardian.propose_actions(local_state)
        node_actions = self.node_commander.propose_actions(node_state)
        
        print(f"   ↳ Local Guardian proposes: {[a['type'] for a in local_actions]}")
        print(f"   ↳ Node Commander proposes: {[a['type'] for a in node_actions]}")
        
        # Build global candidates
        combined_context = f"Local Fatigue: {local_state['cognitive_fatigue']} | Node Status: {node_state['status']}"
        
        potential_global_actions = []
        
        # Candidate 1: Local Cleanup
        if any(a['type'] == "clean_slate" for a in local_actions):
            potential_global_actions.append({
                "type": "SWARM_OPTIMIZE_LOCAL",
                "description": "Execute Clean Slate on Mac to restore responsiveness.",
                "pragmatic_value": 0.8 if local_state['cognitive_fatigue'] > 6 else 0.4,
                "epistemic_value": 0.5
            })
            
        # Candidate 2: Remote Offload
        if any(a['type'] == "ready_for_offload" for a in node_actions) and local_state['cognitive_fatigue'] > 5:
             potential_global_actions.append({
                "type": "SWARM_OFFLOAD_WORKLOAD",
                "description": "Shift local compute pressure to the healthy Desktop Node.",
                "pragmatic_value": 0.95,
                "epistemic_value": 0.6
            })
             
        # Candidate 3: Balanced Monitoring
        potential_global_actions.append({
            "type": "SWARM_MAINTAIN",
            "description": "System within boundaries. Continue high-fidelity observability.",
            "pragmatic_value": 0.9 if local_state['cognitive_fatigue'] < 4 else 0.2,
            "epistemic_value": 0.1
        })
        
        decision = self.decide(
            goal="Optimize both local focus and remote resource utilization.",
            context=combined_context,
            potential_actions=potential_global_actions
        )
        
        return {
            "decision": decision,
            "local_report": local_state,
            "node_report": node_state
        }

if __name__ == "__main__":
    coordinator = ProductivityEngineer()
    coordinator.execute_swarm_loop()
