import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.council import GrandCouncil
from admin.engineers.trend_scout import TrendScout

# Configure logging
logging.basicConfig(level=logging.INFO)

def verify_council():
    print("--- Starting Grand Council Verification ---")
    
    # 1. Initialize Council
    council = GrandCouncil()
    
    # 2. Register a real agent (TrendScout)
    print("Registering TrendScout...")
    try:
        scout = TrendScout()
        council.register_agent("Trend Scout", scout)
    except Exception as e:
        print(f"FAILED to initialize TrendScout: {e}")
        return

    # 3. Create a mock state
    mock_state = {
        "cycle": 42,
        "status": "active",
        "last_log": "System verification in progress.",
        "metrics": {"fitness": 0.9}
    }
    
    # 4. Run Deliberation
    print("Running Deliberation...")
    try:
        result = council.deliberate("Should we pivot to producing content about Quantum Computing?", mock_state)
        
        print("\n--- Deliberation Result ---")
        print(f"Council Output:\n{result['council_output']}")
        print(f"\nIntelligence Gathered:\n{result['intelligence']}")
        
        # 5. Check for JSON command
        if '"action":' in result['council_output']:
            print("\n✅ SUCCESS: Council produced actionable JSON.")
        else:
            print("\n⚠️ WARNING: Council output might be missing structured JSON.")
            
    except Exception as e:
        print(f"\n❌ FAILED: Deliberation error: {e}")

if __name__ == "__main__":
    verify_council()
