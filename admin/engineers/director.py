"""
The Director - Sovereign Supervisor Agent
"""

import logging
import json
from typing import Dict, Any, Optional, List
from admin.brain.agent_base import BaseAgent
from admin.config import config
from admin.decorators import critique_action

logger = logging.getLogger("Director")

class Director(BaseAgent):
    """
    The Director (Sovereign Supervisor)
    
    Role:
    - Enforce the "Gentle Doctrine" and "Cyber-Zen" aesthetics.
    - Veto off-track agent loops.
    - Audit content alignment.
    - Does NOT generate raw content; only reviews and directs.
    """
    
    def __init__(self):
        super().__init__(agent_id="director")
        
        # Initialize LLM (Gemini)
        import google.generativeai as genai
        if config.GEMINI_API_KEY:
            genai.configure(api_key=config.GEMINI_API_KEY)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL)
        else:
            logger.warning("GEMINI_API_KEY missing. Director is blind.")
            self.model = None

        logger.info(f"[{self.name}] Online. Monitoring for alignment drift.")

    @critique_action("Director Alignment Check")
    def check_alignment(self, content: str, context: str = "") -> Dict[str, Any]:
        """
        [ALIGNMENT CHECK]
        Scores content/plan against the Gentle Doctrine.
        Returns a score (0-100) and a "Veto" boolean.
        """
        from admin.core import get_doctrine
        doctrine = get_doctrine()

        prompt = f"""
        You are The Director.
        
        YOUR DOCTRINE:
        {doctrine}
        
        TASK:
        Assess the following content for alignment with the Doctrine.
        
        CONTENT:
        {content[:2000]}... (truncated)
        
        CONTEXT:
        {context}
        
        CRITERIA:
        1. Sincerity: Is it honest? (No excessive hype)
        2. Aesthetics: Is it 'Cyber-Zen'? (Clean, minimal, deep)
        3. Utility: Is it actually useful?
        
        OUTPUT JSON ONLY:
        {{
            "alignment_score": <0-100>,
            "sincerity_score": <0-100>,
            "veto": <true/false>,
            "reason": "<One sentence explanation>",
            "directive": "<What must change?>"
        }}
        """
        
        try:
            # High priority, use best model available (remote or local strong)
            response_text = self._call_llm_auto(prompt)
            result = self._parse_json_response(response_text)
            
            # Log significant drifts
            if result.get("alignment_score", 100) < 70:
                logger.warning(f"[{self.name}] Low Alignment Score: {result['alignment_score']}. Reason: {result.get('reason')}")
                
            return result
            
        except Exception as e:
            logger.error(f"[{self.name}] Alignment check failed: {e}")
            return {"alignment_score": 0, "veto": True, "reason": f"System Error: {e}", "directive": "Halt."}

    @critique_action("Director's Cut")
    def directors_cut(self, content: str, style_guide: str = "Cyber-Zen") -> str:
        """
        [DIRECTOR'S CUT]
        Rewrites/Polishes content to match the specific house style.
        """
        prompt = f"""
        You are The Director. Perform a 'Director's Cut' on this content.
        
        STYLE GUIDE: {style_guide}
        - Values: Essentialism, Depth, Calm, High-Agency.
        - Anti-Patterns: Corporate speak, "Delve", "In the rapidly evolving landscape", generic hype.
        
        INPUT CONTENT:
        {content}
        
        INSTRUCTIONS:
        - Cut 20% of the word count.
        - Increase impact.
        - Make it sound like a human Sovereign, not an LLM.
        
        OUTPUT:
        The polished content only.
        """
        
        return self._call_llm_auto(prompt)

    def veto_loop(self, agent_name: str, recent_actions: List[str]) -> bool:
        """
        [VETO & REFRAME]
        Decides if an agent is stuck in a loop or hallucinating.
        """
        prompt = f"""
        Agent '{agent_name}' has performed these recent actions:
        {json.dumps(recent_actions)}
        
        Is this agent stuck, looping, or off-track?
        If YES, issue a VETO.
        
        OUTPUT JSON:
        {{
            "veto": <true/false>,
            "reason": "..."
        }}
        """
        try:
            res = self._parse_json_response(self._call_llm_auto(prompt))
            return res.get("veto", False)
        except:
            return False

    def _call_llm_auto(self, prompt: str) -> str:
        """Helper to use the BaseAgent/ModelRouter infrastructure."""
        # This implementation depends on how BaseAgent exposes generation.
        # Since BaseAgent doesn't natively expose a simple 'generate' (it relies on subclasses),
        # we'll implement a simple one using the configured model.
        try:
            return self.model.generate_content(prompt).text
        except:
            # Fallback basics if model isn't directly on self (though BaseAgent usually has it)
            return "Director unavailable."

    def _parse_json_response(self, text: str) -> Dict:
        """Cleaning helper."""
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)

# Singleton Accessor
_director_instance = None
def get_director():
    global _director_instance
    if _director_instance is None:
        _director_instance = Director()
    return _director_instance
