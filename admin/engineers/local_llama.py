import os
import requests
import logging
from .alchemist import BaseAgent
from admin.config import config

logger = logging.getLogger("LocalLlama")

class LocalLlama(BaseAgent):
    """
    LocalLlama Agent
    A specialized agent that exclusively uses local Ollama models.
    """
    def __init__(self):
        # Initialize as a generic agent profile
        super().__init__(agent_id="local_llama")
        self.name = "LocalLlama"
        self.role = "Local Inference Specialist"
        self.ollama_url = "http://localhost:11434"
        self.default_model = "llama3.2"

    def chat(self, message: str) -> str:
        """Sends a message to the local Ollama instance."""
        print(f"[{self.name}] Thinking locally...")
        
        try:
            payload = {
                "model": self.default_model,
                "messages": [{"role": "user", "content": message}],
                "stream": False
            }
            # Note: Ollama's /v1/chat/completions is OpenAI compatible
            response = requests.post(f"{self.ollama_url}/v1/chat/completions", json=payload, timeout=60)
            response.raise_for_status()
            
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            return f"[{self.name}] Local inference failed. Is Ollama running? Error: {e}"

    async def execute(self, action: str, **params) -> dict:
        """Agent execution interface."""
        if action == "chat":
            return {"response": self.chat(params.get("message", ""))}
        return {"error": f"Action {action} not supported"}
