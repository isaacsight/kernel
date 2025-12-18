"""
The Beta Tester AI - Quality Assurance & Review Agent

Reviews code, design, and content artifacts to ensure they meet the team's standards
and provide a user-centric perspective on technical implementations.
"""

import os
import sys
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from admin.brain.model_router import get_model_router
from config import config
from admin.brain.agent_base import BaseAgent

logger = logging.getLogger("BetaTester")

class BetaTester(BaseAgent):
    """
    The Beta Tester AI (QA Specialist)
    
    Now data-driven via admin/brain/agents/beta_tester/
    """
    
    def __init__(self):
        # Initialize BaseAgent to load Profile & Skills
        super().__init__(agent_id="beta_tester")
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.model_router = get_model_router()

    async def execute(self, action: str, **params) -> Dict[str, Any]:
        """
        Executes an action via the unified Agent Interface.
        """
        if action == "review":
            artifact_type = params.get("artifact_type")
            content = params.get("content")
            
            if not artifact_type or not content:
                raise ValueError("artifact_type and content are required for review.")
                
            result = self.review_artifact(artifact_type, content)
            return result
            
        elif action == "simulate":
            ui_context = params.get("ui_context")
            if not ui_context:
                raise ValueError("ui_context is required for simulation.")
            
            result = self.simulate_user_interaction(ui_context)
            return {"simulation": result}
            
        else:
            raise NotImplementedError(f"Action {action} not supported by BetaTester.")

    def review_artifact(self, artifact_type: str, content: str) -> Dict:
        """
        Reviews an artifact (code, css, html, or content) and provides feedback.
        """
        logger.info(f"Reviewing {artifact_type} artifact...")
        
        prompt = f"""
        {self.get_system_prompt()}
        
        TASK: Review the following {artifact_type} artifact.
        
        CONTENT:
        ---
        {content}
        ---
        
        CRITERIA:
        1. Correctness: Does it work? Are there logic flaws?
        2. Friction: Is the UX intuitive? (If applicable)
        3. Professionalism: Does it meet "Studio OS" high-fidelity standards?
        4. Performance: Are there unnecessary complexities?
        
        OUTPUT FORMAT (JSON ONLY):
        {{
            "confidence_score": 0.0-1.0,
            "blocker_status": "LOWERED" | "RAISED",
            "critical_issues": ["issue 1", ...],
            "minor_suggestions": ["suggestion 1", ...],
            "user_perspective": "How a real user would feel...",
            "summary": "One sentence summary"
        }}
        """

        # Use standardized config model
        model = {
            "selected": config.GEMINI_MODEL,
            "provider": "google",
            "type": "cloud_free"
        }
        
        try:
            from admin.engineers.contrarian import Contrarian
            c = Contrarian()
            raw_response = c._call_llm(model, prompt)
            
            # Extract JSON from potential markdown blocks
            if "```json" in raw_response:
                raw_response = raw_response.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_response:
                raw_response = raw_response.split("```")[1].split("```")[0].strip()
                
            report = json.loads(raw_response)
        except Exception as e:
            logger.error(f"LLM Review failed: {e}")
            report = {
                "confidence_score": 0.0,
                "blocker_status": "RAISED",
                "critical_issues": [f"Review System Error: {str(e)}"],
                "minor_suggestions": [],
                "user_perspective": "The tester is confused by an internal error.",
                "summary": "System failure during review."
            }
            
        # Log event
        self.metrics.log_event("beta_tester", {"action": "artifact_reviewed", "type": artifact_type, "report": report})
        
        return report

    def simulate_user_interaction(self, ui_context: str) -> str:
        """
        Simulates a user walking through a UI described in text/html.
        """
        prompt = f"{self.get_system_prompt()}\n\nTASK: Describe your exact steps and frustrations when trying to use this interface: {ui_context}"
        
        model = {
            "selected": "gemini-2.0-flash",
            "provider": "google",
            "type": "cloud_free"
        }
        
        try:
            from admin.engineers.contrarian import Contrarian
            c = Contrarian()
            return c._call_llm(model, prompt)
        except Exception as e:
            return f"Interaction simulation failed: {e}"

def get_beta_tester():
    return BetaTester()

if __name__ == "__main__":
    tester = BetaTester()
    sample_css = ".button { color: red; }"
    print(tester.review_artifact("css", sample_css))
