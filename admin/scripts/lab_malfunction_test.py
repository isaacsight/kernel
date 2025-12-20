import asyncio
import websockets
import json
import time
import sys
import os

async def run_lab_test():
    uri = "ws://localhost:8001/ws/client"
    print(f"🔬 [Lab Experiment] Malfunction Detection & Performance Audit")
    print(f"Connecting to {uri}...")
    
    metrics = {
        "ttft": None,
        "total_time": 0,
        "tokens_received": 0,
        "chunks_with_reasoning": 0,
        "status": "fail"
    }

    try:
        # Use origin to bypass potential 403
        async with websockets.connect(uri, origin="http://localhost:5173") as websocket:
            prompt = "Explain why high-fidelity design matters for AI agents."
            start_time = time.time()
            await websocket.send(prompt)
            
            async for response in websocket:
                data = json.loads(response)
                current_time = time.time()
                
                if metrics["ttft"] is None:
                    metrics["ttft"] = current_time - start_time
                    print(f"⚡ Time to First Token: {metrics['ttft']:.4f}s")
                
                if data["type"] == "reasoning_chunk":
                    metrics["chunks_with_reasoning"] += 1
                
                if data["type"] == "response_chunk":
                    metrics["tokens_received"] += 1
                
                if data["type"] == "response_done":
                    metrics["total_time"] = current_time - start_time
                    metrics["status"] = "pass"
                    break
                    
        print("\n--- [Experiment Results] ---")
        print(f"Status: {metrics['status'].upper()}")
        print(f"Total Response Time: {metrics['total_time']:.2f}s")
        print(f"Reasoning Chunks Detected: {metrics['chunks_with_reasoning']}")
        print(f"Total Text Chunks: {metrics['tokens_received']}")
        
        if metrics["chunks_with_reasoning"] > 0:
            print("✅ Malfunction Check: Reasoning extraction is FUNCTIONAL.")
        else:
            print("❌ Malfunction Check: NO REASONING DETECTED.")
            
        if metrics["ttft"] < 2.0:
            print(f"✅ Performance Check: Latency is within bounds ({metrics['ttft']:.2f}s).")
        else:
            print(f"⚠️ Performance Check: High Latency Detected ({metrics['ttft']:.2f}s).")

    except Exception as e:
        print(f"💥 Experiment Crashed: {e}")

if __name__ == "__main__":
    asyncio.run(run_lab_test())
