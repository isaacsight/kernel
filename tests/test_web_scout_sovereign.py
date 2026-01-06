import sys
import os
import asyncio
import logging

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.web_scout import WebScout


async def test_sovereign_search():
    logging.basicConfig(level=logging.INFO)
    scout = WebScout()

    print("\n[Test 1] Standard Search (Low Surprise)")
    results = scout.search("latest news on generative AI")
    print(f"Results found: {len(results)}")

    print("\n[Test 2] Technical Search (Kinetic Prompt Injection)")
    # This should trigger kinetic prompt injection due to "architecture" keyword
    results = scout.search("transformer model architecture paper")
    print(f"Results found: {len(results)}")

    print("\n[Test 3] Active Inference (High Surprise Simulation)")
    # Force a search that returns 0 results to see the surprise reaction
    # (assuming we use a non-existent provider or a query that fails)
    # Since we can't easily mock network here, we'll just check if the mindset observes surprise correctly
    observation = scout.mindset.observe("impossible query 123456789", [])
    print(f"Observation: {observation}")

    if observation["high_surprise"]:
        print("PASS: High surprise detected for 0-result search.")
    else:
        print("FAIL: High surprise not detected.")


if __name__ == "__main__":
    asyncio.run(test_sovereign_search())
