import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.brain.model_router import get_model_router, TaskType

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DebugRouter")

def debug_router():
    router = get_model_router()
    
    print("\n--- Environment ---")
    print(f"Environment: {router.env.value}")
    
    print("\n--- Availability Check ---")
    print(f"Ollama Available: {router._check_ollama_available()}")
    print(f"Studio Node Available: {router._check_studio_node_available()}")
    
    print("\n--- Local Models Status ---")
    local_models = [m for m_name, m in router.models.items() if m['type'] == 'local']
    for m in local_models:
        # We need to find the name key actually, the list above is just values
        pass
        
    for name, model in router.models.items():
        if model['type'] == 'local' or model['type'] == 'remote':
            print(f"{name}: available={model['available']}")

    print("\n--- Selection Test (prefer_local=True) ---")
    result = router.select_model(TaskType.CREATIVE_WRITING, {"prefer_local": True})
    print(f"Selected: {result.get('selected')}")
    print(f"Provider: {result.get('provider')}")
    print(f"Reasoning: {result.get('reasoning')}")

if __name__ == "__main__":
    debug_router()
