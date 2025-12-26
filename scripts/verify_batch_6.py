import sys
import os
import inspect

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.brain.system_prompts import SystemPrompts

def verify_batch_6():
    """Verify that Batch 6 (Brand Specific) prompts exist."""
    
    expected_methods = [
        "get_gallery_curator_prompt",
        "get_engine_diagnostic_prompt",
        "get_vibe_check_prompt",
        "get_signal_noise_ratio_prompt",
        "get_governance_enforcer_prompt"
    ]
    
    print("Verifying Batch 6 Prompts...")
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
    verify_batch_6()
