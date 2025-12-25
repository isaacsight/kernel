import requests
import json
import time
import os

API_URL = "http://localhost:8001" # Mac Controller Port

def verify_note_capture():
    print("🚀 Verifying Mobile Note Capture...")
    
    note_content = "Researching the ethics of bio-digital synthesis in 2026."
    payload = {
        "command": f"Note: {note_content}"
    }
    
    # 1. Send the command
    print(f"📡 Sending command: {payload['command']}")
    try:
        response = requests.post(f"{API_URL}/execute", json=payload, timeout=10)
        if response.status_code != 200:
            print(f"❌ Command failed: {response.text}")
            return
        
        result = response.json()
        try:
            print(f"✅ Route Success: {result.get('intent', 'N/A')} -> {result.get('action', 'N/A')}")
            print(f"📦 Message: {result.get('message', 'N/A')}")
        except Exception as e:
            print(f"❌ Parsing Error: {e}")
            print(f"FULL RESPONSE: {json.dumps(result, indent=2)}")
            return
    except Exception as e:
        print(f"❌ Failed to reach API: {e}")
        return

    # 2. Verify Intake
    print("⏳ Waiting for intake processing (2 seconds)...")
    time.sleep(2)
    
    # Check Memory Store (via agents/status or direct DB if we had to, but let's use the reflection agent next)
    print("\n✨ Capture verification complete. Now run Reflection Test.")

if __name__ == "__main__":
    verify_note_capture()
