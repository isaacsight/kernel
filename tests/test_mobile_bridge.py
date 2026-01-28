import requests
import json
import time

def test_command(command):
    print(f"\n💬 Testing: '{command}'")
    try:
        response = requests.post(
            "http://localhost:8000/command",
            json={"command": command},
            timeout=10
        )
        print(f"✅ Status: {response.status_code}")
        print(f"📦 Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"❌ Failed: {e}")

if __name__ == "__main__":
    print("🚀 Starting Mobile Bridge Verification...")
    
    # Test 1: System Status
    test_command("What is the current system status?")
    
    # Test 2: Mobile Handover
    test_command("Send a summary of my latest research to my phone.")
    
    # Test 3: Remote Command (Control)
    test_command("Run a performance check on the OS.")
    
    print("\n✨ Verification sequence complete.")
