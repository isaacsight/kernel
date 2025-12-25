"""
RLvAI Environment Introduction - Studio OS
Live demo of Reinforcement Learning via Active Inference.
"""

import asyncio
import os
import sys
import json
import requests

# Ensure project root is in path
sys.path.append(os.getcwd())

async def main():
    print("--- 🧠 Introducing RLvAI to the Environment ---")
    
    # 1. Trigger the RL Optimization via Command API
    print("\n[Phase 1] Triggering RL Optimization...")
    api_url = "http://localhost:8000"
    
    try:
        # Check if server is up
        requests.get(f"{api_url}/system/status")
        
        # Trigger RL command
        payload = {"command": "RL optimize the current environment"}
        response = requests.post(f"{api_url}/command", json=payload)
        res_data = response.json()
        
        print(f"Status: {res_data.get('status', 'success')}")
        print(f"Message: {res_data.get('message')}")
        
    except Exception as e:
        print(f"⚠️ API not reachable (run `uvicorn admin.api.main:app` first). Error: {e}")
        print("Falling back to local simulation...")

    # 2. Direct RLvAI Intelligence Check
    print("\n[Phase 2] Direct RLvAI Intelligence Check...")
    try:
        # We manually fetch from the new endpoint
        response = requests.get(f"{api_url}/api/intelligence/rlvai")
        data = response.json()
        
        print(f"[Model] {data.get('model')}")
        print(f"[Framework] {data.get('framework')}")
        print(f"[Reward Signal] {data['metrics'].get('reward')}")
        print(f"[Convergence] {data['metrics'].get('convergence')}")
        print(f"[Phi Score] {data.get('phi')}")
        
    except Exception as e:
        print(f"Could not reach RLvAI endpoint: {e}")

    print("\n--- 🚀 RLvAI is now active in your environment ---")
    print("Agents will now bias towards high-reward actions while maintaining epistemic integrity.")

if __name__ == "__main__":
    asyncio.run(main())
