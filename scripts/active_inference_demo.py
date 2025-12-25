"""
Active Inference Demo - Studio OS
Demonstrates the new mathematical autonomy layer.
"""

import sys
import os
import json
import logging

# Ensure we can import from the root
sys.path.append(os.getcwd())

from admin.engineers.alchemist import Alchemist

# Enable logging
logging.basicConfig(level=logging.INFO)

def main():
    print("=== Studio OS: Active Inference Demo ===")
    
    # 1. Initialize the fortified Alchemist
    alchemist = Alchemist()
    
    # 2. Define a complex goal
    goal = "Increase user engagement on the 'Does This Feel Right?' blog."
    context = "Engagement is currently low. We have 5 draft posts and a TikTok workflow available."
    
    # 3. Define potential policies (sets of actions)
    policies = [
        {
            "type": "exploit_content",
            "description": "Publish existing draft posts immediately.",
            "goal_alignment": 0.9, # High pragmatic value
            "information_gain": 0.1 # Low epistemic value (we know what happens)
        },
        {
            "type": "explore_new_medium",
            "description": "Experiment with the TikTok workflow and viral hooks.",
            "goal_alignment": 0.6, # Medium pragmatic (riskier)
            "information_gain": 0.9 # High epistemic value (we learn about a new channel)
        },
        {
            "type": "analyze_audience",
            "description": "Run a deep analysis on existing comment sentiment.",
            "goal_alignment": 0.4, # Low immediate pragmatic
            "information_gain": 1.0 # Maximum epistemic value (pure information gathering)
        }
    ]
    
    # 4. Agent Deliberation (Active Inference Loop)
    print(f"\n[Goal] {goal}")
    print(f"[Context] {context}\n")
    
    print("Alchemist is now calculating Expected Free Energy (G) for each policy...")
    
    # The 'decide' method uses the new ActiveInferenceMixin logic
    best_policy = alchemist.decide(goal, context, policies)
    
    print("\n=== SYSTEM DECISION ===")
    print(f"Policy Selected: {best_policy.get('type').upper()}")
    print(f"Reason: {best_policy.get('description')}")
    print(f"EFE Score: {best_policy.get('efe', 0):.2f}")
    print(f"Pragmatic (Surprise): {best_policy.get('pragmatic', 0):.2f}")
    print(f"Epistemic (Uncertainty): {best_policy.get('epistemic', 0):.2f}")
    
    # 5. Verify Memory Persistence
    print("\nVerifying memory persistence...")
    beliefs = alchemist.memory_store.get_latest_beliefs(alchemist.agent_id, "current_task")
    if beliefs:
        print(f"Latest Belief State: {beliefs[0]['belief_data']['latent_state_estimate']}")
    
    print("\n=== DEMO COMPLETE ===")

if __name__ == "__main__":
    main()
