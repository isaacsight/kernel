import logging
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.brain.model_router import get_model_router

logger = logging.getLogger("UniversalSpecialist")

class UniversalSpecialist:
    """
    A polymorphic agent that can adopt any deep expertise persona.
    It doesn't have a fixed system prompt; instead, it adopts the
    philosophy and mental models of the assigned domain.
    """
    
    def __init__(self, domain: str, name: str = None):
        """
        Args:
            domain (str): The field of expertise (e.g., "Evolutionary Biology", "Macroeconomics").
            name (str, optional): Custom name. Defaults to "The [Domain] Expert".
        """
        self.domain = domain
        self.name = name if name else f"The {domain} Expert"
        self.router = get_model_router()
        from config import config
        self.api_key = config.GEMINI_API_KEY
        self.model_name = config.GEMINI_MODEL
        
        logger.info(f"🎓 [Universal Specialist] Initialized: {self.name} with model {self.model_name}")

    def get_report(self, topic: str) -> str:
        """
        Generates a deep insight report on the topic using the specific
        mental models and jargon of the domain.
        """
        logger.info(f"[{self.name}] Analyzing topic: {topic}...")
        
        system_prompt = f"""You are a world-leading expert in {self.domain}.
        
        Your Goal: Analyze the given TOPIC strictly through the lens of {self.domain}.
        
        Guidelines:
        1. Use the core mental models, theories, and first principles of {self.domain}.
        2. Use appropriate technical terminology (don't dumb it down).
        3. Identify hidden connections that a layperson would miss.
        4. Be opinionated and rigorous.
        
        Output Format:
        ### Perspective: {self.domain}
        **Core Principle:** [A key {self.domain} concept applied here]
        **Analysis:** [Your deep dive]
        **Recommendation:** [What {self.domain} suggests we do]
        """
        
        user_prompt = f"TOPIC: {topic}"
        
        return self._call_llm(system_prompt, user_prompt)
        
    def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """Helper to call Gemini Flash directly."""
        import google.generativeai as genai
        import time
        
        if not self.api_key:
            return "Error: No Gemini API Key found."
            
        genai.configure(api_key=self.api_key)
        
        # Using model from config
        model = genai.GenerativeModel(self.model_name, system_instruction=system_prompt)
        
        retries = 3
        delay = 2
        
        for i in range(retries):
            try:
                response = model.generate_content(user_prompt)
                return response.text
            except Exception as e:
                logger.warning(f"Inference warning: {e}. Retrying...")
                time.sleep(delay)
                delay *= 2
        
        return "Error: Agent failed to think."

    def __repr__(self):
        return f"<UniversalSpecialist: {self.domain}>"
