import logging
import asyncio
import json
from typing import List, Dict, Any, Optional, AsyncGenerator
from dtfr.schemas import Mode
from admin.brain.model_router import ModelRouter, TaskType

PLANNING_PROMPT = """You are the Mission Architect for the Sovereign Laboratory.
Your objective is to decompose the user's inquiry into a set of 2-4 specialized, orthogonal sub-tasks.
Each task must have a specific domain agent (Researcher, SystemsAnalyst, Critic, or Strategist) and a rigorous objective.

Output MUST be valid JSON:
{
    "mission_id": "...", 
    "tasks": [
        {"agent": "Researcher|SystemsAnalyst|Critic|Strategist", "objective": "Verifiable task description"}
    ]
}

Query: {query}
Mode: {mode}
"""

class MissionOrchestrator:
    """
    High-level orchestrator for the Sovereign Laboratory.
    Decomposes user inquiries into actionable missions and manages a swarm of specialized sub-agents.
    """

    def __init__(self, answer_engine, router: Optional[ModelRouter] = None):
        self.engine = answer_engine
        self.router = router or ModelRouter()

    async def execute_mission(self, query: str, mode: str = "research") -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes a complex mission by spawning sub-agents and synthesizing results.
        Includes a 0.001% UX 'Problem Reframing' layer.
        """
        # 1. Problem Reframing & Mission Planning
        yield {"type": "thought", "content": "Behavioral Analyst: Searching for surface-level assumptions..."}
        
        # UX Hardening: Check if we need to reframe
        reframed_query = await self._reframe_problem(query)
        if reframed_query != query:
            yield {"type": "thought", "content": f"Problem Reframed: Shifting focus from symptom to core need..."}
            yield {"type": "reframe", "original": query, "reframed": reframed_query}
            query = reframed_query

        yield {"type": "thought", "content": "Mission Architect: Decomposing inquiry into orthogonal tasks..."}
        plan = await self._plan_mission(query, mode)
        yield {"type": "plan", "content": plan}

        # 2. Swarm Execution
        yield {"type": "thought", "content": f"Spawning autonomous swarm: {len(plan['tasks'])} sub-agents deploying..."}
        
        # Parallel execution of tasks
        tasks = [self._run_task(task) for task in plan['tasks']]
        swarm_results = await asyncio.gather(*tasks)
        
        # 3. Conflict Resolution & Synthesis
        yield {"type": "thought", "content": "Retrieval complete. Senior Systems Analyst: Synthesizing final verdict..."}
        final_synthesis = await self._synthesize_swarm(query, swarm_results)
        
        yield {"type": "chunk", "content": final_synthesis}
        yield {"type": "done", "full_content": final_synthesis}

    async def _reframe_problem(self, query: str) -> str:
        """
        0.001% UX Layer: Question if the stated problem is the actual problem.
        """
        reframing_prompt = f"""You are a 0.001% UX Strategist. 
Analyze this user request: "{query}"

Standard designers solve the request. Elite designers solve the NEED.
If the request is surface-level (e.g., 'make this faster', 'change this color'), REFRAME it to the underlying objective (e.g., 'reduce cognitive load', 'increase trust').

If no reframing is needed, return the original query.
Otherwise, return the reframed query.

Reframed Query:"""
        
        res = await self.router.get_completion(
            TaskType.ANALYSIS,
            prompt=reframing_prompt,
            system_prompt="You do not solve symptoms. You solve systems."
        )
        return res.get("text", query).strip()

    async def _plan_mission(self, query: str, mode: str) -> Dict[str, Any]:
        """
        Uses a model to decompose the query into sub-tasks.
        """
        res = await self.router.get_completion(
            TaskType.ANALYSIS,
            prompt=PLANNING_PROMPT.format(query=query, mode=mode),
            system_prompt="You are a 0.001% System Architect. Precision and orthogonality are your signatures."
        )
        
        try:
            text = res.get("text", "{}")
            start = text.find("{")
            end = text.rfind("}") + 1
            return json.loads(text[start:end])
        except Exception as e:
            logger.error(f"Planning failed: {e}")
            return {"mission_id": "ERROR", "tasks": [{"agent": "Researcher", "objective": query}]}

    async def _run_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs a specific sub-agent task using the AnswerEngine for grounding.
        """
        logger.info(f"Running task: {task}")
        
        findings = ""
        # We reuse the AnswerEngine for the 'Researcher' task to get grounded data
        if "Researcher" in task.get("agent", ""):
            async for step in self.engine.generate(task["objective"], mode="search"):
                if step["type"] == "done":
                    findings = step["full_content"]
        else:
            # For other agents, we use a high-precision reasoning call
            res = await self.router.get_completion(
                TaskType.ANALYSIS,
                prompt=f"Execute this task with extreme detail and cite sources if applicable: {task['objective']}",
                system_prompt=f"You are the {task['agent']} agent in a 0.001%-tier engineering firm. Be rigorous, clinical, and data-driven."
            )
            findings = res.get("text", "")

        return {"task": task, "status": "completed", "findings": findings}

    async def _synthesize_swarm(self, query: str, swarm_results: List[Dict]) -> str:
        """
        Blends all sub-agent findings into a cohesive Sovereign Verdict.
        Uses the 'Senior Systems Analyst' 0.001% persona.
        """
        combined_context = ""
        for res in swarm_results:
            combined_context += f"--- FINDINGS FROM {res['task']['agent']} ---\n{res['findings']}\n\n"

        system_prompt = """You are a Senior Systems Analyst (Top 0.001%).
Your signature is 'Extreme Clarity'.
Your structure MUST be:
1. Executive Summary (High-level verdict)
2. Evidence Consolidation (Strictly data-driven extracted from the sub-agent findings)
3. Conflict Resolution (Address any discrepancies between Researcher/Critic)
4. Final Strategic Verdict (The 'So What?')
5. Source Traceability.

Maintain an authoritative, clinical, yet helpful tone."""

        res = await self.router.get_completion(
            TaskType.ANALYSIS,
            prompt=f"Query: {query}\n\nAggregate Findings from Swarm Agents:\n{combined_context}\n\nSynthesize the final verdict.",
            system_prompt=system_prompt
        )
        return res.get("text", "Synthesis failed.")

def get_mission_orchestrator():
    """
    Factory function to initialize the MissionOrchestrator with all dependencies.
    """
    from admin.brain.model_router import get_model_router
    from admin.infrastructure.perplexity import PerplexityClient
    from admin.config import config
    from dtfr.router_adapter import RouterAdapter
    from dtfr.answer_engine import AnswerEngine
    from dtfr.search.providers.brave_provider import BraveProvider
    from dtfr.search.providers.perplexity_provider import PerplexityProvider

    router = get_model_router()
    ppx_client = PerplexityClient(api_key=config.PERPLEXITY_API_KEY)
    adapter = RouterAdapter(router, ppx_client=ppx_client)
    
    providers = []
    if config.BRAVE_API_KEY:
        providers.append(BraveProvider(api_key=config.BRAVE_API_KEY))
    if config.PERPLEXITY_API_KEY:
        providers.append(PerplexityProvider(ppx_client))
        
    engine = AnswerEngine(adapter, providers=providers)
    return MissionOrchestrator(engine, router=router)
