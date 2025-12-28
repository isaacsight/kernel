import logging
import json
from admin.brain.model_router import get_model_router, TaskType

logger = logging.getLogger("Classifier")

class Classifier:
    """
    A lightweight agent for classifying signals and decisions using LLMs.
    """
    def __init__(self):
        self.router = get_model_router()
        self.name = "Classifier"

    def classify_signal(self, signal_data: dict) -> dict:
        """
        Classifies a raw signal into a structured Studio OS decision pattern.
        """
        data_str = json.dumps(signal_data, indent=2)
        
        prompt = f"""
        You are the Pattern Classifier for the Studio OS.
        Analyze the incoming signal and classify it into a known pattern.
        
        Signal Data:
        {data_str}
        
        Known Patterns:
        - rushed_release: Deploying/Publishing without checks.
        - felt_wrong: Intuition red flag.
        - decision: Strategic choice.
        
        Output JSON ONLY:
        {{
            "pattern": "pattern_name",
            "confidence": 0.0-1.0,
            "guardrails": ["list", "of", "broken", "rules"],
            "reasoning": "Short explanation"
        }}
        """
        
        # Select best model for fast analysis
        model_info = self.router.select_model(TaskType.ANALYSIS, {"prefer_fast": True})
        
        try:
            # We need a way to call the model. 
            # Reusing the Researcher's call logic or ModelRouter if it had an execute method (it doesn't yet).
            # For now, we instantiate a Researcher temporarily or duplicate the call logic? 
            # Better: Let's import the `Researcher`'s _call_llm logic or make 'call_llm' a utility.
            # To avoid circular imports or refactoring `Researcher` right now, I will create a focused helper here.
            
            response = self._simple_llm_call(model_info, prompt)
            
            # Parse JSON
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                response = response.split("```")[1].split("```")[0].strip()
                
            result = json.loads(response)
            
            # Validate keys
            if "pattern" not in result:
                raise ValueError("LLM returned JSON without 'pattern' key")
                
            return result
            
        except Exception as e:
            logger.error(f"Classification failed: {e}")
            # Fallback
            return {
                "pattern": signal_data.get("pattern_hint", "unknown"),
                "confidence": 0.5,
                "guardrails": [],
                "reasoning": f"LLM/Parse Failure: {e}"
            }

    def _simple_llm_call(self, model_info, prompt):
        """Minimal adapter to call LLMs based on ModelRouter selection."""
        import os
        
        provider = model_info.get("provider")
        model_name = model_info.get("selected")
        
        if provider == "google":
             try:
                 import google.generativeai as genai
                 api_key = os.environ.get("GEMINI_API_KEY")
                 if not api_key: return "{}"
                 
                 genai.configure(api_key=api_key)
                 # Force flash if not specified to be safe and cheap
                 if "flash" not in model_name and "pro" not in model_name:
                     model_name = config.GEMINI_MODEL
                     
                 model = genai.GenerativeModel(model_name)
                 response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
                 return response.text
             except Exception as e:
                 logger.error(f"Gemini call failed: {e}")
                 return "{}"

        return "{}" # Default empty JSON-like string if provider not matched

# Singleton
classifier = Classifier()
