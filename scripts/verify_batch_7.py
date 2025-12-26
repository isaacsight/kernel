import sys
import os
import inspect

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.brain.system_prompts import SystemPrompts

def verify_batch_7():
    """Verify that Batch 7 (Agent Manager) prompts exist."""
    
    expected_methods = [
        "get_swarm_coordination_prompt",
        "get_task_delegation_prompt",
        "get_agent_performance_review_prompt",
        "get_conflict_resolution_prompt",
        "get_resource_allocation_prompt"
    ]
    
    print("Verifying Batch 7 Prompts (Agent Manager)...")
    all_methods = [m[0] for m in inspect.getmembers(SystemPrompts, predicate=inspect.isfunction)]
    
    missing = []
    found_count = 0
    
    for method in expected_methods:
        if method in all_methods:
            print(f"✅ Found: {method}")
            found_count += 1
        else:
            print(f"❌ MISSING: {method}")
            missing.append(method)
            
    print(f"\nResult: {found_count}/{len(expected_methods)} found.")
    
    if missing:
        print("Verification Failed.")
        sys.exit(1)
    else:
        print("Verification Success!")
        sys.exit(0)

if __name__ == "__main__":
    verify_batch_7()
