import os
import sys
import logging
import json
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime

# project root addition
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from admin.brain.model_router import get_model_router
from admin.brain.agents.metacognition.cognitive_ledger import get_cognitive_ledger
from admin.config import config
from admin.brain.agent_base import BaseAgent
import requests

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
        self.provider = "gemini" # Default
        
        self.doctrine_path = os.path.join(config.BRAIN_DIR, "doctrines", "system_doctrine.md")
        os.makedirs(os.path.dirname(self.doctrine_path), exist_ok=True)
        
        logger.info(f"[{self.name}] Initialized as BaseAgent")

    async def _call_llm(self, prompt: str, system_prompt: str = "") -> str:
        """
        Sovereign multi-provider LLM call logic.
        Fallback order: Gemini -> Remote Node -> Local Ollama -> Mock
        """
        # Try Gemini
        api_key = config.GEMINI_API_KEY
        if api_key and "AIza" in api_key: # Basic check for key presence
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel(self.model_name)
                full_prompt = f"{system_prompt}\n\nUSER REQUEST:\n{prompt}"
                response = await asyncio.to_thread(model.generate_content, full_prompt)
                if response and hasattr(response, 'text'):
                    return response.text
            except Exception as e:
                logger.warning(f"[{self.name}] Gemini call failed: {e}. Trying fallback.")

        # Try Remote Studio Node
        node_url = config.STUDIO_NODE_URL
        if node_url:
            try:
                base_url = node_url.rstrip("/")
                payload = {
                    "model": "qwen-2.5-72b", # Sovereign preference
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "stream": False
                }
                response = await asyncio.to_thread(
                    requests.post, 
                    f"{base_url}/v1/chat/completions", 
                    json=payload, 
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
            except Exception as e:
                logger.warning(f"[{self.name}] Remote node call failed: {e}. Trying next.")

        # Try Local Ollama (Default port)
        try:
            payload = {
                "model": "mistral",
                "prompt": f"{system_prompt}\n\n{prompt}",
                "stream": False
            }
            response = await asyncio.to_thread(
                requests.post,
                "http://localhost:11434/api/generate",
                json=payload,
                timeout=5
            )
            if response.status_code == 200:
                return response.json().get("response", "")
        except:
            pass

        # Final Fallback: Sovereign Mock Mode (Deterministic for verification)
        logger.warning(f"[{self.name}] CRITICAL: No LLM available. Operating in Mock Mode.")
        
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
                system_prompt="You are a high-intelligence metacognitive entity. Be precise, logical, and concise."
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
                prompt=critique_prompt,
                system_prompt="You are an uncompromising logical auditor."
            )
            
            history.append({
                "pass": i + 1,
                "proposal": proposal,
                "critique": critique
            })
            
            current_thought = f"PROPOSAL: {proposal}\n\nCRITIQUE: {critique}"
            logger.debug(f"[{self.name}] Pass {i+1} completed")

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
            system_prompt="Produce the final 'Sovereign Directive'. Focus on absolute clarity and strategic depth."
        )
        
        return final_result

    def diagnose_system(self) -> Dict:
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
                hot_spots.append({
                    "entity": agent,
                    "issue": "High failure rate detected",
                    "severity": "High"
                })
        
        diagnosis = {
            "timestamp": datetime.now().isoformat(),
            "health_score": self._calculate_health_score(agent_metrics_data),
            "hot_spots": hot_spots,
            "recent_insights": len(recent_insights),
            "metrics_snapshot": agent_metrics_data
        }
        
        logger.info(f"[{self.name}] System Diagnosis completed. Score: {diagnosis['health_score']}")
        return diagnosis

    def _calculate_health_score(self, metrics: Dict) -> float:
        """Simple heuristic for system health."""
        base_score = 100.0
        total_errors = sum(a.get("failures", 0) for a in metrics.get("agent_metrics", {}).values())
        return max(0.0, base_score - (total_errors * 2.0))

    def update_doctrine(self, new_principles: List[str]):
        """
        Updates the system's core doctrines (Constitutional AI).
        """
        current_doctrine = ""
        if os.path.exists(self.doctrine_path):
            with open(self.doctrine_path, 'r') as f:
                current_doctrine = f.read()
                
        # Generate new doctrine version
        updated_doctrine = current_doctrine + "\n\n### Sovereign Update - " + datetime.now().strftime("%Y-%m-%d") + "\n"
        for p in new_principles:
            updated_doctrine += f"- [SOVEREIGN-DRIVEN] {p}\n"
            
        with open(self.doctrine_path, 'w') as f:
            f.write(updated_doctrine)
            
        logger.info(f"[{self.name}] System Doctrine updated with {len(new_principles)} new principles.")

    async def execute(self, action: str, **params) -> Dict:
        """Standard agent execution entry point."""
        if action == "think":
            result = await self.think_recursive(params.get("prompt", ""), depth=params.get("depth", 3))
            return {"status": "success", "directive": result}
        elif action == "diagnose":
            return {"status": "success", "diagnosis": self.diagnose_system()}
        elif action == "update_doctrine":
            self.update_doctrine(params.get("principles", []))
            return {"status": "success", "message": "Doctrine updated"}
        else:
            return {"status": "error", "message": f"Unknown action: {action}"}

if __name__ == "__main__":
    # Internal test
    async def test():
        sovereign = MetacognitivePrincipal()
        pass
    
    asyncio.run(test())
