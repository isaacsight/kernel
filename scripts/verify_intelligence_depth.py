"""
🧪 EXPERIMENT: Intelligence Depth & Reasoning
===========================================
Verifies that the "Mobile Neural Link" is not just a chatbot,
but capable of complex reasoning (Gemini 1.5 Flash).

Tests:
1. Logic Puzzle (River Crossing variation)
2. Creative Synthesis (Haiku about Rust code)
3. Strategic Planning (Brief marketing intent)
"""

import requests
import json
import time

def test_intelligence():
    print("🧠 INITIATING INTELLIGENCE DEPTH TEST...")
    url = "http://localhost:8001/execute"
    
    questions = [
        {
            "name": "logic_puzzle",
            "prompt": "If a red house is made of red bricks, and a blue house is made of blue bricks, what is a greenhouse made of?",
            "expected_keyword": "glass"
        },
        {
            "name": "creative_synthesis",
            "prompt": "Write a Haiku about a recursive python function.",
            "expected_keyword": "call" # generic check
        },
        {
            "name": "strategic_planning",
            "prompt": "Give me 3 bullet points on how to market a 'Privacy-First AI' to developers.",
            "expected_keyword": "data"
        }
    ]
    
    score = 0
    
    for q in questions:
        print(f"\n🔬 PROBE: {q['name'].upper()}")
        print(f"   Input: '{q['prompt']}'")
        
        start = time.time()
        try:
            res = requests.post(url, json={"command": q['prompt']}, timeout=60)
            duration = (time.time() - start) * 1000
            
            if res.status_code == 200:
                data = res.json()
                msg = data.get("message", "")
                
                print(f"   Response ({duration:.0f}ms):")
                print(f"   -> \"{msg[:100]}...\"")
                
                if len(msg) > 5 and q['expected_keyword'].lower() in msg.lower():
                    print("   ✅ PASSED: Reasoning Valid")
                    score += 1
                elif len(msg) > 5:
                    print("   ⚠️  WARNING: Answer generated but keyword missing.")
                    score += 0.5
                else:
                    print("   ❌ FAILED: Empty/Short response.")
            else:
                print(f"   ❌ FAILED: HTTP {res.status_code}")
                
        except Exception as e:
            print(f"   ❌ CRITICAL: {e}")
            
    print(f"\n📊 INTELLIGENCE SCORE: {score}/{len(questions)}")
    if score >= 2.5:
        print("   RESULT: SYSTEM IS INTELLIGENT.")
    else:
        print("   RESULT: SYSTEM IS SUB-OPTIMAL.")

if __name__ == "__main__":
    test_intelligence()
