"""
Productivity Report - CLI Utility
Generates a full system + node + productivity health scan.
"""

import sys
import os

# Ensure the root directory is in path
sys.path.append(os.getcwd())

from admin.engineers.productivity_engineer import ProductivityEngineer
from admin.brain.memory_store import get_memory_store

def run_report():
    print("----------------------------------------------------------------")
    print("      STUDIO OS: PERSONAL PRODUCTIVITY & SYSTEM SCAN            ")
    print("----------------------------------------------------------------")
    
    engineer = ProductivityEngineer()
    decision = engineer.execute_loop()
    
    # Fetch historical belief entropy to show 'Uncertainty'
    store = get_memory_store()
    beliefs = store.get_latest_beliefs(agent_id="productivity_engineer", limit=5)
    
    print("\n----------------------------------------------------------------")
    print("🧠 AGENT INTERNAL BELIEFS (ACTIVE INFERENCE)")
    print("----------------------------------------------------------------")
    for b in beliefs:
        entity = b["entity_id"]
        conf = b["confidence"]
        entropy = b["entropy"]
        print(f"- {entity.upper():<15} | Confidence {conf*100:>5.1f}% | Entropy {entropy:.2f}")

    print("\n----------------------------------------------------------------")
    print("🎯 ACTION PRIORS (EXPECTED FREE ENERGY)")
    print("----------------------------------------------------------------")
    priors = store.get_top_priors(agent_id="productivity_engineer", limit=3)
    for p in priors:
        # p is a Dict
        print(f"- {p['action_type']:<20} | EFE: {p['expected_free_energy']:.2f} | Pragmatic: {p['pragmatic_value']:.2f} | Epistemic: {p['epistemic_value']:.2f}")

    print("\n----------------------------------------------------------------")
    print("📍 FINAL RECOMMENDATION")
    print(f"Action: {decision['type'].upper()}")
    print(f"Goal: Minimize surprise relative to user flow and system stability.")
    print("----------------------------------------------------------------")

if __name__ == "__main__":
    run_report()
