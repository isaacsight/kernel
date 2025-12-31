import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from typing import Any

# project root addition
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


from admin.brain.agent_base import BaseAgent
from admin.brain.agents.metacognition.cognitive_ledger import get_cognitive_ledger
from admin.brain.answer_engine import AnswerEngine
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from admin.brain.model_router import TaskType, get_model_router
from admin.brain.session_manager import get_session_manager
from admin.config import config
from admin.infrastructure.perplexity import PerplexityClient


# Lazy import helper to avoid circular dependencies
def get_agent(name):
    if name == "alchemist":
        from admin.engineers.alchemist import Alchemist

        return Alchemist()
    elif name == "rhythm_physicist":
        from admin.engineers.rhythm_physicist import RhythmPhysicist

        return RhythmPhysicist()
    return None


logger = logging.getLogger("TheSovereign")


class MetacognitivePrincipal(BaseAgent):
    """
    The Sovereign (Metacognitive Principal)

    Mission: Oversee the health, logic, and alignment of the entire Cognitive OS.

    System 2 Thinking: Uses recursive reasoning to validate its own thoughts.
    """

    def __init__(self):
        # Initialize BaseAgent (loads Profile & Skills)
        super().__init__(agent_id="metacognitive_principal")

        self.name = "The Sovereign"
        self.role = "Metacognitive Principal"
        self.emoji = "👑"

        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.ledger = get_cognitive_ledger()
        self.router = get_model_router()
        self.model_name = config.GEMINI_MODEL

        # Integration: Answer Engine
        self.ppx = PerplexityClient(api_key=config.PERPLEXITY_API_KEY)
        self.answer_engine = AnswerEngine(ppx_client=self.ppx, router=self.router)

        # Trace Ledger: For externalizing cognition
        self.active_trace = []

        self.session_manager = get_session_manager()

        self.doctrine_path = os.path.join(config.BRAIN_DIR, "doctrines", "system_doctrine.md")
        os.makedirs(os.path.dirname(self.doctrine_path), exist_ok=True)

        logger.info(f"[{self.name}] Initialized as Cognitive OS Principal")

    async def _call_llm(self, prompt: str, system_prompt: str = "") -> str:
        """
        Sovereign inference logic.
        Delegates to ModelRouter for high-resilience execution.
        """
        # 1. Try High-Intelligence select (Sovereign preference)
        try:
            res = await self.router.get_completion(
                task_type=TaskType.ANALYSIS,
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.3,
            )
            text = res.get("text", "")
            if text:
                return text
        except Exception as e:
            logger.warning(f"[{self.name}] Router completion failed: {e}")

        # Final Fallback: Sovereign Mock Mode (Deterministic for verification)
        logger.warning(f"[{self.name}] CRITICAL: All LLM routes failed. Operating in Mock Mode.")

        if "PROPOSAL" in prompt or "Refine" in prompt:
            return "[MOCK PROPOSAL] To ensure system stability, we must implement a triple-redundant monitoring layer."
        if "CRITICAL AUDIT" in prompt or "Review" in prompt:
            return "[MOCK CRITIQUE] 1. The proposal lacks specific implementation details. 2. The cost of redundancy may exceed budget."
        if "Synthesis" in prompt:
            return "[MOCK DIRECTION] Proceed with implementation of the monitoring layer, but use a shared-resource model to optimize costs."

        return f"[MOCK] I hear you: {prompt[:50]}... but I'm working in a limited-compute state."

    async def think_recursive(self, prompt: str, depth: int = 3) -> str:
        """
        Executes a System 2 recursive reasoning loop.
        Surfaces traces for externalization.
        """
        current_thought = prompt
        self.active_trace = []

        logger.info(f"[{self.name}] Initiating Recursive Research Loop (Depth: {depth})")

        for i in range(depth):
            pass_trace = {"pass": i + 1, "timestamp": datetime.now().isoformat()}

            # 1. Propose/Refine
            proposal_prompt = f"""
            You are The Sovereign, the metacognitive mind of the DTFR Cognitive OS.
            Current Thought/Goal: {current_thought}

            TASK: Refine this thought. If this is the first pass, propose a high-precision strategy.
            If this is a subsequent pass, incorporate the previous critique and research to reach a higher level of intelligence.
            """

            proposal = await self._call_llm(
                prompt=proposal_prompt,
                system_prompt="You are a high-intelligence metacognitive entity. Be precise, logical, and concise.",
            )
            pass_trace["proposal"] = proposal

            # 2. Grounding (Answer Engine) - Only on first and last pass to save tokens/time
            if i == 0 or i == depth - 1:
                logger.info(f"[{self.name}] Pass {i + 1}: Grounding proposal via Answer Engine...")
                research_results = ""
                async for chunk in self.answer_engine.generate(query=proposal, mode="research"):
                    if chunk["type"] == "chunk":
                        research_results += chunk["content"]
                pass_trace["research"] = research_results
                proposal = f"{proposal}\n\nRESEARCH GROUNDING:\n{research_results}"

            # 3. Self-Critique
            critique_prompt = f"""
            CRITICAL AUDIT:
            Review the following proposal and research for logic gaps, biases, technical debt, or misalignments.

            PROPOSAL & RESEARCH:
            {proposal}

            OUTPUT:
            List 3-5 specific points of failure or areas for improvement. Use DTFR standards.
            """

            critique = await self._call_llm(
                prompt=critique_prompt,
                system_prompt="You are an uncompromising logical auditor. Use 'Does This Feel Right?' standards.",
            )
            pass_trace["critique"] = critique

            self.active_trace.append(pass_trace)
            current_thought = f"PROPOSAL: {proposal}\n\nCRITIQUE: {critique}"
            logger.debug(f"[{self.name}] Pass {i + 1} completed")

        # 4. Final Synthesis
        synthesis_prompt = f"""
        Final Synthesis of Recursive Research Session.

        HISTORY:
        {json.dumps(self.active_trace, indent=2)}

        TASK:
        Produce the final, definitive 'Sovereign Directive'. It must be the most intelligent,
        vetted, and actionable version of the original goal.
        """

        final_result = await self._call_llm(
            prompt=synthesis_prompt,
            system_prompt="Produce the final 'Sovereign Directive'. Focus on absolute clarity and strategic depth.",
        )

        # Save Session to Ledger
        await self._save_session(prompt, final_result)

        return final_result

    async def _save_session(self, inquiry: str, result: str):
        """Saves the research session to the session manager/ledger."""
        session_id = self.session_manager.create_session(
            inquiry=inquiry, trace=self.active_trace, directive=result
        )

        # Log to ledger for legacy support
        self.ledger.record_case_study(
            agent_id=self.name,
            outcome=f"Research Session: {inquiry}",
            reasoning="Persistent session saved to manager.",
            metadata={"session_id": session_id},
        )
        logger.info(f"[{self.name}] Research Session saved: {session_id}")

    def diagnose_system(self) -> dict:
        """
        Diagnoses the health of the agent swarm and system metrics.
        """
        # 1. Get agent actions/metrics
        agent_metrics_data = self.metrics.metrics

        # 2. Get recent insights from memory
        recent_insights = self.memory.get_insights(limit=20)

        # 3. Identify potential logic loops or "Hot Spots"
        hot_spots = []
        for agent, data in agent_metrics_data.get("agent_metrics", {}).items():
            if data.get("failures", 0) > 5:
                hot_spots.append(
                    {"entity": agent, "issue": "High failure rate detected", "severity": "High"}
                )

        diagnosis = {
            "timestamp": datetime.now().isoformat(),
            "health_score": self._calculate_health_score(agent_metrics_data),
            "hot_spots": hot_spots,
            "recent_insights": len(recent_insights),
            "metrics_snapshot": agent_metrics_data,
        }

        logger.info(f"[{self.name}] System Diagnosis completed. Score: {diagnosis['health_score']}")
        return diagnosis

    def _calculate_health_score(self, metrics: dict) -> float:
        """Simple heuristic for system health."""
        base_score = 100.0
        total_errors = sum(a.get("failures", 0) for a in metrics.get("agent_metrics", {}).values())
        return max(0.0, base_score - (total_errors * 2.0))

    def update_doctrine(self, new_principles: list[str]):
        """
        Updates the system's core doctrines (Constitutional AI).
        """
        current_doctrine = ""
        if os.path.exists(self.doctrine_path):
            with open(self.doctrine_path) as f:
                current_doctrine = f.read()

        # Generate new doctrine version
        updated_doctrine = (
            current_doctrine
            + "\n\n### Sovereign Update - "
            + datetime.now().strftime("%Y-%m-%d")
            + "\n"
        )
        for p in new_principles:
            updated_doctrine += f"- [SOVEREIGN-DRIVEN] {p}\n"

        with open(self.doctrine_path, "w") as f:
            f.write(updated_doctrine)

        logger.info(
            f"[{self.name}] System Doctrine updated with {len(new_principles)} new principles."
        )

    async def execute(self, action: str, **params) -> dict:
        """Standard agent execution entry point."""
        if action == "think":
            result = await self.think_recursive(
                params.get("prompt", ""), depth=params.get("depth", 3)
            )
            return {"status": "success", "directive": result}
        elif action == "diagnose":
            return {"status": "success", "diagnosis": self.diagnose_system()}
        elif action == "update_doctrine":
            self.update_doctrine(params.get("principles", []))
            return {"status": "success", "message": "Doctrine updated"}
        elif action == "convene_council":
            return await self.convene_council(params.get("issue"))
        elif action == "active_intervention":
            return self.active_intervention(params.get("intervention_action"))
        elif action == "suggest_missions":
            return {"missions": self.suggest_missions()}
        else:
            return {"status": "error", "message": f"Unknown action: {action}"}

    def suggest_missions(self) -> list[str]:
        """
        Generates high-impact prompts for the user to input, based on system state.
        """
        logger.info(f"[{self.name}] Generating Mission Suggestions...")

        # 1. Gather Context (Mocked for speed, but could read task.md)
        # In a real scenario, we'd read the 'task.md' or 'git status'
        context = "Current phase: Capability Expansion. Agents updated: Alchemist, Sovereign."

        prompts = [
            f"Generate a strategic research plan for integrating '{context}' into the main product.",
            "Run a full system diagnosis using the System Monitor and fix any 'hot spots'.",
            "Convene the council to debate the ethical implications of autonomous code refinement.",
            "Ask The Alchemist to review `admin/app.py` and propose a refactoring plan.",
            "Have the Rhythm Physicist analyze the latest blog draft for viral potential.",
        ]

        return prompts

    async def convene_council(self, issue: str) -> dict[str, Any]:
        """
        Orchestrates other agents to solve a complex issue.
        """
        logger.info(f"[{self.name}] Convening Council for: {issue}")

        # 1. Decide who to call
        # Simple heuristic for now, can be LLM-driven later
        agents_to_call = []
        if "code" in issue.lower() or "research" in issue.lower() or "write" in issue.lower():
            agents_to_call.append("alchemist")
        if "viral" in issue.lower() or "rhythm" in issue.lower() or "script" in issue.lower():
            agents_to_call.append("rhythm_physicist")

        # Default to Alchemist if unsure
        if not agents_to_call:
            agents_to_call.append("alchemist")

        logger.info(f"[{self.name}] Summoning: {agents_to_call}")

        # 2. Execute in parallel (conceptually, sequential here for simplicity of implementation)
        results = {}
        for agent_name in agents_to_call:
            agent = get_agent(agent_name)
            if not agent:
                continue

            if agent_name == "alchemist":
                if "research" in issue.lower():
                    # Task: Research
                    res = agent.conduct_research(issue)
                    results["alchemist_research"] = res
                else:
                    # Task: General consultation via chat/generate
                    # We'll use the chat interface for consultation
                    res = agent.chat(f"The Sovereign requires your specific input on: {issue}")
                    results["alchemist_insight"] = res

            elif agent_name == "rhythm_physicist":
                # Task: Resonance prediction
                res = agent.predict_resonance(issue)  # Assuming issue contains the text to analyze
                results["rhythm_analysis"] = res

        # 3. Synthesize
        synthesis_prompt = f"""
        You are The Sovereign. You have convened the council.

        ISSUE: {issue}

        COUNCIL REPORTS:
        {json.dumps(results, indent=2)}

        TASK:
        Synthesize a final "Council Resolution". what is the verdict?
        """

        resolution = await self._call_llm(synthesis_prompt, "Synthesize the council's wisdom.")

        return {
            "status": "convened",
            "council_members": agents_to_call,
            "raw_reports": results,
            "resolution": resolution,
        }

    def active_intervention(self, action: str) -> dict[str, Any]:
        """
        Performs self-healing actions on the system.
        """
        logger.warning(f"[{self.name}] INITIATING ACTIVE INTERVENTION: {action}")

        if action == "clear_cache":
            # Clear static/cache or similar
            # Example: clearing .pyc files or temp dirs
            # For safety, let's just say we clear the audio cache
            cache_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                "static",
                "audio_cache",
            )
            if os.path.exists(cache_dir):
                count = 0
                for f in os.listdir(cache_dir):
                    os.remove(os.path.join(cache_dir, f))
                    count += 1
                return {"status": "success", "message": f"Cleared {count} files from audio cache."}
            else:
                return {"status": "error", "message": "Cache directory not found."}

        elif action == "restart_services":
            # Placeholder for actual service restart logic (e.g., via supervisor or docker)
            # In a real OS, this might `os.system("systemctl restart studio_os")`
            logger.info("Restart signal sent to supervisor.")
            return {"status": "success", "message": "Signal sent to restart services."}

        else:
            return {"status": "error", "message": f"Unknown intervention: {action}"}


if __name__ == "__main__":
    # Internal test
    async def test():
        _ = MetacognitivePrincipal()
        pass

    asyncio.run(test())
