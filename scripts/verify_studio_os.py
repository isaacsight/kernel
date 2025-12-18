import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_health():
    print("Testing /api/health...")
    resp = requests.get(f"{BASE_URL}/api/health")
    print(f"Status: {resp.status_code}, Body: {resp.json()}")

def test_decision_ledger():
    print("\nTesting Decision Ledger...")
    # 1. Log a decision
    print("Logging a test decision...")
    data = {
        "topic": "Verification Test",
        "decision": "yes",
        "context": "Agentic team verification run",
        "agent_id": "verifier"
    }
    requests.post(f"{BASE_URL}/api/decisions", json=data)
    
    # 2. Get history
    print("Fetching decision history...")
    resp = requests.get(f"{BASE_URL}/api/decisions?limit=1")
    decisions = resp.json()
    if decisions and decisions[0]['topic'] == "Verification Test":
        print("✅ Decision Ledger verified.")
    else:
        print("❌ Decision Ledger verification failed.")

def test_team_task():
    print("\nTesting Frontier Team Task (This may take a moment)...")
    data = {"prompt": "Quick check: Does the Studio OS architecture favor local-first inference?"}
    try:
        resp = requests.post(f"{BASE_URL}/api/team/task", json=data, timeout=60)
        result = resp.json()
        print(f"Status: {resp.status_code}")
        print(f"Review Summary: {result.get('review', {}).get('summary', 'No summary')}")
        if resp.status_code == 200:
            print("✅ Frontier Team orchestration verified.")
        else:
            print(f"❌ Team task failed: {result}")
    except Exception as e:
        print(f"❌ Team task request failed: {e}")

if __name__ == "__main__":
    test_health()
    test_decision_ledger()
    # Note: test_team_task requires LLM access and takes time. 
    # Uncomment if you want to run the full team build test.
    # test_team_task()
