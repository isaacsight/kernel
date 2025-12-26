
import sys
import os
import asyncio
import json

# Ensure project root is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from admin.engineers.alchemist import Alchemist
from admin.engineers.metacognitive_principal import MetacognitivePrincipal

async def verify_expansions():
    print("🚀 Starting Agent Expansion Verification...\n")
    
    # --- Test 1: Alchemist Research ---
    print("🧪 Testing Alchemist Research...")
    try:
        alchemist = Alchemist()
        # Mocking WebScout for speed/safety if network issues, but let's try real first?
        # The Alchemist uses the real Web Scout which uses real APIs.
        # We'll trust it works or fail gracefully.
        
        research_topic = "The Future of Agentic AI"
        brief = alchemist.conduct_research(research_topic)
        print(f"✅ Research Brief Generated ({len(brief)} chars)")
        # print(brief[:200] + "...")
    except Exception as e:
        print(f"❌ Alchemist Research Failed: {e}")

    # --- Test 2: Alchemist Coding ---
    print("\n🧪 Testing Alchemist Coding...")
    test_file = "temp_code_test.py"
    try:
        with open(test_file, "w") as f:
            f.write("def hello():\n    print('old code')")
            
        result = alchemist.refine_code(test_file, "Change the print validation to say 'Hello New World'")
        
        if result["status"] == "success":
            with open(test_file, "r") as f:
                content = f.read()
            if "Hello New World" in content:
                 print("✅ Code Refined Successfully")
            else:
                 print(f"❌ Code Refined but content mismatch: {content}")
        else:
            print(f"❌ Refinement Failed: {result['message']}")
            
    except Exception as e:
        print(f"❌ Alchemist Coding Failed: {e}")
    finally:
        if os.path.exists(test_file):
            os.remove(test_file)
        if os.path.exists(test_file + ".bak*"):
            # Cleanup backups if we can find them broadly, or just leave them
            pass

    # --- Test 3: Sovereign Council ---
    print("\n👑 Testing Sovereign Council...")
    try:
        sovereign = MetacognitivePrincipal()
        
        # Test Convene
        issue = "We need to research the latest viral TikTok trends for AI coding."
        council_res = await sovereign.convene_council(issue)
        
        if council_res["status"] == "convened":
            print(f"✅ Council Convened with members: {council_res['council_members']}")
            if "resolution" in council_res:
                 print("✅ Resolution Generated")
        else:
            print("❌ Council Failed to Convene")
            
    except Exception as e:
        print(f"❌ Sovereign Council Failed: {e}")

    # --- Test 4: Sovereign Intervention ---
    print("\n👑 Testing Sovereign Discussion...")
    try:
        intervention = sovereign.active_intervention("clear_cache")
        if intervention["status"] == "success":
            print("✅ Active Intervention Successful")
        else:
             print(f"❌ Intervention Failed: {intervention['message']}")
    except Exception as e:
        print(f"❌ Sovereign Intervention Failed: {e}")

    # --- Test 5: Mission Suggestions ---
    print("\n👑 Testing Mission Generation...")
    try:
        missions = sovereign.suggest_missions()
        if missions and len(missions) > 0:
            print(f"✅ Generated {len(missions)} Missions:")
            for i, m in enumerate(missions, 1):
                print(f"  {i}. {m}")
        else:
            print("❌ No Missions Generated")
    except Exception as e:
        print(f"❌ Mission Generation Failed: {e}")

    print("\n✨ Verification Complete.")

if __name__ == "__main__":
    asyncio.run(verify_expansions())
