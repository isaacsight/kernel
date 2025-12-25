import asyncio
import websockets
import requests
import json
import time

API_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/v1/ws_signals"

async def test_ws_nudge():
    print("Testing WebSocket Nudge Bridge...")
    
    # 1. Connect to WebSocket as a mock extension
    async with websockets.connect(WS_URL) as websocket:
        print("Connected to Sovereign Bridge.")
        
        # 2. Trigger a deep context ingestion via HTTP
        payload = {
            "user_id": "anon_abc123",
            "event_type": "browser_context",
            "context": {
                "url": "https://active-inference.test",
                "title": "A Study in Depth",
                "bodyText": "This is a long article about the Free Energy Principle. " * 50
            }
        }
        
        print("Sending Deep Context...")
        requests.post(f"{API_URL}/v1/ingest", json=payload)
        
        # 3. Wait for the nudges to arrive via WebSocket
        count = 0
        try:
            while count < 2:
                message = await asyncio.wait_for(websocket.recv(), timeout=10)
                signal = json.loads(message)
                print(f"Received Signal: [{signal.get('state')}] {signal.get('message')}")
                count += 1
        except asyncio.TimeoutError:
            print("FAILED: Timed out waiting for signals.")
            return False

    print("SUCCESS: Browser Agent Signaling Verified.")
    return True

if __name__ == "__main__":
    asyncio.run(test_ws_nudge())
