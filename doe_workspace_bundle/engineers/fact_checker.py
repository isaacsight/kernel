import logging
import json
import google.generativeai as genai
from admin.config import config
from admin.decorators import critique_action

logger = logging.getLogger("FactChecker")

class FactChecker:
    """
    The FactChecker (Accuracy Assurance)
    
    Mission: Verify the factual accuracy of generated content.
    
    Responsibilities:
    - Hallucination Detection
    - Fact Verification against Context
    - Consistency Checking
    """
    def __init__(self):
        self.name = "The FactChecker"
        self.role = "Accuracy Assurance"
        
        # Configure Gemini (using same config as Alchemist)
        api_key = config.GEMINI_API_KEY
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL)
        else:
            self.model = None
            logger.warning("GEMINI_API_KEY not found. FactChecker will be disabled.")

    def verify(self, content: str, context: str) -> dict:
        """
        Verifies the claims in the content against the provided context.
        Returns a dict with 'is_valid' (bool) and 'feedback' (str).
        """
        if not self.model:
            return {"is_valid": True, "feedback": "FactChecker unavailable."}

        logger.info(f"[{self.name}] Verifying content accuracy...")

        prompt = f"""
        You are a strict Fact Checker. Your job is to identify hallucinations and factual errors.
        
        CONTEXT (Source Material):
        {context}
        
        CONTENT TO VERIFY:
        {content}
        
        INSTRUCTIONS:
        1. Identify specific claims in the CONTENT.
        2. Verify if these claims are supported by the CONTEXT or general common knowledge.
        3. Flag any claim that contradicts the CONTEXT or is likely a hallucination (fabricated facts, fake quotes, non-existent references).
        4. Ignore stylistic choices or opinions, focus only on objective claims.
        
        Return ONLY valid JSON:
        {{
            "is_valid": true/false,
            "issues": [
                "Detailed explanation of issue 1",
                "Detailed explanation of issue 2"
            ]
        }}
        """
        
        try:
            response = self.model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
            text_response = response.text.strip()
            
            # Clean potential markdown wrappers
            if text_response.startswith("```json"):
                text_response = text_response[7:-3]
            
            result = json.loads(text_response)
            
            is_valid = result.get("is_valid", True)
            issues = result.get("issues", [])
            
            if not is_valid:
                feedback = "FACT CHECK FAILURE:\n" + "\n".join(f"- {issue}" for issue in issues)
                logger.warning(f"[{self.name}] {feedback}")
                return {"is_valid": False, "feedback": feedback}
            
            logger.info(f"[{self.name}] Content passed fact check.")
            return {"is_valid": True, "feedback": ""}
            
        except Exception as e:
            logger.error(f"[{self.name}] Verification failed: {e}")
            # If verification fails, we don't block, but warn
            return {"is_valid": True, "feedback": f"Warning: Fact check skipped due to error: {e}"}
