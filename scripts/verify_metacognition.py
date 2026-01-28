import asyncio
import os
import sys
import json

# Add project root to path
sys.path.append(os.getcwd())

from doe_workspace_bundle.engineers.metacognitive_principal import MetacognitivePrincipal
from admin.config import config


async def verify_research_loop():
    print("🚀 Initiating MetacognitivePrincipal Verification...")

    sovereign = MetacognitivePrincipal()

    # Define a test inquiry
    test_inquiry = "Should we adopt a 'Cognitive Governance' model for the DTFR Research IDE?"

    print(f"🧐 Inquiry: {test_inquiry}")

    # Execute the research loop (depth 2 for speed)
    directive = await sovereign.think_recursive(test_inquiry, depth=2)

    print("\n✅ Research Session Completed.")
    print(f"📜 Final Directive: {directive[:200]}...")

    # Verify Trace existence
    trace = sovereign.active_trace
    print(f"\n📊 Trace Passes: {len(trace)}")
    for p in trace:
        print(
            f"  - Pass {p['pass']}: Proposal({len(p.get('proposal', ''))}), Critique({len(p.get('critique', ''))}), Research({len(p.get('research', '')) if 'research' in p else 'N/A'})"
        )

    # Verify Persistence
    sessions_dir = os.path.join(config.BRAIN_DIR, "research_sessions")
    if os.path.exists(sessions_dir):
        files = os.listdir(sessions_dir)
        print(f"\n📁 Sessions found in {sessions_dir}:")
        for f in files:
            if f.endswith(".json"):
                print(f"  - {f}")
    else:
        print("\n❌ Sessions directory not found!")


if __name__ == "__main__":
    asyncio.run(verify_research_loop())
