"""
Productivity Swarm - Multi-Agent Management Scan
Coordinates LocalGuardian and NodeCommander.
"""

import sys
import os

# Ensure the root directory is in path
sys.path.append(os.getcwd())

from admin.engineers.productivity_engineer import ProductivityEngineer
from admin.brain.memory_store import get_memory_store

def run_swarm_report():
    print("================================================================")
    print("      STUDIO OS: MULTI-AGENT PRODUCTIVITY SWARM                 ")
    print("================================================================")
    
    coordinator = ProductivityEngineer()
    result = coordinator.execute_swarm_loop()
    
    decision = result["decision"]
    local = result["local_report"]
    node = result["node_report"]
    
    print("\n📍 LOCAL GUARDIAN REPORT")
    print(f"   Status: {local['cognitive_fatigue']}/10.0 Fatigue | CPU: {local['cpu_percent']}%")
    if local['top_memory_procs']:
        print(f"   Top Local Proc: {local['top_memory_procs'][0]['name']}")

    print("\n📍 NODE COMMANDER REPORT")
    print(f"   Status: {node['status'].upper()} | Message: {node['message']}")

    print("\n================================================================")
    print("🏛️ SWARM CONSENSUS")
    print("================================================================")
    print(f"SELECTED POLICY: {decision['type']}")
    print(f"RATIONALE:      {decision['description']}")
    print(f"EFE SCORE:      {decision['efe']:.2f} (Pragmatic: {decision['pragmatic']:.2f}, Epistemic: {decision['epistemic']:.2f})")
    
    print("\n================================================================")
    print("🧠 COLLECTIVE BRAIN (BELIEF STATES)")
    print("================================================================")
    store = get_memory_store()
    beliefs = store.get_latest_beliefs(limit=5)
    for b in beliefs:
        print(f"- {b['agent_id'].upper()}: {b['entity_id']:<20} | Conf: {b['confidence']*100:.1f}%")

if __name__ == "__main__":
    run_swarm_report()
