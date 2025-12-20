import asyncio
import websockets
import json
import sys

async def test_ws():
    uri = "ws://localhost:8001/ws/client"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri, origin="http://localhost:5173") as websocket:
            message = "Hello, can you explain your reasoning process?"
            print(f"Sending: {message}")
            await websocket.send(message)
            
            async for response in websocket:
                data = json.loads(response)
                print(f"Got ({data['type']}): {data['content'][:50]}...")
                if data['type'] == 'response_done':
                    break
    except Exception as e:
        print(f"Connection failed: {e}")
        print("Make sure 'npm run dev' is running at http://localhost:5173/")

if __name__ == "__main__":
    asyncio.run(test_ws())
