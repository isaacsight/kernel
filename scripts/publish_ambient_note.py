import sys
import os

# Ensure project root is in path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.append(project_root)

from admin.engineers.lab_coordinator import LabCoordinator

def publish_note():
    print("🔬 [Lab Swarm] Publishing Lab Note...")
    coordinator = LabCoordinator()
    
    # We know the ID is LAB-005 from the previous run
    note_msg = coordinator.publish_lab_note("LAB-005")
    print(note_msg)

if __name__ == "__main__":
    publish_note()
