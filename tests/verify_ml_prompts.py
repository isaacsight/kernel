import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.brain.system_prompts import SystemPrompts
from admin.engineers.ml_engineer import MLEngineer

def verify_prompts_exist():
    print("Verifying SystemPrompts methods...")
    
    prompts_to_check = [
        ("Model Architecture Audit", SystemPrompts.get_model_architecture_audit_prompt),
        ("Data Pipeline Integrity", SystemPrompts.get_data_pipeline_integrity_prompt),
        ("Training Dynamics Debugger", SystemPrompts.get_training_dynamics_debugger_prompt),
        ("Active Inference Mechanic", SystemPrompts.get_active_inference_mechanic_prompt)
    ]
    
    for name, method in prompts_to_check:
        try:
            prompt_text = method()
            if prompt_text and isinstance(prompt_text, str) and len(prompt_text) > 50:
                 print(f"✅ {name}: FOUND ({len(prompt_text)} chars)")
            else:
                 print(f"❌ {name}: RETURNED EMPTY OR INVALID")
        except Exception as e:
            print(f"❌ {name}: ERROR - {str(e)}")

async def verify_ml_engineer_integration():
    print("\nVerifying MLEngineer Integration...")
    engineer = MLEngineer()
    
    actions_to_check = ["audit_architecture", "debug_training"]
    
    for action in actions_to_check:
        try:
            result = await engineer.execute(action)
            if "prompt" in result and len(result["prompt"]) > 50:
                print(f"✅ MLEngineer action '{action}': SUCCESS")
            else:
                print(f"❌ MLEngineer action '{action}': FAILED - Invalid response structure")
        except Exception as e:
            print(f"❌ MLEngineer action '{action}': ERROR - {str(e)}")

if __name__ == "__main__":
    verify_prompts_exist()
    asyncio.run(verify_ml_engineer_integration())
