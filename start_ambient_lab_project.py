import sys
import os

# Ensure project root is in path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.append(project_root)

from admin.engineers.lab_coordinator import LabCoordinator
from admin.engineers.research_engineer import ResearchEngineer

def start_ambient_project():
    print("🔬 [Lab Swarm] Starting project: Ambient Agent Interaction...")
    
    coordinator = LabCoordinator()
    engineer = ResearchEngineer()
    
    # Step 1: Propose Hypothesis
    print("\n1️⃣ Proposing Hypothesis...")
    h_msg = coordinator.propose_hypothesis(
        "Ambient Agent Interaction",
        "Users prefer agents that provide subtle, context-aware cues over traditional chat-based interruptions.",
        agents=["ResearchEngineer", "LabCoordinator"]
    )
    print(h_msg)
    
    # Step 2: Prototype Feature
    print("\n2️⃣ Building Prototype: 'Shadow Agents'...")
    idea = """
    Create a 'Shadow Agent' system that doesn't use a chat box. 
    Instead, it monitors user actions (simulated) and provides 'Ambient Cues'—minimal, 
    one-sentence observations or suggestions that appear in a peripheral 'awareness' log.
    The prototype should be named 'shadow_agent_poc.py'.
    """
    
    proto_msg = engineer.prototype_feature(idea, "shadow_agent_poc")
    print(proto_msg)
    
    # Step 3: Synthesis (will happen after implementation)
    print("\nProject Initialized and Prototype drafted. Proceeding to execution.")

if __name__ == "__main__":
    start_ambient_project()
