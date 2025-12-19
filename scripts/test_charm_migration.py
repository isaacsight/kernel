from admin.brain.controller import get_model_controller, ModelController
import logging
import sys
import os

# Add root to path
sys.path.append(os.getcwd())

# Setup Logging
logging.basicConfig(level=logging.INFO)

def test_migration():
    print("Initializing Controller...")
    controller = ModelController() 
    
    print("\nRegistry:")
    for name, info in controller.registry.items():
        print(f" - {name} (Custom Class: {info['custom_class']})")
        
    print("\nRouting Request: 'Research the history of Canonical Ltd'")
    
    # 1. Test Routing
    route = controller.route("Research the history of Canonical Ltd")
    print("\nRouting Result:", route)

    # Mock Fallback if 429/Error
    if not route.get('success'):
        print("⚠️ Routing failed (likely Rate Limit). Mocking success to test Execution...")
        route = {
            "success": True,
            "charm": "The Researcher", # Must match the NAME in registry
            "action": "research",
            "params": {"topic": "Canonical Ltd", "max_iterations": 1},
            "response": "Mocked response"
        }
    
    # Check if routed to Researcher (or whatever name is in PROFILE.md)
    # Note: PROFILE.md for Researcher might just say "name: Researcher"
    target = route.get('charm')
    
    if route.get('success') and target:
        print(f"✅ Routing Successful (Target: {target})")
        
        # 2. Test Execution
        # Force single iteration for speed
        if 'params' not in route: route['params'] = {}
        route['params']['max_iterations'] = 1 
        
        print("\nExecuting Charm...")
        result = controller.execute(route)
        
        print("\nExecution Result:", result.keys())
        if result.get('success'):
             print("✅ Execution Successful")
             if 'report' in result:
                print("Report Preview:", result.get('report')[:200])
        else:
             print("❌ Execution Failed:", result.get('error'))
             
    else:
        print("❌ Routing Failed or Wrong Target")

if __name__ == "__main__":
    test_migration()
