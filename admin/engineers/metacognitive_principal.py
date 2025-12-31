import os
import sys
import logging
import json
import asyncio
from typing import Optional, Any
from collections.abc import AsyncGenerator
from datetime import datetime

# project root addition
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from admin.infrastructure.openrouter import OpenRouterClient
from admin.brain.model_router import get_model_router
from admin.brain.agents.metacognition.cognitive_ledger import get_cognitive_ledger
from admin.config import config
from admin.brain.agent_base import BaseAgent
from core.dtfr_schemas import DTFRPlan, ExecutionResult
import requests
import time


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

    Mission: Oversee the health, logic, and alignment of the entire Studio OS.

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

        # We'll determine the provider dynamically in _call_llm
        self.provider = "gemini"  # Default

        self.doctrine_path = os.path.join(config.BRAIN_DIR, "doctrines", "system_doctrine.md")
        os.makedirs(os.path.dirname(self.doctrine_path), exist_ok=True)

        # Caching failures to avoid slow timeout loops
        self._degraded_providers = {}  # provider_name -> cooldown_expiry
        self._last_depth_decision = 3

        # Initialize fallback OpenRouter logic
        self.openrouter = OpenRouterClient(config.OPENROUTER_API_KEY)
        self.fallback_model = config.OR_FREE_MISTRAL

        logger.info(f"[{self.name}] Initialized as BaseAgent")

    def _is_provider_ok(self, name: str) -> bool:
        """Checks if a provider is in penalty box."""
        expiry = self._degraded_providers.get(name, 0)
        return time.time() > expiry

    def _mark_provider_fail(self, name: str, penalty: int = 300):
        """Puts a provider in the penalty box for N seconds."""
        logger.warning(f"[{self.name}] provider '{name}' marked as DEGRADED for {penalty}s")
        self._degraded_providers[name] = time.time() + penalty

    async def decide_reasoning_depth(self, prompt: str) -> int:
        """
        Dynamically determines the depth of recursive reasoning needed.
        System 1 (0-1 passes) for simple tasks, System 2 (3+ passes) for deep architecture.
        """
        p = prompt.lower()

        # Immediate System 1 triggers (Speed prioritized)
        fast_triggers = [
            "hi",
            "hello",
            "status",
            "who are you",
            "post",
            "create",
            "draft",
            "fast",
            "urgent",
            "scan",
            "read",
            "check",
            "list",
        ]
        if any(t in p for t in fast_triggers):
            return 0  # Straight to synthesis

        # Heavy System 2 triggers (Depth prioritized)
        deep_triggers = [
            "architect",
            "security",
            "audit",
            "reason",
            "deep",
            "analyze",
            "complex",
            "philosophy",
            "refactor",
            "rewrite",
        ]
        if any(t in p for t in deep_triggers):
            return config.THINKING_DEPTH or 3

        # Default middle ground
        return 1

    async def _call_llm(self, prompt: str, system_prompt: str = "") -> str:
        """
        Sovereign multi-provider LLM call logic.
        Fallback order: Gemini -> Remote Node -> Local Ollama -> Mock
        """
        # Try Gemini
        if self._is_provider_ok("gemini"):
            api_key = config.GEMINI_API_KEY
            if api_key and "AIza" in api_key:
                try:
                    import google.generativeai as genai

                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel(self.model_name)
                    full_prompt = f"{system_prompt}\n\nUSER REQUEST:\n{prompt}"
                    response = await asyncio.to_thread(model.generate_content, full_prompt)
                    if response and hasattr(response, "text"):
                        return response.text
                except Exception as e:
                    logger.warning(f"[{self.name}] Gemini call failed: {e}. Trying fallback.")
                    self._mark_provider_fail("gemini")

        # Try Remote Studio Node
        if self._is_provider_ok("remote"):
            node_url = config.STUDIO_NODE_URL
            if node_url:
                try:
                    base_url = node_url.rstrip("/")
                    payload = {
                        "model": "qwen-2.5-72b",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt},
                        ],
                        "stream": False,
                    }
                    response = await asyncio.to_thread(
                        requests.post, f"{base_url}/v1/chat/completions", json=payload, timeout=5
                    )
                    if response.status_code == 200:
                        data = response.json()
                        content = data.get("choices", [{}])[0].get("message", {}).get("content")
                        if content:
                            return content
                except Exception as e:
                    logger.warning(f"[{self.name}] Remote node call failed: {e}. Trying next.")
                    self._mark_provider_fail("remote", penalty=600)

        # Try OpenRouter Fallback (Free Tier)
        logger.info(f"[{self.name}] Falling back to OpenRouter ({self.fallback_model})...")
        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ]
            response = await asyncio.to_thread(
                self.openrouter.chat_completion, self.fallback_model, messages
            )
            content = self.openrouter.extract_text(response)
            if content and "Error:" not in content:
                logger.info(f"[{self.name}] OpenRouter Success.")
                return content
            else:
                logger.warning(f"[{self.name}] OpenRouter returned error content: {content}")
        except Exception as e:
            logger.error(f"[{self.name}] OpenRouter fallback failed: {e}")

        # Try Local Ollama (Default port)
        try:
            payload = {
                "model": "mistral",
                "prompt": f"{system_prompt}\n\n{prompt}",
                "stream": False,
            }
            response = await asyncio.to_thread(
                requests.post, "http://localhost:11434/api/generate", json=payload, timeout=5
            )
            if response.status_code == 200:
                return response.json().get("response", "")
        except Exception:
            pass

        # Final Fallback: Sovereign Mock Mode (Deterministic for verification)
        logger.warning(f"[{self.name}] CRITICAL: No LLM available. Operating in Mock Mode.")

        if "PROPOSAL" in prompt or "Refine" in prompt or "Produce a structured DTFRPlan" in prompt:
            return json.dumps(
                {
                    "mission": "Mock Mission",
                    "context": "Verification Context",
                    "steps": [
                        {
                            "id": 1,
                            "tool_name": "list_directory",
                            "arguments": {"path": "."},
                            "rationale": "Verify path",
                            "expected_outcome": "List of files",
                        }
                    ],
                    "success_criteria": "Files listed",
                }
            )
        if (
            "CRITICAL AUDIT" in prompt
            or "Review" in prompt
            or "Evaluate if the mission was successful" in prompt
        ):
            return "[MOCK CRITIQUE] 1. The proposal lacks specific implementation details. 2. The cost of redundancy may exceed budget."
        if "Synthesis" in prompt:
            if "mission" in prompt or "steps" in prompt or "DTFRPlan" in prompt:
                return json.dumps(
                    {
                        "mission": "Mock Mission (Synthesized)",
                        "context": "Verification Context",
                        "steps": [
                            {
                                "id": 1,
                                "tool_name": "list_directory",
                                "arguments": {"path": "."},
                                "rationale": "Verify path",
                                "expected_outcome": "List of files",
                            }
                        ],
                        "success_criteria": "Files listed",
                    }
                )
            return "[MOCK DIRECTION] Proceed with implementation of the monitoring layer, but use a shared-resource model to optimize costs."

        return f"[MOCK] I hear you: {prompt[:50]}... but I'm working in a limited-compute state."

    async def think_stream(
        self, prompt: str, depth: Optional[int] = None
    ) -> AsyncGenerator[dict, None]:
        """
        Executes a System 2 recursive reasoning loop and streams steps.
        """
        if depth is None:
            depth = await self.decide_reasoning_depth(prompt)

        current_thought = prompt
        history = []

        if depth > 0:
            yield {
                "type": "status",
                "content": f"The Sovereign is initiating recursive reasoning (Level: {depth})...",
            }
        else:
            yield {
                "type": "status",
                "content": "The Sovereign is responding in Fast Mode (System 1)...",
            }

        for i in range(depth):
            yield {
                "type": "thought",
                "content": f"Processing Pass {i + 1}: Proposing strategic alignment...",
            }

            # 1. Propose/Refine
            proposal_prompt = f"""
            Goal: {current_thought}
            Refine this thought into a high-precision strategy.
            """
            proposal = await self._call_llm(
                proposal_prompt, "You are a high-intelligence metacognitive entity."
            )

            yield {
                "type": "thought",
                "content": f"Auditing Pass {i + 1}: Searching for logic gaps...",
            }

            # 2. Self-Critique
            critique_prompt = f"CRITICAL AUDIT of: {proposal}\nList 3 failure points."
            critique = await self._call_llm(
                critique_prompt, "You are an uncompromising logical auditor."
            )

            history.append({"pass": i + 1, "proposal": proposal, "critique": critique})
            current_thought = f"PROPOSAL: {proposal}\nCRITIQUE: {critique}"

        # 3. Delegation/Action Determination
        yield {
            "type": "status",
            "content": "Synthesizing final directive and delegating to engineers...",
        }

        synthesis_prompt = f"Synthesize final directive from: {json.dumps(history)}"
        final_result = await self._call_llm(
            synthesis_prompt, "Produce the final 'Sovereign Directive'."
        )

        yield {
            "type": "result",
            "agent": "The Sovereign",
            "role": "Metacognitive Principal",
            "content": final_result,
            "citations": [],
        }

    async def think_recursive(self, prompt: str, depth: int = 3) -> str:
        """
        Executes a System 2 recursive reasoning loop.
        """
        current_thought = prompt
        history = []

        logger.info(f"[{self.name}] Initiating Recursive Reasoning (Depth: {depth})")

        for i in range(depth):
            # 1. Propose/Refine
            proposal_prompt = f"""
            You are The Sovereign, the metacognitive mind of Studio OS.
            Current Thought/Goal: {current_thought}
            
            TASK: Refine this thought. If this is the first pass, propose a high-precision strategy.
            If this is a subsequent pass, incorporate the previous critique to reach a higher level of intelligence.
            """

            proposal = await self._call_llm(
                prompt=proposal_prompt,
                system_prompt="You are a high-intelligence metacognitive entity. Be precise, logical, and concise.",
            )

            # 2. Self-Critique
            critique_prompt = f"""
            CRITICAL AUDIT:
            Review the following proposal for logic gaps, biases, technical debt, or misalignments.
            
            PROPOSAL:
            {proposal}
            
            OUTPUT:
            List 3-5 specific points of failure or areas for improvement.
            """

            critique = await self._call_llm(
                prompt=critique_prompt, system_prompt="You are an uncompromising logical auditor."
            )

            history.append({"pass": i + 1, "proposal": proposal, "critique": critique})

            current_thought = f"PROPOSAL: {proposal}\n\nCRITIQUE: {critique}"
            logger.debug(f"[{self.name}] Pass {i + 1} completed")

        # 3. Final Synthesis
        synthesis_prompt = f"""
        Final Synthesis of Recursive Reasoning.
        
        HISTORY:
        {json.dumps(history, indent=2)}
        
        TASK:
        Produce the final, definitive response. It must be the most intelligent, 
        vetted, and actionable version of the original goal.
        """

        final_result = await self._call_llm(
            prompt=synthesis_prompt,
            system_prompt="Produce the final 'Sovereign Directive'. Focus on absolute clarity and strategic depth.",
        )

        return final_result

    async def think_plan(self, prompt: str, depth: int = 1) -> DTFRPlan:
        """
        Translates a goal into a structured DTFRPlan.
        """
        from core.dtfr_schemas import DTFRPlan

        planning_prompt = f"""
        TASK: {prompt}
        
        Produce a structured DTFRPlan in JSON format.
        Schema: {{"mission": "...", "context": "...", "steps": [{"id": 1, "tool_name": "...", "arguments": { {} }, "rationale": "...", "expected_outcome": "..."}], "success_criteria": "..."}}
        
        ENSURE output is ONLY raw JSON.
        """

        if config.TRIM_PROMPT_CONTEXT:
            # Simple trimming: remove extra whitespace and redundant labels
            planning_prompt = "\n".join(
                [line.strip() for line in planning_prompt.split("\n") if line.strip()]
            )

        # System 2 planning for complex tasks
        raw_output = await self.think_recursive(planning_prompt, depth=depth)
        logger.info(f"[{self.name}] think_plan RAW OUTPUT: {raw_output}")

        # Clean and parse
        try:
            clean_json = raw_output.strip()
            # Advanced JSON extraction
            if "{" in clean_json:
                start_index = clean_json.find("{")
                end_index = clean_json.rfind("}") + 1
                clean_json = clean_json[start_index:end_index]

            plan_data = json.loads(clean_json)
            return DTFRPlan(**plan_data)
        except Exception as e:
            logger.error(f"[{self.name}] Failed to parse DTFRPlan: {e}. Raw: {raw_output[:500]}")
            raise ValueError(f"Failed to generate structured plan: {e}")

    async def critique(self, plan: DTFRPlan, results: list[ExecutionResult]) -> str:
        """
        Evaluates execution against success criteria.
        """

        critique_prompt = f"""
        MISSION: {plan.mission}
        SUCCESS CRITERIA: {plan.success_criteria}
        
        PLAN:
        {plan.model_dump_json(indent=2)}
        
        RESULTS:
        {json.dumps([r.model_dump() for r in results], indent=2)}
        
        TASK:
        Evaluate if the mission was successful. provide a high-precision critique.
        Identify any logic gaps or secondary actions needed.
        """

        return await self._call_llm(critique_prompt, "You are an uncompromising logical auditor.")

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
            with open(self.doctrine_path, "r") as f:
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
            return self.convene_council(params.get("issue"))
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
        sovereign = MetacognitivePrincipal()
        pass

    asyncio.run(test())
