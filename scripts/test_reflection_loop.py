import requests
import json
import time

API_URL = "http://localhost:8001" # Mac Controller Port

def verify_reflection():
    print("🔬 Verifying Agent Reflection Loop...")
    
    payload = {
        "command": "Review my recent notes and summarize what've been thinking about lately."
    }
    
    # 1. Send the reflection command
    print(f"📡 Sending command: {payload['command']}")
    try:
        response = requests.post(f"{API_URL}/execute", json=payload, timeout=30)
        if response.status_code != 200:
            print(f"❌ Reflection failed: {response.text}")
            return
        
        result = response.json()
        try:
            print(f"✅ Route Success: {result.get('intent', 'N/A')} -> {result.get('action', 'N/A')}")
            
            if result.get('success') and 'data' in result:
                print("\n--- AGENT REFLECTION ---")
                print(result['data'].get('message', 'No summary generated.'))
                print("------------------------")
                print(f"Notes Analyzed: {result['data'].get('notes_analyzed', 0)}")
            else:
                print(f"❌ Logic Error: {result.get('message')}")
        except Exception as e:
            print(f"❌ Parsing Error: {e}")
            print(f"FULL RESPONSE: {json.dumps(result, indent=2)}")
    except Exception as e:
        print(f"❌ Failed to reach API: {e}")

    print("\n✨ Reflection verification complete.")

if __name__ == "__main__":
    verify_reflection()
