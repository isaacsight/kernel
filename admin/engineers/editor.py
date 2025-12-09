import logging
import re
import os
from huggingface_hub import InferenceClient

from core.agent_interface import BaseAgent
from typing import Dict, List, Any

logger = logging.getLogger("Editor")

class Editor(BaseAgent):
    """
    The Editor (Copy Engineer)
    
    Responsibilities:
    - Logic Flow Analysis
    - Style Consistency
    - Grammar & Clarity
    """
    def __init__(self):
        super().__init__()
        self.doctrine_rules = [
            {
                "name": "No Moralizing",
                "pattern": r"\b(should|must|ought to)\b",
                "message": "Avoid moralizing language ('should', 'must'). Rephrase as an observation or possibility."
            },
            {
                "name": "Signature Question",
                "check": lambda text: "does this feel true" in text.lower(),
                "message": "Missing signature question: 'Does this feel true?'"
            }
        ]
        
        # Hugging Face Setup
        self.hf_token = os.environ.get("HF_TOKEN")
        self.hf_client = InferenceClient(token=self.hf_token) if self.hf_token else None
        self.editor_model = "mistralai/Mistral-7B-Instruct-v0.2"

    @property
    def name(self) -> str:
        return "The Editor"

    @property
    def role(self) -> str:
        return "Style & Clarity"

    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        content = task.get("content", "")
        issues = self.audit(content)
        return {"status": "success", "issues": issues}

    def audit(self, content):
        """
        Reviews content against the Gentle Doctrine and returns a list of issues.
        """
        issues = []
        
        # 1. Regex Checks
        for rule in self.doctrine_rules:
            if "pattern" in rule:
                matches = re.findall(rule["pattern"], content, re.IGNORECASE)
                if matches:
                    issues.append(f"{rule['name']}: Found {len(matches)} instances. {rule['message']}")
            elif "check" in rule:
                if not rule["check"](content):
                    issues.append(f"{rule['name']}: {rule['message']}")
        
        # 2. AI Critique (if available)
        if self.hf_client:
            critique = self.critique_style(content)
            if critique:
                issues.append(f"AI Critique: {critique}")
                    
        return issues

    def critique_style(self, content):
        """
        Uses an LLM to critique the style.
        """
        try:
            prompt = f"""
            [INST] You are an expert editor for a blog called "Does This Feel Right?".
            The philosophy is "Gentle, Honest, Observational".
            
            Review the following text. If it sounds preachy, aggressive, or uses too much corporate jargon, point it out.
            If it looks good, just say "Style looks good."
            
            TEXT:
            {content[:1000]}...
            [/INST]
            """
            response = self.hf_client.text_generation(prompt, model=self.editor_model, max_new_tokens=100)
            return response.strip()
        except Exception as e:
            logger.warning(f"Editor AI critique failed: {e}")
            return None

    def refine(self, content):
        """
        Polishes the prose to match the site's voice.
        """
        # Future: Use LLM to rewrite content
        pass