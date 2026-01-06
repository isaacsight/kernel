"""
Sovereign Scout - High-Fidelity Autonomous Research Agent
"""

import logging
from typing import Dict, Any, List
from admin.brain.agent_base import BaseAgent
from admin.engineers.web_scout import get_web_scout

logger = logging.getLogger("SovereignScout")


class SovereignScout(BaseAgent):
    """
    Sovereign implementation of the Research Agent.
    Wraps the upgraded WebScout logic into a DTFR-compatible Agent.
    """

    def __init__(self):
        super().__init__(agent_id="sovereign_scout")
        self.scout = get_web_scout()

    async def execute(self, task: str, **kwargs) -> Dict[str, Any]:
        """
        Execute a research task using Active Inference and Kinetic Prompts.
        """
        logger.info(f"[{self.name}] Initiating Sovereign Research: {task}")

        # Decide if this is a general search or a specific topic research
        if any(word in task.lower() for word in ["research", "topic", "deep dive"]):
            result = self.scout.research_topic(task)
        elif any(word in task.lower() for word in ["verify", "fact check", "true"]):
            result = self.scout.verify_claim(task)
        else:
            result = self.scout.search(task)

        return {
            "success": True,
            "agent": self.name,
            "data": result,
            "summary": self.scout.summarize_results(result)
            if isinstance(result, list)
            else f"Research complete for: {task}",
        }

    def run(self, input_text: str) -> str:
        """Synchronous entry point."""
        import asyncio

        result = asyncio.run(self.execute(input_text))
        return result.get("summary", "No summary available.")


# Singleton
_agent = None


def get_sovereign_scout() -> SovereignScout:
    global _agent
    if _agent is None:
        _agent = SovereignScout()
    return _agent
