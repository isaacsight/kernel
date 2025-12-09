import requests
import os
from dotenv import load_dotenv

load_dotenv()

node_url = os.environ.get("STUDIO_NODE_URL", "http://100.98.193.42:8001")
print(f"Testing generation on: {node_url}")

payload = {
    "prompt": "Say hello!",
    "model": "mistral"
}

try:
    # Try the bridge endpoint
    response = requests.post(f"{node_url}/api/generate", json=payload, timeout=10)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Response: {response.json()}")
    else:
        print(f"Error Text: {response.text}")
        
except Exception as e:
    print(f"Failed: {e}")
