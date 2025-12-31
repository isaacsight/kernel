import asyncio
import json
from admin.engineers.copilot import Copilot


async def verify_stack():
    print("🚀 Initializing DTFR Answer Engine Stack...")
    copilot = Copilot()

    queries = [
        ("search", "What is the capital of France?"),
        ("research", "Compare React vs Vue in 2025. Which is better for large scale apps?"),
        ("reasoning", "Why might a central bank raise interest rates during inflation?"),
        ("academic", "Find recent papers on Agentic AI and summarize key themes."),
    ]

    for mode, q in queries:
        print(f"\n--- Testing Mode: {mode.upper()} ---")
        print(f"Query: {q}")

        full_answer = ""
        sources_received = 0
        related_received = 0

        async for packet in copilot.evaluate(q, mode=mode):
            p_type = packet.get("type")
            if p_type == "thought":
                print(f"Thought: {packet['content']}")
            elif p_type == "sources":
                sources_received = len(packet["content"])
                print(f"Sources: {sources_received} found.")
            elif p_type == "chunk":
                full_answer += packet["content"]
            elif p_type == "related":
                related_received = len(packet["content"])
                print(f"Related Questions: {related_received} generated.")
            elif p_type == "done":
                print("Done.")

        print(f"Answer Length: {len(full_answer)}")
        print(f"Snapshot: {full_answer[:100]}...")

        # Basic Assertions
        assert len(full_answer) > 0, "Answer should not be empty"
        if mode in ("search", "research", "academic"):
            assert sources_received > 0, f"Mode {mode} should have sources"
        assert related_received > 0, "Should have related questions"

    print("\n✅ Verification Complete! Stack is operational.")


if __name__ == "__main__":
    asyncio.run(verify_stack())
