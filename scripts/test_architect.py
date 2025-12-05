import sys
import os
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.architect import Architect

def test_architect():
    print("🏗️ TESTING THE ARCHITECT...")
    print("-" * 50)
    
    architect = Architect()
    
    # Mock mission
    mission = "Update the system status endpoint to return the server uptime."
    
    print(f"Mission: {mission}")
    print("Generating Blueprint... (this uses the LLM)")
    
    try:
        blueprint = architect.create_blueprint(mission)
        
        print("\n📋 BLUEPRINT RECEIVED:")
        print(json.dumps(blueprint, indent=2))
        
        if "changes" in blueprint and len(blueprint["changes"]) > 0:
            print("\n✅ SUCCESS: Architect generated a valid blueprint.")
        else:
            print("\n⚠️ WARNING: Blueprint is empty or invalid.")
            
    except Exception as e:
        print(f"\n❌ FAILED: {e}")

if __name__ == "__main__":
    test_architect()
