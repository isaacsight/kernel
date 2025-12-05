from admin.engineers.office_manager import get_office_manager
import time

def verify_office():
    mgr = get_office_manager()
    
    # 1. Start Work
    print("Updating agent status...")
    mgr.update_agent_status("The Architect", "Working", "Refactoring generic database connectors", "Desk")
    mgr.update_agent_status("The Visionary", "Thinking", "Contemplating the nature of recursion", "Whiteboard")
    
    # 2. Add Idea
    print("Adding whiteboard item...")
    mgr.add_whiteboard_item("We need a better coffee simulation", "The Operator")
    
    # 3. Check State
    state = mgr.get_office_state()
    arch = state['agents']['The Architect']
    
    assert arch['status'] == "Working"
    assert len(state['whiteboard']) > 0
    print("✅ Office state verified.")
    print(f"Architect is {arch['status']} at {arch['location']}")
    print(f"Whiteboard has {len(state['whiteboard'])} items")

if __name__ == "__main__":
    verify_office()
