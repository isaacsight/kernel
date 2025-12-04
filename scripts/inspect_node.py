import requests
import os
from dotenv import load_dotenv

load_dotenv()

node_url = os.environ.get("STUDIO_NODE_URL")
print(f"Inspecting: {node_url}")

try:
    response = requests.get(node_url, timeout=5)
    print(f"Status: {response.status_code}")
    print(f"Server Header: {response.headers.get('Server', 'Unknown')}")
    print(f"Content: {response.text[:200]}")
except Exception as e:
    print(f"Error: {e}")
