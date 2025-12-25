import asyncio
import os
import sys
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VerifySovereign")

# Ensure project root is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from admin.engineers.metacognitive_principal import MetacognitivePrincipal
from admin.config import config

async def main():
    print("--- 👑 THE SOVEREIGN: VALIDATION PROTOCOL 👑 ---")
    
    # 1. Initialize
    print("\n[STEP 1] Initializing The Sovereign...")
    sovereign = MetacognitivePrincipal()
    print(f"Sovereign initialized. BaseAgent ID: {sovereign.agent_id}")
    
    # 2. Diagnose System
    print("\n[STEP 2] Running System Diagnosis...")
    diagnosis = sovereign.diagnose_system()
    print(f"Health Score: {diagnosis['health_score']}")
    print(f"Hot Spots Identified: {len(diagnosis['hot_spots'])}")
    for spot in diagnosis['hot_spots']:
        print(f"  - {spot['entity']}: {spot['issue']} ({spot['severity']})")

    # 3. Recursive Reasoning (System 2)
    print("\n[STEP 3] Testing Recursive Reasoning (System 2)...")
    print("Prompt: 'How should we handle a scenario where 3 agents fail simultaneously?'")
    
    # Using small depth for faster verification
    directive = await sovereign.think_recursive(
        prompt="How should we handle a scenario where 3 agents fail simultaneously?",
        depth=2
    )
    
    print("\n--- FINAL SOVEREIGN DIRECTIVE ---")
    print(directive)
    print("---------------------------------")

    # 4. Doctrine Update
    print("\n[STEP 4] Testing Doctrine Update...")
    sovereign.update_doctrine([
        "Agents must favor local inference if latency exceeds 500ms.",
        "Metacognitive audits are mandatory after every 100 agent generations."
    ])
    
    if os.path.exists(sovereign.doctrine_path):
        print(f"Doctrine file updated at: {sovereign.doctrine_path}")
        with open(sovereign.doctrine_path, 'r') as f:
            lines = f.readlines()
            print(f"Last 5 lines of doctrine:\n{''.join(lines[-5:])}")
    
    # 5. Cognitive Ledger
    print("\n[STEP 5] Recording Case Study in Ledger...")
    sovereign.ledger.record_case_study(
        agent_id="verify_script",
        outcome="Verification complete",
        reasoning="All core Sovereign methods called and validated.",
        metadata={"mode": "validation"}
    )
    print("Case study recorded in ledger.")

    print("\n--- ✅ VALIDATION COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(main())
