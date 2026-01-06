import asyncio
import os
from admin.brain.answer_engine import AnswerEngine
from admin.infrastructure.perplexity import PerplexityClient
from admin.brain.model_router import get_model_router


async def test_deep_research_mode():
    print("🚀 Initiating Deep Research Mode Verification...")

    # Mock Perplexity Client (not used in bypass mode for synthesis)
    ppx = PerplexityClient(api_key=os.environ.get("PERPLEXITY_API_KEY", "mock_key"))
    engine = AnswerEngine(ppx)

    query = "Analyze the architecture of the grounding engine and suggest improvements based on the SL-OS directives."
    mode = "deep_research"

    print(f"Query: {query}")
    print(f"Mode: {mode}")

    async for step in engine.generate(query, mode=mode):
        if step["type"] == "thought":
            print(f"💭 {step['content']}")
        elif step["type"] == "sources":
            print(f"📚 Found {len(step['content'])} sources (including Full System Context).")
        elif step["type"] == "chunk":
            # Print first few chars to verify synthesis
            print(f"✍️ Chunk received (len: {len(step['content'])})")
        elif step["type"] == "done":
            print("\n✅ Deep Research Synthesis Complete.")
            print(f"Full Length: {len(step['full_content'])} characters.")


if __name__ == "__main__":
    asyncio.run(test_deep_research_mode())
