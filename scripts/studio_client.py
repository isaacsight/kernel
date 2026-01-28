import requests
import sys

# CONFIGURATION
# Replace this with the IP address of your Windows machine
# You can find it by running 'ipconfig' in PowerShell on Windows
NODE_IP = "192.168.1.57" 
NODE_PORT = 5001
BASE_URL = f"http://{NODE_IP}:{NODE_PORT}"

def check_health():
    print(f"Checking connection to {BASE_URL}...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Connection Successful!")
            print(f"Status: {data.get('status')}")
            print(f"Ollama: {data.get('ollama_status')}")
            return True
        else:
            print(f"❌ Server returned status: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect. Check IP address and ensure Windows Firewall allows port 5001.")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_chat():
    print("\nSending test chat message...")
    try:
        payload = {
            "model": "mistral",
            "messages": [{"role": "user", "content": "Hello! Are you working?"}],
            "stream": False
        }
        response = requests.post(f"{BASE_URL}/api/chat", json=payload, timeout=30)
        if response.status_code == 200:
            result = response.json()
            content = result.get('message', {}).get('content', '')
            print("✅ Response received:")
            print("-" * 40)
            print(content.strip())
            print("-" * 40)
        else:
            print(f"❌ Failed to generate. Status: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Error during chat: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        NODE_IP = sys.argv[1]
        BASE_URL = f"http://{NODE_IP}:{NODE_PORT}"
    
    if NODE_IP == "YOUR_WINDOWS_IP_HERE":
        print("⚠️  PLEASE UPDATE 'NODE_IP' IN THE SCRIPT OR PASS IP AS ARGUMENT")
        print("Example: python studio_client.py 192.168.1.15")
    
    if check_health():
        test_chat()
