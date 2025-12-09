from .agents import ROSTER, Agent
from typing import Dict, List, AsyncGenerator
import asyncio

class FrontierTeam:
    def __init__(self):
        self.agents = ROSTER
        
    async def delegate(self, prompt: str) -> AsyncGenerator[Dict, None]:
        """
        Analyzes the prompt and delegates to the right agent. 
        Streams updates (Comet-style) back to the caller.
        """
        
        # 1. Router (Simulated) - Decide who should handle this
        # For now, default to Researcher for everything unless strictly code
        target_agent_key = "researcher" 
        if "system" in prompt.lower() or "latency" in prompt.lower():
            target_agent_key = "architect"
            
        agent: Agent = self.agents[target_agent_key]
        
        # 2. Stream "Thinking" Event
        yield {
            "type": "status",
            "content": f"Assigning task to {agent.name} ({agent.role})..."
        }
        await asyncio.sleep(0.5) 
        
        yield {
            "type": "thought",
            "content": f"{agent.name} is browsing the web for context..."
        }
        
        # 3. Execution (Simulated Async work)
        result = await agent.execute(prompt)
        
        # 4. Stream "Result" Event
        yield {
            "type": "result",
            "agent": result["agent"],
            "role": result["role"],
            "content": result["response"],
            "citations": result["citations"]
        }

team_orchestrator = FrontierTeam()
