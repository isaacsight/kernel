import requests
import json
import os
import sys

def verify_ml_integration():
    url = "http://localhost:8000"
    
    print("🧠 Checking /agents/status for MLEngineer...")
    try:
        response = requests.get(f"{url}/agents/status")
        data = response.json()
        agents = [a['name'] for a in data.get('agents', [])]
        if "MLEngineer" in agents:
            print("✅ MLEngineer found in presence list.")
        else:
            print(f"❌ MLEngineer NOT found. Active agents: {agents}")
    except Exception as e:
        print(f"❌ Failed to check agent status: {e}")

    print("\n⚡ Checking /api/intelligence/rlvai endpoint...")
    try:
        response = requests.get(f"{url}/api/intelligence/rlvai")
        if response.status_code == 200:
            print("✅ RLvAI status endpoint operational.")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"❌ RLvAI endpoint failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ Failed to check RLvAI endpoint: {e}")

    print("\n🚀 Testing 'rl_optimize' action via Command Router...")
    try:
        payload = {"command": "rl optimize system performance"}
        response = requests.post(f"{url}/command", json=payload)
        data = response.json()
        print(f"📊 Full Router Response:\n{json.dumps(data, indent=2)}")
        if response.status_code == 200:
            print(f"✅ Router Response: {data.get('response_text')}")
            # The router returns 'data' which contains the actual result in 'data' field sometimes
            result = data.get('data') or data.get('result')
            print(f"✅ Action Result Status: {result.get('status') if result else 'N/A'}")
        else:
            print(f"❌ Command Router failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ Failed to test command router: {e}")

if __name__ == "__main__":
    verify_ml_integration()
