import asyncio
import logging
import os
import sys
from typing import Dict, Any, List

# Add parent directory to path to allow running as a script
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.engineers.alchemist import Alchemist
from admin.engineers.researcher import Researcher
from admin.engineers.beta_tester import BetaTester
from admin.engineers.operator import Operator
from admin.brain.memory_store import get_memory_store

logger = logging.getLogger("FrontierTeam")

class FrontierTeam:
    """
    Orchestrator for the Frontier Team (Alchemist, Researcher, Beta Tester, Operator).
    """
    def __init__(self):
        self.alchemist = Alchemist()
        self.researcher = Researcher()
        self.beta_tester = BetaTester()
        self.operator = Operator()
        self.memory = get_memory_store()
        
    async def solve_task(self, task_description: str) -> Dict[str, Any]:
        """
        Solved a complex task by orchestrating the team.
        """
        logger.info(f"[FrontierTeam] Starting task: {task_description}")
        
        # 1. Research phase
        logger.info("[FrontierTeam] Step 1: Researcher gathering intelligence...")
        research_result = await self.researcher.execute("research", topic=task_description)
        research_summary = research_result.get("summary", "No research found.")
        
        await asyncio.sleep(10) # Prevent rate limiting
        
        # 2. Implementation proposal / Generation phase
        logger.info("[FrontierTeam] Step 2: Alchemist proposing implementation...")
        # Alchemist's generate is not async in the current file, but we should await it if we wrap it
        # For now, let's call it synchronously or wrap in executor if needed.
        # Alchemist.execute is async though!
        alchemist_result = await self.alchemist.execute("generate", topic=task_description, context=research_summary)
        content = alchemist_result.get("content", "Failed to generate content.")
        
        await asyncio.sleep(10) # Prevent rate limiting
        # 3. Quality Assurance phase
        logger.info("[FrontierTeam] Step 3: Beta Tester reviewing output...")
        review_result = await self.beta_tester.execute("review", artifact_type="content", content=content)
        
        # 4. Operator phase (Conditional/Simulated for now)
        # In a real workflow, this would wait for a "Does this feel right?" yes.
        logger.info("[FrontierTeam] Step 4: Operator preparing application (simulated)...")
        operator_status = "awaiting_approval"
        if review_result.get("confidence_score", 0) > 0.9 and review_result.get("blocker_status") == "LOWERED":
             # Auto-apply for high confidence? Or log as ready.
             operator_status = "ready_top_apply"
        
        # 5. Decision Capture
        logger.info("[FrontierTeam] Step 5: Logging decision point...")
        self.memory.save_decision(
            topic=task_description,
            decision="pending",
            context=f"Research: {research_summary[:100]}...\nContent: {content[:100]}...",
            agent_id="frontier_team",
            metadata={
                "research_status": research_result.get("status"),
                "review_confidence": review_result.get("confidence_score"),
                "blocker_status": review_result.get("blocker_status"),
                "operator_status": operator_status
            }
        )
        
        return {
            "task": task_description,
            "research": research_summary,
            "content": content,
            "review": review_result,
            "operator": {"status": operator_status},
            "status": "completed_pending_review"
        }

if __name__ == "__main__":
    # Test orchestration
    async def test():
        team = FrontierTeam()
        result = await team.solve_task("The impact of local LLMs on developer productivity")
        print("\n--- TASK COMPLETED ---")
        print(f"Review confidence: {result['review']['confidence_score']}")
        print(f"Summary: {result['review']['summary']}")
        
    asyncio.run(test())
