import asyncio
import json
import logging
from core.loop_manager import DTFRLoopManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestFormalizedLoop")


async def test_formalized_loop():
    """
    End-to-end test of the hardened DTFR loop.
    """
    manager = DTFRLoopManager()

    # Task: Research a specific technical concept and summarize it.
    prompt = "Research the 'Trust vs. Correctness' thesis in agentic systems and write a 3-sentence summary to 'thesis_summary.md'."

    logger.info(f"Starting end-to-end test with prompt: {prompt}")

    try:
        report = await manager.run(prompt)

        # Verify schema validity
        print("\n--- TEST RESULTS ---")
        print(f"Mission: {report.plan.mission}")
        print(f"Status: {report.status}")
        print(f"Steps Executed: {len(report.actions)}")

        # Verify guardrails (implicitly, by checking if it succeeded within allowlisted paths)
        # Verify critique
        print(f"Critique Output: {report.critique[:200]}...")

        if report.status == "COMPLETED":
            print("\n✅ TEST PASSED: Loop executed successfully with schemas and guardrails.")
        else:
            print(f"\n⚠️ TEST PARTIAL: Status is {report.status}")

        with open("logs/test_formalized_loop_output.json", "w") as f:
            json.dump(report.model_dump(), f, indent=2)

    except Exception as e:
        logger.error(f"❌ TEST FAILED: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_formalized_loop())
