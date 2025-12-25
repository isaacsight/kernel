import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_agent_presence():
    print(f"Testing Agent Presence at {BASE_URL}/agents/status...")
    try:
        response = requests.get(f"{BASE_URL}/agents/status")
        response.raise_for_status()
        data = response.json()
        
        agents = data.get("agents", [])
        sovereign_found = False
        for agent in agents:
            if agent["name"] == "The Sovereign":
                sovereign_found = True
                print(f"✅ Found Sovereign: {agent}")
                break
        
        if not sovereign_found:
            print("❌ Sovereign NOT found in agent list.")
            return False
        return True
    except Exception as e:
        print(f"❌ Error checking presence: {e}")
        return False

def test_consult_api():
    print(f"\nTesting consultation API at {BASE_URL}/api/sovereign/consult...")
    payload = {
        "prompt": "Test integration. Are you online?",
        "depth": 1
    }
    try:
        response = requests.post(f"{BASE_URL}/api/sovereign/consult", json=payload)
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "success" and "directive" in data:
            print(f"✅ Consultation successful. Response len: {len(data['directive'])}")
            print(f"Response preview: {data['directive'][:50]}...")
            return True
        else:
            print(f"❌ Consultation failed. Response: {data}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking consultation API: {e}")
        return False

def main():
    print("--- 👑 Sovereign Environment Integration Verification 👑 ---\n")
    
    presence_ok = test_agent_presence()
    consult_ok = test_consult_api()
    
    if presence_ok and consult_ok:
        print("\n✅✅ VERIFICATION PASSED: The Sovereign is fully integrated.")
        sys.exit(0)
    else:
        print("\n❌❌ VERIFICATION FAILED.")
        sys.exit(1)

if __name__ == "__main__":
    main()
