import sys
import os
from unittest.mock import MagicMock

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.alchemist import Alchemist

def test_autonomy():
    print("Initializing Alchemist...")
    alchemist = Alchemist()
    
    # Mock DataCenter to avoid actual network calls and simulate states
    alchemist.data_center = MagicMock()
    
    print("\n--- Scenario 1: Studio Node is ONLINE ---")
    alchemist.data_center.check_node_health.return_value = {"status": "online", "message": "Mock Online"}
    provider = alchemist.select_best_provider()
    print(f"Selected Provider: {provider}")
    if provider == "remote":
        print("✅ SUCCESS: Chose remote when online.")
    else:
        print("❌ FAILURE: Did not choose remote.")

    print("\n--- Scenario 2: Studio Node is OFFLINE ---")
    alchemist.data_center.check_node_health.return_value = {"status": "offline", "message": "Mock Offline"}
    provider = alchemist.select_best_provider()
    print(f"Selected Provider: {provider}")
    if provider == "gemini":
        print("✅ SUCCESS: Fell back to gemini when offline.")
    else:
        print("❌ FAILURE: Did not fall back.")

if __name__ == "__main__":
    test_autonomy()
