import asyncio
import json
from admin.engineers.copilot import Copilot


async def run_e2e_test():
    print("🚀 Starting Hardened Copilot E2E Test...")
    copilot = Copilot()

    # Session 1: Initial Query (Slot Extraction)
    print("\n--- Phase 1: Context Extraction ---")
    res1 = await copilot.execute(
        "query",
        user_input="I want to automate my newsletter using an AI agent team. Is it reversible?",
        history=[],
    )

    print(f"Extracted Slots: {json.dumps(res1['slots'], indent=2)}")
    print(f"Selected Questions: {[q['id'] for q in res1['selected_questions']]}")
    print(f"Is Verdict Ready: {res1['is_verdict_ready']}")

    # Session 2: Request Verdict
    print("\n--- Phase 2: Verdict Generation ---")
    history = [
        {
            "role": "user",
            "parts": [
                {
                    "text": "I want to automate my newsletter using an AI agent team. Is it reversible?"
                }
            ],
        },
        {
            "role": "model",
            "parts": [
                {
                    "text": "That sounds like a scaling move. Reversibility depends on your dependency level. How much manual oversight will you keep?"
                }
            ],
        },
        {
            "role": "user",
            "parts": [{"text": "Low oversight, I want it fully autonomous. Give me a verdict."}],
        },
    ]

    res2 = await copilot.execute(
        "query",
        user_input="Low oversight, I want it fully autonomous. Give me a verdict.",
        history=history,
    )

    print(f"Is Verdict Ready: {res2['is_verdict_ready']}")
    if "verdict" in res2:
        print("\n🏆 STRUCTURED VERDICT RECEIVED:")
        print(json.dumps(res2["verdict"], indent=2))

        # Validation checks
        v = res2["verdict"]
        assert "mirror" in v
        assert "risks" in v
        assert v["verdict"] in ["proceed", "pivot", "pause"]
        print("\n✅ E2E Test Passed: Verdict logic is hardened and structured.")
    else:
        print("\n❌ E2E Test Failed: No verdict produced.")


if __name__ == "__main__":
    asyncio.run(run_e2e_test())
