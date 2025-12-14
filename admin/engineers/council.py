import logging
import json
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.engineers.researcher import Researcher # Reuse researcher for LLM calls if needed, or standalone
from admin.brain.model_router import get_model_router

logger = logging.getLogger("CouncilOfMinds")

class Council:
    """
    The Council of Minds (System 2 Thinking).
    
    Orchestrates a multi-agent debate to produce high-quality insights.
    
    Personas:
    1. The Architect: Plans the structure and key arguments.
    2. The Skeptic: Critiques the plan for biases, fallacies, and gaps.
    3. The Synthesizer: Produces the final output merging plan + critique.
    """
    def __init__(self):
        self.router = get_model_router()
        # Force zero-cost model for all council members
        self.model = "gemini-2.0-flash" 
        
    def deliberate(self, topic: str) -> dict:
        """
        Runs the full deliberation loop on a topic.
        """
        logger.info(f"🏛️ Convening The Council for: '{topic}'")
        
        # 1. The Architect (The Plan)
        plan = self._consult_architect(topic)
        logger.info("   ↳ Architect has spoken.")
        
        # 2. The Skeptic (The Critique)
        critique = self._consult_skeptic(topic, plan)
        logger.info("   ↳ Skeptic has spoken.")
        
        # 3. The Synthesizer (The Result)
        final_insight = self._consult_synthesizer(topic, plan, critique)
        logger.info("   ↳ Synthesizer has resolved the debate.")
        
        return {
            "topic": topic,
            "council_output": final_insight,
            "process": {
                "architect_plan": plan,
                "skeptic_critique": critique
            }
        }

    def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """Helper to call Gemini Flash directly."""
        import google.generativeai as genai
        
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            return "Error: No Gemini API Key found."
            
        genai.configure(api_key=api_key)
        
        # Using flash for zero cost
        model = genai.GenerativeModel('gemini-2.0-flash', system_instruction=system_prompt)
        
        try:
            response = model.generate_content(user_prompt)
            return response.text
        except Exception as e:
            logger.error(f"Gemini Inference Failed: {e}")
            return f"Error generation content: {e}"

    def _consult_architect(self, topic: str) -> str:
        sys_prompt = """You are THE ARCHITECT.
        Your goal is to outline a comprehensive, structural, and novel analysis of the user's topic.
        
        - Do not write the full essay.
        - Output a structured BLUEPRINT:
          1. Core Thesis (Must be non-obvious).
          2. Three Pillars of Argument (The 'Why').
          3. The Implications (Second-order effects).
        
        Be bold. Avoid generic advice."""
        
        return self._call_llm(sys_prompt, f"Topic: {topic}")

    def _consult_skeptic(self, topic: str, plan: str) -> str:
        sys_prompt = """You are THE SKEPTIC.
        Your only job is to tear down the Architect's plan.
        
        - Identify Logical Fallacies.
        - Point out Optimism Bias.
        - Ask "What if the opposite is true?"
        - Highlight missing variables.
        
        Be ruthless but constructive. Do not be mean, be rigorous."""
        
        return self._call_llm(sys_prompt, f"Topic: {topic}\n\nArchitect's Plan:\n{plan}")

    def _consult_synthesizer(self, topic: str, plan: str, critique: str) -> str:
        sys_prompt = """You are THE SYNTHESIZER.
        Your job is to produce the Final Insight.
        
        1. Read the Architect's Plan (The Thesis).
        2. Read the Skeptic's Critique (The Antithesis).
        3. Create the SYNTHESIS.
        
        The final output should be a polished, deep-reasoning report.
        - Acknowledge the complexity raised by the Skeptic.
        - Strengthen the arguments of the Architect where valid.
        - Discard weak points.
        
        Format as Markdown."""
        
        return self._call_llm(sys_prompt, f"Topic: {topic}\n\nPlan:\n{plan}\n\nCritique:\n{critique}")

if __name__ == "__main__":
    # Test Run
    logging.basicConfig(level=logging.INFO)
    council = Council()
    result = council.deliberate("Why AI might reduce human intelligence")
    print("\nFINAL OUTPUT:\n")
    print(result['council_output'])
