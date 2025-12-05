import requests
import json
import sys

def demo_visionary():
    print("🎨 DEMOING THE VISIONARY (DESIGN TEAM)...")
    print("-" * 50)
    
    url = "http://localhost:8000/agents/run"
    
    # 1. Generate CSS
    print("\n1. Requesting CSS Generation...")
    print("   Prompt: 'A futuristic neon button with a glow effect'")
    
    payload = {
        "agent_name": "The Visionary",
        "action": "generate_css",
        "parameters": {
            "requirements": "A futuristic neon button with a glow effect",
            "current_css": ""
        }
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        
        print("\n   ✨ RESULT:")
        print(result.get("result", "No result"))
        
    except Exception as e:
        print(f"   ❌ FAILED: {e}")

    # 2. Critique Design
    print("\n" + "-" * 50)
    print("\n2. Requesting Design Critique...")
    print("   Input: .btn { background: red; color: blue; }")
    
    payload = {
        "agent_name": "The Visionary",
        "action": "critique",
        "parameters": {
            "css": ".btn { background: red; color: blue; }",
            "html": "<button class='btn'>Click Me</button>"
        }
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        
        print("\n   🧐 CRITIQUE:")
        print(result.get("result", "No result"))
        
    except Exception as e:
        print(f"   ❌ FAILED: {e}")

if __name__ == "__main__":
    demo_visionary()
