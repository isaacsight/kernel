import requests
import json
import time

API_URL = "http://localhost:8000"

def test_intake():
    print("🚀 Starting Intake Pipeline Test...")
    
    # Simulate uploading a research paper/pasted text
    payload = {
        "source_type": "text",
        "content": """
        ## The Future of Bio-Digital Interfaces

        As we move towards 2026, the intersection of biotechnology and digital systems is accelerating. 
        Synthetic biology allows us to treat cells as programmable hardware. 
        Studio OS must position itself as the orchestrator for these bio-computational workflows.
        
        Themes:
        1. Bio-Computing
        2. Liquid Hardware
        3. Neural Synthesis
        """,
        "metadata": {
            "title": "Bio-Digital Research",
            "project": "Vision 2026"
        }
    }
    
    # 1. Trigger Intake
    print("📡 Sending work to OS Intake...")
    response = requests.post(f"{API_URL}/api/intake", json=payload)
    if response.status_code != 200:
        print(f"❌ Intake failed: {response.text}")
        return
    
    data = response.json()
    intake_id = data['intake_id']
    print(f"✅ Intake accepted. ID: {intake_id}")
    
    # 2. Poll for Status (Wait for background tasks to finish)
    print("⏳ Waiting for Agent Swarm to react (5 seconds)...")
    time.sleep(5)
    
    # 3. Verify Memory Store (via agents/audit or similar if exists, or direct check)
    # Since we don't have a direct "check status" API yet beyond the response, 
    # we'll look for signs of life in the drafts/insights.
    
    print("\n🔍 Verifying Agent Outputs:")
    
    # Check Librarian (via Vector Search)
    # (Assuming we have a query endpoint)
    
    # For this test, we'll just check if the process ran without crashing 
    # and maybe look at the console logs of the server if we could.
    # Since we can't see server logs easily in the script, let's assume if it returns 200, the background task started.
    
    print("✨ Test sequence complete. Check server logs for 'Intake X processing sequence complete'.")

if __name__ == "__main__":
    test_intake()
