
import requests
import json
import os

API_URL = "http://localhost:9001"

def test_create_draft():
    try:
        print(f"Testing connection to {API_URL}...")
        
        # 1. Create Draft
        response = requests.post(f"{API_URL}/create_draft", json={"width": 1080, "height": 1920}, timeout=5)
        if response.status_code != 200:
            print(f"❌ Failed to connect/create draft: {response.text}")
            return
            
        data = response.json()
        if not data.get("success"):
            print(f"❌ API Error: {data.get('error')}")
            return
            
        draft_id = data["output"]["draft_id"]
        print(f"✅ Draft Created! ID: {draft_id}")
        
        # 2. Add simple text
        payload = {
            "draft_id": draft_id,
            "text": "Hello TikTok Test",
            "start": 0,
            "end": 3
        }
        res = requests.post(f"{API_URL}/add_text", json=payload)
        if res.status_code == 200 and res.json().get("success"):
             print(f"✅ Added Text successfully.")
        else:
             print(f"❌ Failed to add text: {res.text}")

        # 3. Save
        res = requests.post(f"{API_URL}/save_draft", json={"draft_id": draft_id})
        if res.status_code == 200:
             print(f"✅ Draft Saved.")
        else:
             print(f"❌ Failed to save.")
             
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_create_draft()
