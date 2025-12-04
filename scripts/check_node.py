import requests
import os
from dotenv import load_dotenv

load_dotenv()

node_url = os.environ.get("STUDIO_NODE_URL")
print(f"Checking connection to Studio Node at: {node_url}")

if not node_url:
    print("Error: STUDIO_NODE_URL not set.")
    exit(1)

try:
    # Try a simple health check or list models
    response = requests.get(f"{node_url}/tags", timeout=5) # Ollama usually has /api/tags or similar, but let's try root or known endpoint
    # If it's a custom server, maybe just root
    if response.status_code == 404:
         # Try root
         response = requests.get(node_url, timeout=5)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:200]}")
    print("Connection Successful!")
except Exception as e:
    print(f"Connection Failed: {e}")
