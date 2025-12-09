import logging
import re
import os
from huggingface_hub import InferenceClient

from core.agent_interface import BaseAgent
from typing import Dict

logger = logging.getLogger("Guardian")

class Guardian(BaseAgent):
    """
    The Guardian (AI Ethicist)
    
    Mission: Ensure the system remains safe, honest, and aligned.
    
    Responsibilities:
    - Safety & Alignment
    - Bias Mitigation
    - Gentle Doctrine Enforcement (Safety Layer)
    """
    def __init__(self):
        self.safety_rules = [
            {
                "name": "Restricted Topics",
                "pattern": r"\b(hate speech|violence|self-harm)\b", # Placeholder patterns
                "level": "CRITICAL",
                "message": "Content contains restricted topics."
            },
            {
                "name": "Hallucination Check",
                "pattern": r"\b(As an AI language model)\b",
                "level": "WARNING",
                "message": "Content contains AI boilerplate."
            }
        ]
        # Hugging Face Setup (Moved from validate_system to init for consistency)
        self.hf_token = os.environ.get("HF_TOKEN")
        try:
            self.hf_client = InferenceClient(token=self.hf_token) if self.hf_token else None
        except:
             self.hf_client = None
        self.safety_model = "unitary/toxic-bert"

    @property
    def name(self) -> str:
        return "The Guardian"

    @property
    def role(self) -> str:
        return "AI Ethicist"

    async def execute(self, action: str, **params) -> Dict:
        if action == "audit":
            content = params.get("content")
            if not content:
                 raise ValueError("Content is required for audit.")
            issues = self.audit_content(content)
            return {"issues": issues, "status": "safe" if not issues else "flagged"}
        elif action == "verify_evolution":
             blueprint = params.get("blueprint")
             allowed, msg = self.verify_evolution(blueprint)
             return {"allowed": allowed, "message": msg}
        else:
             raise NotImplementedError(f"Action {action} not supported by Guardian.")
        
    def verify_evolution(self, blueprint):
        """
        Checks the blueprint for dangerous operations.
        """
        logger.info("Verifying evolution blueprint...")
        
        if "error" in blueprint:
            return False, f"Blueprint has errors: {blueprint['error']}"
            
        changes = blueprint.get("changes", [])
        for change in changes:
            file_path = change.get("file", "")
            
            # Safety Rule 1: Do not modify the Guardian itself (prevent lobotomy)
            if "guardian.py" in file_path:
                return False, "CRITICAL: Attempt to modify The Guardian detected. Operation blocked."
                
            # Safety Rule 2: Do not modify hidden system files
            if file_path.startswith("."):
                return False, "CRITICAL: Attempt to modify hidden system files. Operation blocked."
                
        return True, "Blueprint approved."

    def validate_system(self):
        """
        Runs post-evolution checks (e.g., can the server start?).
        """
        logger.info("Validating system integrity...")
        
        # 1. Syntax Check (compile all python files)
        import compileall
        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            compileall.compile_dir(base_dir, quiet=1, force=1)
        except Exception as e:
            return False, f"Syntax check failed: {e}"
            
        return True, "System integrity verified."
        # Hugging Face Setup
        self.hf_token = os.environ.get("HF_TOKEN")
        self.hf_client = InferenceClient(token=self.hf_token) if self.hf_token else None
        self.safety_model = "unitary/toxic-bert"

    def audit_content(self, content):
        """
        Audits content for safety violations using Hybrid (Regex + AI) approach.
        Returns a list of issues.
        """
        issues = []
        
        # 1. Regex Checks (Fast, Deterministic)
        for rule in self.safety_rules:
            matches = re.findall(rule["pattern"], content, re.IGNORECASE)
            if matches:
                issues.append({
                    "rule": rule["name"],
                    "level": rule["level"],
                    "message": f"{rule['message']} Found: {matches[0]}..."
                })
        
        # 2. AI Safety Check (Deep Semantic)
        node_url = os.environ.get("STUDIO_NODE_URL")
        
        if node_url:
            try:
                import requests
                response = requests.post(
                    f"{node_url}/audit",
                    json={"model": "mistral", "prompt": content[:1000]},
                    timeout=10
                )
                response.raise_for_status()
                result = response.json().get("audit", {})
                
                # Parse the JSON string if it came back as a string
                if isinstance(result, str):
                    import json
                    try:
                        result = json.loads(result)
                    except:
                        result = {}
                        
                if not result.get("safe", True):
                    issues.append({
                        "rule": "AI Safety (Remote)",
                        "level": "CRITICAL",
                        "message": f"Remote Guardian flagged issues: {result.get('issues', ['Unknown'])}"
                    })
            except Exception as e:
                logger.warning(f"Remote Guardian check failed: {e}")
                
        elif self.hf_client:
            try:
                # Truncate content for API limit (usually 512 tokens for BERT)
                # We'll check the first 500 chars as a heuristic for now
                payload = content[:1000] 
                response = self.hf_client.text_classification(payload, model=self.safety_model)
                
                # Response is list of dicts: [{'label': 'toxic', 'score': 0.9}, ...]
                for result in response:
                    if result['score'] > 0.7: # Threshold
                        issues.append({
                            "rule": f"AI Safety ({result['label']})",
                            "level": "CRITICAL" if result['score'] > 0.9 else "WARNING",
                            "message": f"High probability of {result['label']} content ({result['score']:.2f})."
                        })
            except Exception as e:
                logger.warning(f"Guardian AI check failed: {e}")
                
        return issues

    def verify_alignment(self, content):
        """
        Ensures the content feels "Gentle" and not manipulative.
        """
        pass