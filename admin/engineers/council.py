import logging
import json
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.brain.model_router import get_model_router

logger = logging.getLogger("GrandCouncil")

class GrandCouncil:
    """
    The Grand Council of Agents (System 2 Thinking).
    
    Orchestrates a multi-agent deliberation where various specialized agents
    (Trend Scout, Publisher, etc.) submit their reports/context, and the
    Council personas debate the best course of action.
    
    Personas:
    1. The Architect: Plans the structure and key arguments.
    2. The Skeptic: Critiques the plan for biases, fallacies, and gaps.
    3. The Synthesizer: Produces the final output merging plan + critique.
    """
    def __init__(self):
        self.router = get_model_router()
        self.model = "gemini-2.0-flash" 
        self.registered_agents = {}

    def register_agent(self, name: str, agent_instance):
        """Registers a specialist agent to the council."""
        self.registered_agents[name] = agent_instance
        logger.info(f"📝 Agent registered to Council: {name}")

    def deliberate(self, topic: str, state: dict) -> dict:
        """
        Runs the full deliberation loop on a topic, incorporating agent reports.
        """
        import time
        logger.info(f"🏛️ Convening The Grand Council for: '{topic}'")
        
        # 0. Gather Intelligence
        intelligence_report = self._gather_intelligence()
        context_str = f"Current System State: {state}\n\nAgent Intelligence Reports:\n{intelligence_report}"
        
        # 1. The Architect (The Plan)
        plan = self._consult_architect(topic, context_str)
        logger.info("   ↳ Architect has spoken.")
        time.sleep(5) # Space out calls to avoid rate limits
        
        # 2. The Skeptic (The Critique)
        critique = self._consult_skeptic(topic, plan, context_str)
        logger.info("   ↳ Skeptic has spoken.")
        time.sleep(5) # Space out calls
        
        # 3. The Synthesizer (The Result)
        final_insight = self._consult_synthesizer(topic, plan, critique, context_str)
        logger.info("   ↳ Synthesizer has resolved the debate.")
        
        return {
            "topic": topic,
            "council_output": final_insight,
            "intelligence": intelligence_report,
            "process": {
                "architect_plan": plan,
                "skeptic_critique": critique
            }
        }

    def _gather_intelligence(self) -> str:
        """Asks all registered agents for a status report."""
        reports = []
        for name, agent in self.registered_agents.items():
            try:
                # If agent has a specific report method, use it. Otherwise str(agent)
                if hasattr(agent, "get_report"):
                    report = agent.get_report()
                elif hasattr(agent, "get_current_trends"): # TrendScout specific
                    report = f"Trends: {agent.get_current_trends()}"
                else:
                    report = f"Status: Alive. Type: {type(agent).__name__}"
                
                reports.append(f"--- Agent: {name} ---\n{report}\n")
            except Exception as e:
                logger.error(f"Failed to get report from {name}: {e}")
                reports.append(f"--- Agent: {name} ---\n(Failed to report: {e})\n")
                
        return "\n".join(reports)

    def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """Helper to call Gemini Flash directly."""
        import google.generativeai as genai
        import time
        
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            return "Error: No Gemini API Key found."
            
        genai.configure(api_key=api_key)
        
        # Using flash for zero cost
        model = genai.GenerativeModel('gemini-2.0-flash', system_instruction=system_prompt)
        
        retries = 5
        delay = 5
        
        for i in range(retries):
            try:
                response = model.generate_content(user_prompt)
                return response.text
            except Exception as e:
                if "429" in str(e):
                    logger.warning(f"Rate limited (429). Retrying in {delay}s... (Attempt {i+1}/{retries})")
                    time.sleep(delay)
                    delay *= 2 # Exponential backoff
                else:
                    logger.error(f"Gemini Inference Failed: {e}")
                    return f"Error generation content: {e}"
        
        return "Error: Failed after max retries."

    def _consult_architect(self, topic: str, context: str) -> str:
        sys_prompt = """You are THE ARCHITECT.
        Your goal is to propose a strategic evolution for the system based on the capabilities of the available agents.
        
        Input:
        - A Topic/Goal.
        - Intelligence Reports from specialized agents (Trend Scout, Publisher, etc.).
        
        Output:
        - A structured PLAN of action.
        - 1. Core Objective.
        - 2. Which agents should be deployed and why.
        - 3. Expected outcome.
        
        Be bold but actionable."""
        
        return self._call_llm(sys_prompt, f"Topic: {topic}\n\nContext:\n{context}")

    def _consult_skeptic(self, topic: str, plan: str, context: str) -> str:
        sys_prompt = """You are THE SKEPTIC.
        Your job is to critique the Architect's plan given the intelligence reports.
        
        - Are the selected trends actually relevant?
        - Are we over-estimating our capabilities?
        - Is there a simpler way?
        
        Be rigorous."""
        
        return self._call_llm(sys_prompt, f"Topic: {topic}\n\nContext:\n{context}\n\nArchitect's Plan:\n{plan}")

    def _consult_synthesizer(self, topic: str, plan: str, critique: str, context: str) -> str:
        sys_prompt = """You are THE SYNTHESIZER.
        Your job is to produce the Final Command for the Strategist.
        
        1. Read the Architect's Plan and Skeptic's Critique.
        2. Decide on the final BEST ACTION.
        
        IMPORTANT: Your output must contain a JSON block at the end with the specific command.
        
        Format:
        [Reasoning text...]
        
        ```json
        {
            "action": "mutate" | "idle",
            "directive": "Specific instructions for the engineers...",
            "target_agent": "Name of best suited agent" 
        }
        ```
        """
        
        return self._call_llm(sys_prompt, f"Topic: {topic}\n\nContext:\n{context}\n\nPlan:\n{plan}\n\nCritique:\n{critique}")

if __name__ == "__main__":
    # Test Run
    logging.basicConfig(level=logging.INFO)
    council = GrandCouncil()
    
    # Mock Agents
    class MockScout:
        def get_current_trends(self): return [{"topic": "AI Coding", "volume": "High"}]
    
    council.register_agent("TrendScout", MockScout())
    
    result = council.deliberate("Evolution Strategy", {"cycle": 1})
    print("\nFINAL OUTPUT:\n")
    print(result['council_output'])
