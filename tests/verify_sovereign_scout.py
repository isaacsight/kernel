import sys
import os
import asyncio
import logging
import json

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.command_router import route_and_log


async def verify_agent_routing():
    logging.basicConfig(level=logging.INFO)

    test_queries = [
        "sovereign_research: latest trends in autonomous agent architecture",
        "Research the impact of LLMs on operating system design",
    ]

    for query in test_queries:
        print(f"\n--- Testing Query: {query} ---")
        result = await route_and_log(query)
        print(f"Routed to: {result.get('routed_to')}")
        print(f"Action: {result.get('action')}")
        print(f"Message: {result.get('message')}")
        print(f"Success: {result.get('success')}")

        if result.get("success"):
            print("PASS: Agent successfully invoked and responded.")
        else:
            print(f"FAIL: {result.get('error', 'Unknown error')}")


if __name__ == "__main__":
    asyncio.run(verify_agent_routing())
