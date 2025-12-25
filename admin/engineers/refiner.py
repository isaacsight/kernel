import logging
import os
import sys
import json
from typing import Dict, Optional

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from core.agent_interface import BaseAgent

logger = logging.getLogger("Refiner")

class Refiner(BaseAgent):
    """
    The Refiner.
    A precision specialist that uses Gemma 3 / T5Gemma 2 models
    for high-fidelity rewriting, auditing, and polishing.
    """
    def __init__(self):
        self.model_name = "gemma-3-27b-it" # Proxy for T5Gemma 2 Precision
        self.fallback_model = config.GEMINI_MODEL
        
        # Initialize OpenRouter for free model access
        from admin.config import config
        from admin.infrastructure.openrouter import OpenRouterClient
        self.openrouter = OpenRouterClient(config.OPENROUTER_API_KEY)

    @property
    def name(self) -> str:
        return "The Refiner"

    @property
    def role(self) -> str:
        return "Precision Specialist"

    async def execute(self, action: str, **params) -> Dict:
        if action == "refine":
            text = params.get("text")
            instructions = params.get("instructions", "Improve clarity and flow.")
            return await self.refine(text, instructions)
        elif action == "audit":
            text = params.get("text")
            criteria = params.get("criteria", "Check for logical consistency.")
            return await self.audit(text, criteria)
        else:
            raise NotImplementedError(f"Action {action} not supported by Refiner.")

    async def refine(self, text: str, instructions: str) -> Dict:
        """
        Rewrites the text based on strict instructions using the high-precision model.
        """
        logger.info(f"[{self.name}] Refining text...")
        
        system_prompt = f"""You are THE REFINER.
        Your goal is to rewrite the user's text according to their instructions.
        
        CRITICAL RULES:
        1. Do NOT add new information (no hallucinations).
        2. Do NOT remove critical details unless asked.
        3. Maintain the original tone unless asked to change it.
        4. Focus on Flow, Clarity, and Precision.
        
        INSTRUCTIONS:
        {instructions}
        """

        refined_text = await self._call_llm(system_prompt, f"Input Text:\n{text}")
        return {"refined_text": refined_text}

    async def audit(self, text: str, criteria: str) -> Dict:
        """
        Audits the text against specific criteria.
        """
        logger.info(f"[{self.name}] Auditing text...")
        
        system_prompt = f"""You are THE REFINER (Auditor Mode).
        Analyze the text against the following criteria.
        
        CRITERIA:
        {criteria}
        
        Return a JSON object:
        {{
            "score": <0-10>,
            "issues": ["issue 1", "issue 2"],
            "suggestions": ["fix 1", "fix 2"]
        }}
        """
        
        response = await self._call_llm(system_prompt, f"Input Text:\n{text}")
        
        try:
            # Clean generic markdown if present
            cleaned = response.replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
            return data
        except Exception as e:
            logger.warning(f"Audit JSON parse failed: {e}")
            return {"error": "Failed to parse audit result", "raw": response}

    async def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """Direct call to Gemma 3 / Gemini."""
        import google.generativeai as genai
        import asyncio
        
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            return "Error: No Gemini API Key found."
            
        genai.configure(api_key=api_key)
        
        # Try the precision model first
        try:
            # Gemma 3 does not support system_instruction, so we prepend it
            full_prompt = f"{system_prompt}\n\n{user_prompt}"
            model = genai.GenerativeModel(self.model_name) 
            response = await model.generate_content_async(full_prompt)
            return response.text
        except Exception as e:
            logger.warning(f"Gemma 3 failed ({e}), falling back to Flash...")
            try:
                # Flash supports system_instruction
                model = genai.GenerativeModel(self.fallback_model, system_instruction=system_prompt)
                response = await model.generate_content_async(user_prompt)
                return response.text
            except Exception as e2:
                if "429" in str(e2):
                    return "Error: Rate limit exceeded. Please try again later."
                return f"Error: All models failed. {e2}"
        except Exception as e:
            # General OpenRouter fallback if API key exists
            if os.environ.get("OPENROUTER_API_KEY"):
                logger.info(f"[{self.name}] Final fallback to OpenRouter (Free Model)...")
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
                # Use high-precision free model if possible
                response = self.openrouter.chat_completion(config.OR_FREE_GEMMA, messages)
                return self.openrouter.extract_text(response)
            
            if "429" in str(e):
                return "Error: Rate limit exceeded. Please try again later."
            return f"Error: All models failed. {e}"

if __name__ == "__main__":
    # Test Mode
    import asyncio
    logging.basicConfig(level=logging.INFO)
    
    async def test():
        refiner = Refiner()
        print("Testing Refiner...")
        
        text = "This is a bad sentence that uses way to many words and is kinda clunky."
        
        # Test Refine
        res = await refiner.refine(text, "Make it punchy.")
        print(f"\nRefined: {res['refined_text']}")
        
        # Test Audit
        res = await refiner.audit(text, "Check for conciseness.")
        print(f"\nAudit: {res}")

    asyncio.run(test())
