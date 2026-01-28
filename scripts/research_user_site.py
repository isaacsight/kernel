import sys
import os

# Ensure project root is in path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.append(project_root)

from admin.engineers.lab_coordinator import LabCoordinator
from admin.engineers.research_engineer import ResearchEngineer

def research_site():
    print("🌐 [Lab Swarm] Initiating Site Research...")
    
    coordinator = LabCoordinator()
    engineer = ResearchEngineer()
    
    # Step 1: Propose Hypothesis
    print("\n1️⃣ Proposing Hypothesis...")
    h_msg = coordinator.propose_hypothesis(
        "Site Persona & Agentic Alignment",
        "The site can better serve its audience through explicit agentic navigation paths.",
        agents=["ResearchEngineer", "LabCoordinator"]
    )
    print(h_msg)
    
    # Step 2: Conduct Research
    print("\n2️⃣ Researching Site Content...")
    # Fetch site data (simulated via search tools if direct browsing is limited, 
    # but here we'll use the engineer's search skill for the URL)
    research_summary = engineer.conduct_research("Review of https://www.doesthisfeelright.com focusing on design and AI agent integration.")
    print(f"Research Summary Snippet: {research_summary[:500]}...")
    
    # Step 3: Synthesis
    print("\n3️⃣ Publishing Lab Note...")
    from admin.brain.research_utils import load_ledger
    ledger = load_ledger()
    last_aid = ledger["activities"][-1]["id"]
    
    note_msg = coordinator.publish_lab_note(last_aid)
    print(note_msg)

if __name__ == "__main__":
    research_site()
