import logging
import sys
import os
import json
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from admin.config import config
from admin.engineers.web_scout import get_web_scout
from admin.brain.model_router import get_model_router, TaskType

logger = logging.getLogger("Contrarian")
logging.basicConfig(level=logging.INFO)

class Contrarian:
    """
    The Contrarian (Red Team / Devil's Advocate)
    
    Mission: Identify extreme variables, edge cases, and failure modes.
    """
    def __init__(self):
        self.name = "The Contrarian"
        self.role = "Adversarial Researcher"
        self.web_scout = get_web_scout()
        self.model_router = get_model_router()
        
    def challenge_thesis(self, thesis: str, context: str = "") -> dict:
        """
        Attacks a thesis by finding the 'Extreme Variable' that breaks it.
        """
        logger.info(f"[{self.name}] Challenging thesis: {thesis}")
        
        # 1. Select Model (FORCE GEMINI FLASH for Cost-Free Mode)
        # Bypassing ModelRouter because it defaults to OpenAI when local is missing, 
        # and we want to ensure zero-cost execution.
        model = {
            "selected": "gemini-2.0-flash",
            "provider": "google",
            "type": "cloud_free"
        }
        logger.info(f"[{self.name}] Force-selected model: {model['selected']}")
        
        # 2. Identify Attack Vectors
        plan_prompt = f"""
        You are The Contrarian, a Red Team analyst.
        
        Thesis: "{thesis}"
        Context: {context[:2000]}
        
        Your Goal: Identify the "Extreme Variable"—the single most critical factor that could cause this thesis to fail catastrophically.
        
        Task:
        1. List 3 potential failure modes or edge cases.
        2. Select the most "extreme" one (highest impact, hardest to predict).
        3. Generate 2 search queries to find evidence for this failure mode.
        
        Output ONLY JSON:
        {{
            "failure_modes": ["mode1", "mode2", "mode3"],
            "extreme_variable": "variable_name",
            "hypothesis": "Why this variable breaks the system",
            "search_queries": ["query1", "query2"]
        }}
        """
        
        attack_plan_json = self._call_llm(model, plan_prompt, response_format="json")
        try:
            # Basic cleaning for JSON markdown
            if "```json" in attack_plan_json:
                attack_plan_json = attack_plan_json.split("```json")[1].split("```")[0].strip()
            elif "```" in attack_plan_json:
                attack_plan_json = attack_plan_json.split("```")[1].split("```")[0].strip()
                
            attack_plan = json.loads(attack_plan_json)
        except Exception as e:
            logger.error(f"Failed to parse attack plan: {e}")
            # Fallback
            attack_plan = {
                "extreme_variable": "Unknown Unknowns",
                "hypothesis": "System complexity exceeds management capacity.",
                "search_queries": [f"{thesis} failure cases", f"{thesis} risks"]
            }
            
        logger.info(f"[{self.name}] Attack Vector: {attack_plan['extreme_variable']}")
        
        # 3. Gather Evidence (Adversarial Search)
        evidence = []
        for query in attack_plan.get("search_queries", []):
            results = self.web_scout.search(query, num_results=2)
            for res in results:
                evidence.append(f"Source: {res.get('title')}\nSnippet: {res.get('snippet')}")
                
        evidence_text = "\n\n".join(evidence)
        
        # 4. Draft Dissenting Opinion
        dissent_prompt = f"""
        Write a "Dissenting Opinion" on: "{thesis}"
        
        Focus: The Extreme Variable -> {attack_plan['extreme_variable']}
        Hypothesis: {attack_plan['hypothesis']}
        
        Evidence Found:
        {evidence_text}
        
        Format:
        1. The Flaw: Define the extreme variable.
        2. The Break Point: Describe the scenario where this causes failure.
        3. The Verdict: Why the original thesis is dangerous or incomplete.
        """
        
        dissenting_opinion = self._call_llm(model, dissent_prompt)
        
        return {
            "thesis": thesis,
            "extreme_variable": attack_plan['extreme_variable'],
            "dissent": dissenting_opinion,
            "evidence": evidence
        }

    def _call_llm(self, model_info: dict, prompt: str, response_format: str = "text") -> str:
        """Reusing the researcher's LLM call logic (simplified)"""
        # Ideally this should be a shared utility in the brain module
        from admin.engineers.researcher import Researcher
        # Instantiate temporarily just to use its helper if we don't extract it
        # Or better, just copy the minimal logic or import if static (it's instance method).
        # Let's instantiate a researcher just for the utility helper for now to save code dupe, 
        # or better yet, let's just use the Researcher's method if we made it static (we didn't).
        # We will duplicate the critical parts for independence.
        
        provider = model_info.get("provider")
        model_name = model_info.get("selected")
        
        # ... (Identical logic to Researcher._call_llm, simplified for brevity in this artifact) ...
        # For now, let's instantiate Researcher and use its method to ensure consistent 'Free/Local' logic.
        r = Researcher() 
        return r._call_llm(model_info, prompt, response_format)

if __name__ == "__main__":
    c = Contrarian()
    print(c.challenge_thesis("Cloud AI is superior to Local AI")['dissent'])
