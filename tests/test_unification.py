import asyncio
import json
import sys
import os

# Set project root
sys.path.append(os.getcwd())


async def test_sovereign_unification():
    print("🚀 Testing Sovereign Unification...")

    from core.team import team_orchestrator

    prompt = "Research the latest trends in AI agents and propose an essay topic."

    print(f"Prompt: {prompt}\n")

    count = 0
    async for update in team_orchestrator.delegate(prompt):
        print(f"[{update['type'].upper()}] {update.get('content', '')[:100]}...")
        if update["type"] == "result":
            print(f"\n✅ FINAL RESULT from {update['agent']} ({update['role']}):")
            print(update["content"])
        count += 1
        if count > 10:
            break  # Safety exit for test

    print("\n✨ Test Complete.")


if __name__ == "__main__":
    asyncio.run(test_sovereign_unification())
