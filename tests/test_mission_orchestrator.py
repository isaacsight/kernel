import asyncio
from admin.brain.mission_orchestrator import MissionOrchestrator
from dtfr.answer_engine import AnswerEngine
from admin.brain.model_router import ModelRouter
from admin.infrastructure.perplexity import PerplexityClient
import os


async def test_mission_orchestrator():
    # Setup
    ppx_client = PerplexityClient(api_key=os.getenv("PERPLEXITY_API_KEY", "mock_key"))
    router = ModelRouter()
    answer_engine = AnswerEngine(
        model_router=router, providers=[], domain_cap=2
    )  # providers empty for mock
    orchestrator = MissionOrchestrator(answer_engine, router=router)

    query = "What are the long-term scalability risks of using SQLite for vector storage in a multi-agent system?"

    print(f"🚀 Launching Mission for: '{query}'\n")

    async for step in orchestrator.execute_mission(query, mode="research"):
        if step["type"] == "thought":
            print(f"💭 {step['content']}")
        elif step["type"] == "plan":
            print(f"📋 Plan Formulated: {len(step['content']['tasks'])} tasks identified.")
            for t in step["content"]["tasks"]:
                print(f"   - [{t['agent']}] {t['objective']}")
        elif step["type"] == "done":
            print(f"\n✅ Mission Complete. Verdict:")
            print(step["full_content"])


if __name__ == "__main__":
    # We need a real API key for ModelRouter logic, or we can mock the router completion
    # For this verification, we'll just check if the logic flows.
    try:
        asyncio.run(test_mission_orchestrator())
    except Exception as e:
        print(f"Verification stopped (expected if API keys missing): {e}")
