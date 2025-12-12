import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

from admin.engineers.client_service import ClientService

async def verify_chat():
    print("Initializing ClientService...")
    # Mock API key if not present (although it should be for real test)
    if not os.environ.get("GEMINI_API_KEY"):
        print("Error: GEMINI_API_KEY not found in environment.")
        return

    service = ClientService()

    print("\n--- Test 1: Introduction ---")
    msg1 = "Hi, my name is Isaac and I'm interested in video editing."
    print(f"Client: {msg1}")
    response1 = ""
    async for chunk in service.stream_chat(msg1):
        response1 += chunk
        print(chunk, end="", flush=True)
    print("\n")

    print("\n[INFO] Waiting 60s to respect rate limits...")
    await asyncio.sleep(60)

    print("\n--- Test 2: Memory Check ---")
    msg2 = "What was my name again? And how much for the editing?"
    print(f"Client: {msg2}")
    response2 = ""
    async for chunk in service.stream_chat(msg2):
        response2 += chunk
        print(chunk, end="", flush=True)
    print("\n")

    if "Isaac" in response2:
        print("\n[SUCCESS] Memory verified: Bot remembered the name.")
    else:
        print("\n[FAILURE] Memory verified: Bot DID NOT remember the name.")

if __name__ == "__main__":
    try:
        asyncio.run(verify_chat())
    except KeyboardInterrupt:
        pass
