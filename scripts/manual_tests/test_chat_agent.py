
import requests
import json
import time

BASE_URL = "http://localhost:5001/api/chat"

def test_message(message, expected_intent=None):
    print(f"\n[TEST] Sending: '{message}'")
    try:
        start_time = time.time()
        response = requests.post(BASE_URL, json={"message": message}, timeout=10)
        duration = time.time() - start_time
        
        print(f"Status: {response.status_code} (took {duration:.2f}s)")
        
        if response.status_code == 200:
            data = response.json()
            if data['status'] == 'success':
                result = data['result']
                print(f"Intent: {result.get('intent')}")
                print(f"Action: {result.get('action')}")
                print(f"AI Message: {result.get('message')}")
                
                if expected_intent and result.get('intent') != expected_intent:
                    print(f"❌ FAILED: Expected intent '{expected_intent}', got '{result.get('intent')}'")
                elif expected_intent:
                    print(f"✅ PASSED: Intent matches '{expected_intent}'")
                else:
                    print("✅ PASSED: Valid response received")
            else:
                print(f"❌ FAILED: API Error - {data.get('message')}")
        else:
            print(f"❌ FAILED: Server returned {response.status_code}")
            
    except Exception as e:
        print(f"❌ FAILED: Exception - {e}")

if __name__ == "__main__":
    print("=== STARTING CHAT AGENT BETA TEST ===")
    
    # 1. Basic Chat
    test_message("Hello, are you there?", "chat")
    
    # 2. System Status
    test_message("Check system status", "status")
    
    # 3. Help
    test_message("Help me", "help")
    
    # 4. Unknown/Nonsense
    test_message("asdf jkl;", "unknown")
    
    # 5. Complex Request (Drafting) - This might take longer
    # test_message("Draft a short tweet about coding", "generate") 
    
    print("\n=== TEST COMPLETE ===")
