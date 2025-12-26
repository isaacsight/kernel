
import sys
import os

# Add the project root to the python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

try:
    from admin.brain.system_prompts import SystemPrompts
except ImportError:
    # If running from root
    from admin.brain.system_prompts import SystemPrompts

def verify_new_prompts():
    print("Verifying new System Prompts...")
    
    prompts_to_check = [
        "get_titan_db_schema_check_prompt",
        "get_synaptic_lattice_integration_prompt",
        "get_cockpit_widget_audit_prompt",
        "get_narrative_consistency_prompt",
        "get_world_building_consistency_prompt"
    ]
    
    passed = 0
    for prompt_name in prompts_to_check:
        try:
            method = getattr(SystemPrompts, prompt_name)
            result = method()
            if isinstance(result, str) and len(result) > 0:
                print(f"[PASS] {prompt_name} exists and returns a string.")
                passed += 1
            else:
                print(f"[FAIL] {prompt_name} returned invalid content: {result}")
        except AttributeError:
            print(f"[FAIL] {prompt_name} not found in SystemPrompts class.")
        except Exception as e:
            print(f"[FAIL] {prompt_name} raised exception: {e}")
            
    if passed == len(prompts_to_check):
        print("\nAll new prompts verified successfully!")
        sys.exit(0)
    else:
        print(f"\n{len(prompts_to_check) - passed} prompts failed verification.")
        sys.exit(1)

if __name__ == "__main__":
    verify_new_prompts()
