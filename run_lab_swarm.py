import sys
import os

# Ensure project root is in path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.append(project_root)

from admin.engineers.lab_coordinator import LabCoordinator
from admin.engineers.research_engineer import ResearchEngineer

def run_lab_swarm():
    print("🔬 [Lab Swarm] Initiating Research Cycle...")
    
    coordinator = LabCoordinator()
    engineer = ResearchEngineer()
    
    # Step 1: Coordinator proposes a hypothesis
    print("\n1️⃣ Coordinator proposing hypothesis...")
    h_msg = coordinator.propose_hypothesis(
        "Agentic Observability Layer", 
        "A system that records agent thoughts to improve reliability.",
        agents=["ResearchEngineer", "LabCoordinator"]
    )
    print(h_msg)
    
    # Step 2: Engineer drafts RFC
    print("\n2️⃣ Research Engineer drafting RFC...")
    rfc_path = engineer.draft_rfc("Agentic Observability Protocol", "Recording prompt IO for every tool call.")
    print(rfc_path)
    
    # Step 3: Coordinator reviews ledger
    print("\n3️⃣ Coordinator reviewing updated ledger...")
    print(coordinator.review_ledger())
    
    # Step 4: Coordinator publishes Lab Note
    print("\n4️⃣ Coordinator synthesizing Lab Note...")
    # Activity ID is likely LAB-002 (since LAB-001 was our setup test)
    # We'll try to find the last activity
    from admin.brain.research_utils import load_ledger
    ledger = load_ledger()
    last_aid = ledger["activities"][-1]["id"]
    
    note_msg = coordinator.publish_lab_note(last_aid)
    print(note_msg)

if __name__ == "__main__":
    run_lab_swarm()
