"""
🧪 EXPERIMENT VALIDATION: Mobile Chat Loop
========================================
Mimics the mobile app sending a "Hello" command to the backend.
Verifies that the /execute endpoint receives it and returns a response.
"""

import requests
import json
import sys

def verify_chat():
    url = "http://localhost:8001/execute"
    payload = {"command": "Hello, are you there?"}
    
    print(f"📱 MOCK MOBILE: Sending command to {url}...")
    print(f"   Payload: {json.dumps(payload)}")
    
    try:
        response = requests.post(url, json=payload, timeout=5)
        print(f"⚡ BACKEND RESPONSE ({response.status_code}):")
        
        if response.status_code == 200:
            data = response.json()
            print(json.dumps(data, indent=2))
            
            if data.get("success"):
                print("\n✅ SUCCESS: Chat loop is ACTIVE.")
                print(f"   Reply: '{data.get('message')}'")
            else:
                print("\n❌ FAILURE: Backend returned error.")
        else:
             print(f"\n❌ FAILURE: HTTP {response.status_code}")
             print(response.text)
             
    except Exception as e:
        print(f"\n❌ CRITICAL: Connection failed - {e}")

if __name__ == "__main__":
    verify_chat()
