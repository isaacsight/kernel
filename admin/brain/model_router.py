"""
Model Router - Intelligent Model Selection

Inspired by GitHub Spark's model selection feature.
Routes tasks to the optimal AI model based on task type, cost, and availability.
"""

import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum

logger = logging.getLogger("ModelRouter")


class Environment(Enum):
    CONTROLLER = "controller"
    NODE = "node"


class TaskType(Enum):
    """Types of tasks that different models excel at."""
    CREATIVE_WRITING = "creative_writing"
    CODE_GENERATION = "code_generation"
    ANALYSIS = "analysis"
    SUMMARIZATION = "summarization"
    CHAT = "chat"
    EMBEDDING = "embedding"
    FAST_SIMPLE = "fast_simple"


class ModelRouter:
    """
    Intelligent model selection based on task requirements.
    
    Inspired by GitHub Spark's flexible model selection.
    Automatically routes to the best available model for each task.
    """
    
    def __init__(self):
        self.name = "Model Router"
        self.env = self._detect_environment()
        logger.info(f"[{self.name}] Running in {self.env.value} environment")
        
        # Model registry with capabilities and costs
        self.models = {
            # Cloud models
            "gemini-1.5-pro": {
                "provider": "google",
                "type": "cloud",
                "strengths": [TaskType.CREATIVE_WRITING, TaskType.ANALYSIS, TaskType.CHAT],
                "cost_tier": "medium",
                "speed": "medium",
                "quality": "high",
                "context_window": 1000000,
                "available": self._check_gemini_available()
            },
            "gemini-1.5-flash": {
                "provider": "google",
                "type": "cloud",
                "strengths": [TaskType.FAST_SIMPLE, TaskType.SUMMARIZATION, TaskType.CHAT],
                "cost_tier": "low",
                "speed": "fast",
                "quality": "medium",
                "context_window": 1000000,
                "available": self._check_gemini_available()
            },
            "claude-3.5-sonnet": {
                "provider": "anthropic",
                "type": "cloud",
                "strengths": [TaskType.CODE_GENERATION, TaskType.ANALYSIS, TaskType.CREATIVE_WRITING],
                "cost_tier": "medium",
                "speed": "medium",
                "quality": "high",
                "context_window": 200000,
                "available": self._check_anthropic_available()
            },
            "gpt-4o": {
                "provider": "openai",
                "type": "cloud",
                "strengths": [TaskType.CODE_GENERATION, TaskType.ANALYSIS, TaskType.CHAT],
                "cost_tier": "high",
                "speed": "medium",
                "quality": "high",
                "context_window": 128000,
                "available": self._check_openai_available()
            },
            "gpt-4o-mini": {
                "provider": "openai",
                "type": "cloud",
                "strengths": [TaskType.FAST_SIMPLE, TaskType.CHAT, TaskType.SUMMARIZATION],
                "cost_tier": "low",
                "speed": "fast",
                "quality": "medium",
                "context_window": 128000,
                "available": self._check_openai_available()
            },
            "gpt-5.2-instant": {
                "provider": "openai",
                "type": "cloud",
                "strengths": [TaskType.FAST_SIMPLE, TaskType.CHAT],
                "cost_tier": "low",
                "speed": "fast",
                "quality": "high",
                "context_window": 128000,
                "available": self._check_openai_available()
            },
            "gpt-5.2-thinking": {
                "provider": "openai",
                "type": "cloud",
                "strengths": [TaskType.ANALYSIS, TaskType.CODE_GENERATION, TaskType.CHAT],
                "cost_tier": "high",
                "speed": "medium",
                "quality": "highest",
                "context_window": 200000,
                "available": self._check_openai_available()
            },
            "gpt-5.2-pro": {
                "provider": "openai",
                "type": "cloud",
                "strengths": [TaskType.CREATIVE_WRITING, TaskType.CHAT, TaskType.ANALYSIS],
                "cost_tier": "high",
                "speed": "medium",
                "quality": "highest",
                "context_window": 200000,
                "available": self._check_openai_available()
            },
            # Local/Remote Ollama models
            "mistral": {
                "provider": "ollama",
                "type": "local",
                "strengths": [TaskType.CHAT, TaskType.CREATIVE_WRITING, TaskType.FAST_SIMPLE],
                "cost_tier": "free",
                "speed": "medium",
                "quality": "medium",
                "context_window": 32000,
                "available": self._check_ollama_available()
            },
            "codestral": {
                "provider": "ollama",
                "type": "local",
                "strengths": [TaskType.CODE_GENERATION],
                "cost_tier": "free",
                "speed": "medium",
                "quality": "high",
                "context_window": 32000,
                "available": self._check_ollama_available()
            },
            "llama3.2": {
                "provider": "ollama",
                "type": "local",
                "strengths": [TaskType.FAST_SIMPLE, TaskType.CHAT],
                "cost_tier": "free",
                "speed": "fast",
                "quality": "medium",
                "context_window": 8000,
                "available": self._check_ollama_available()
            },
            "deepseek-coder": {
                "provider": "ollama",
                "type": "local",
                "strengths": [TaskType.CODE_GENERATION],
                "cost_tier": "free",
                "speed": "medium",
                "quality": "high",
                "context_window": 16000,
                "available": self._check_ollama_available()
            },
            "nomic-embed-text": {
                "provider": "ollama",
                "type": "local",
                "strengths": [TaskType.EMBEDDING],
                "cost_tier": "free",
                "speed": "fast",
                "quality": "medium",
                "context_window": 8000,
                "available": self._check_ollama_available()
            },
            # Nous Research Models (Open-weight, Agentic-focused)
            "hermes3": {
                "provider": "ollama",
                "type": "local",
                "strengths": [TaskType.CREATIVE_WRITING, TaskType.CHAT, TaskType.ANALYSIS],
                "cost_tier": "free",
                "speed": "medium",
                "quality": "high",
                "context_window": 128000,
                "available": self._check_ollama_available()
            },
            # Hugging Face models
            "mistral-7b-instruct": {
                "provider": "huggingface",
                "type": "cloud",
                "strengths": [TaskType.CHAT, TaskType.CREATIVE_WRITING],
                "cost_tier": "low",
                "speed": "medium",
                "quality": "medium",
                "context_window": 32000,
                "available": self._check_hf_available()
            },
            # Studio Node Models (Remote)
            "qwen-2.5-72b": {
                "provider": "remote",
                "type": "remote",
                "strengths": [TaskType.CREATIVE_WRITING, TaskType.ANALYSIS, TaskType.CHAT, TaskType.CODE_GENERATION],
                "cost_tier": "free",
                "speed": "medium",
                "quality": "high",
                "context_window": 32000,
                "available": self._check_studio_node_available()
            },
            # OpenAI Codex CLI (Local Exec)
            "codex-exec": {
                "provider": "openai",
                "type": "local",
                "strengths": [TaskType.CODE_GENERATION, TaskType.ANALYSIS],
                "cost_tier": "medium",
                "speed": "medium",
                "quality": "high",
                "context_window": 128000,
                "available": self._check_codex_available()
            }
        }
        
        # Task to model preferences (ordered by preference)
        # Hermes3 prioritized for creative/chat/analysis per Nous Research practices
        # Qwen 2.5 72B is now the heavy hitter for deep work
        self.task_preferences = {
            TaskType.CREATIVE_WRITING: ["gpt-5.2-pro", "qwen-2.5-72b", "hermes3", "gemini-1.5-pro", "claude-3.5-sonnet", "mistral", "gpt-4o"],
            TaskType.CODE_GENERATION: ["gpt-5.2-thinking", "qwen-2.5-72b", "claude-3.5-sonnet", "codestral", "deepseek-coder", "gpt-4o"],
            TaskType.ANALYSIS: ["gpt-5.2-thinking", "qwen-2.5-72b", "hermes3", "claude-3.5-sonnet", "gpt-4o", "gemini-1.5-pro", "mistral"],
            TaskType.SUMMARIZATION: ["gpt-5.2-instant", "gemini-1.5-flash", "gpt-4o-mini", "qwen-2.5-72b", "hermes3", "mistral"],
            TaskType.CHAT: ["gpt-5.2-pro", "gpt-5.2-thinking", "qwen-2.5-72b", "hermes3", "gemini-1.5-flash", "llama3.2", "mistral", "gpt-4o-mini"],
            TaskType.EMBEDDING: ["nomic-embed-text", "gemini-1.5-pro"],
            TaskType.FAST_SIMPLE: ["gpt-5.2-instant", "llama3.2", "gemini-1.5-flash", "gpt-4o-mini"]
        }
        
        logger.info(f"[{self.name}] Initialized with {len(self.models)} models")
    
    def _detect_environment(self) -> Environment:
        """Detect if we are running on the Controller or a Node."""
        # If STUDIO_NODE_ROLE is set to 'node', we are a node.
        if os.environ.get("STUDIO_NODE_ROLE") == "node":
            return Environment.NODE
        return Environment.CONTROLLER
    
    def _check_gemini_available(self) -> bool:
        """Check if Gemini API is configured."""
        return bool(os.environ.get("GEMINI_API_KEY"))
    
    def _check_anthropic_available(self) -> bool:
        """Check if Anthropic API is configured."""
        return bool(os.environ.get("ANTHROPIC_API_KEY"))
    
    def _check_openai_available(self) -> bool:
        """Check if OpenAI API is configured."""
        return bool(os.environ.get("OPENAI_API_KEY"))
    
    def _check_ollama_available(self) -> bool:
        """Check if Ollama is available (local or remote)."""
        import socket
        
        # Check local Ollama
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('localhost', 11434))
            sock.close()
            if result == 0:
                return True
        except:
            pass
        
        # Check remote Studio Node (only if we are the Controller)
        if self.env == Environment.CONTROLLER:
            node_url = os.environ.get("STUDIO_NODE_URL")
            if node_url:
                try:
                    import requests
                    response = requests.get(f"{node_url}/health", timeout=2)
                    return response.status_code == 200
                except:
                    pass
        
        return False
    
    def _check_hf_available(self) -> bool:
        """Check if Hugging Face API is configured."""
        return bool(os.environ.get("HF_TOKEN"))

    def _check_studio_node_available(self) -> bool:
        """Check if the remote Studio Node is available."""
        # Only relevant if we are the Controller
        if self.env != Environment.CONTROLLER:
            return False
            
        node_url = os.environ.get("STUDIO_NODE_URL")
        # Hardcode the known IP if env var is missing/default, based on recent success
        if not node_url:
            node_url = "http://100.98.193.42:8080" # WebUI port, or use 52415 for direct API if needed.
            # However, looking at alchemist.py, it expects an /api/endpoint.
            # The WebUI usually proxies /api/ requests. 
            # Or we can check the backend port directly if we are on the same tailscale network.
            # Let's assume the env var is set or we should set it. 
            # For this check, we'll try a simple ping or health check if possible.
            # But wait, alchemist uses /api/generate.
            pass

        if node_url:
            try:
                import requests
                # Try a lightweight endpoint. OpenWebUI usually has /health or /api/v1/models
                response = requests.get(f"{node_url}/health", timeout=2)
                return response.status_code == 200
            except:
                pass
        return False
    
    def _check_codex_available(self) -> bool:
        """Check if Codex CLI is installed and accessible."""
        import subprocess
        try:
            subprocess.run(["codex", "--version"], capture_output=True, check=True)
            return True
        except:
            return False
    
    def select_model(
        self, 
        task_type: TaskType,
        constraints: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Select the best model for a task.
        
        Args:
            task_type: The type of task
            constraints: Optional dict with keys like:
                - prefer_local: bool (prefer local models)
                - prefer_cheap: bool (prefer lower cost)
                - prefer_fast: bool (prefer faster models)
                - prefer_quality: bool (prefer higher quality)
                - min_context: int (minimum context window required)
        
        Returns:
            Dict with selected model info and reasoning
        """
        constraints = constraints or {}
        
        # Get preferred models for this task type
        preferences = self.task_preferences.get(task_type, [])
        
        # Score each model
        scored_models = []
        
        for model_name in preferences:
            model = self.models.get(model_name)
            if not model:
                continue
                
            # Skip unavailable models
            if not model["available"]:
                continue
            
            # Check context window constraint
            min_context = constraints.get("min_context", 0)
            if model["context_window"] < min_context:
                continue
            
            # Calculate score
            score = 100  # Base score
            
            # Preference adjustments
            if constraints.get("prefer_local") and model["type"] == "local":
                score += 30
            
            if constraints.get("prefer_cheap"):
                cost_scores = {"free": 40, "low": 30, "medium": 10, "high": 0}
                score += cost_scores.get(model["cost_tier"], 0)
            
            if constraints.get("prefer_fast"):
                speed_scores = {"fast": 30, "medium": 15, "slow": 0}
                score += speed_scores.get(model["speed"], 0)
            
            if constraints.get("prefer_quality"):
                quality_scores = {"high": 30, "medium": 15, "low": 0}
                score += quality_scores.get(model["quality"], 0)
            
            # Position in preference list matters
            position_bonus = (len(preferences) - preferences.index(model_name)) * 5
            score += position_bonus
            
            scored_models.append({
                "model": model_name,
                "score": score,
                "info": model
            })
        
        # Sort by score
        scored_models.sort(key=lambda x: x["score"], reverse=True)
        
        if not scored_models:
            # Fallback - try any available model
            for model_name, model in self.models.items():
                if model["available"]:
                    return {
                        "selected": model_name,
                        "provider": model["provider"],
                        "reasoning": "Fallback selection - no preferred models available",
                        "alternatives": [],
                        "selected_at": datetime.now().isoformat()
                    }
            
            return {
                "selected": None,
                "error": "No models available",
                "reasoning": "All configured models are unavailable"
            }
        
        best = scored_models[0]
        
        return {
            "selected": best["model"],
            "provider": best["info"]["provider"],
            "type": best["info"]["type"],
            "score": best["score"],
            "reasoning": self._build_reasoning(best, task_type, constraints),
            "alternatives": [m["model"] for m in scored_models[1:3]],
            "selected_at": datetime.now().isoformat()
        }
    
    def _build_reasoning(self, selection: Dict, task_type: TaskType, constraints: Dict) -> str:
        """Build human-readable reasoning for model selection."""
        model_name = selection["model"]
        model = selection["info"]
        
        reasons = [f"Selected {model_name} for {task_type.value}"]
        
        if model["type"] == "local":
            reasons.append("✓ Runs locally (free, private)")
        
        if model["quality"] == "high":
            reasons.append("✓ High quality output")
        
        if model["speed"] == "fast":
            reasons.append("✓ Fast response time")
        
        if model["cost_tier"] == "free":
            reasons.append("✓ No API cost")
        
        if constraints.get("prefer_local") and model["type"] == "local":
            reasons.append("✓ Matches local preference")
        
        return " | ".join(reasons)
    
    def get_available_models(self) -> List[Dict]:
        """Get list of currently available models."""
        available = []
        for name, model in self.models.items():
            if model["available"]:
                available.append({
                    "name": name,
                    "provider": model["provider"],
                    "type": model["type"],
                    "strengths": [t.value for t in model["strengths"]],
                    "cost_tier": model["cost_tier"]
                })
        return available
    
    def refresh_availability(self):
        """Re-check which models are available."""
        self.models["gemini-1.5-pro"]["available"] = self._check_gemini_available()
        self.models["gemini-1.5-flash"]["available"] = self._check_gemini_available()
        self.models["claude-3.5-sonnet"]["available"] = self._check_anthropic_available()
        self.models["gpt-4o"]["available"] = self._check_openai_available()
        self.models["gpt-4o-mini"]["available"] = self._check_openai_available()
        self.models["gpt-5.2-instant"]["available"] = self._check_openai_available()
        self.models["gpt-5.2-thinking"]["available"] = self._check_openai_available()
        self.models["gpt-5.2-pro"]["available"] = self._check_openai_available()
        
        ollama_available = self._check_ollama_available()
        for name in ["mistral", "codestral", "llama3.2", "deepseek-coder", "nomic-embed-text", "hermes3"]:
            self.models[name]["available"] = ollama_available
        
        self.models["qwen-2.5-72b"]["available"] = self._check_studio_node_available()
        self.models["mistral-7b-instruct"]["available"] = self._check_hf_available()
        self.models["codex-exec"]["available"] = self._check_codex_available()
        
        logger.info(f"[{self.name}] Refreshed model availability")
    
    def get_model_for_agent(self, agent_name: str) -> Dict[str, Any]:
        """
        Get the best model for a specific agent based on their role.
        """
        agent_task_map = {
            "Alchemist": TaskType.CREATIVE_WRITING,
            "Architect": TaskType.CODE_GENERATION,
            "Editor": TaskType.ANALYSIS,
            "Guardian": TaskType.ANALYSIS,
            "Researcher": TaskType.ANALYSIS,
            "Analyst": TaskType.ANALYSIS,
            "Visionary": TaskType.CREATIVE_WRITING,
            "Designer": TaskType.CREATIVE_WRITING,
            "Narrator": TaskType.CREATIVE_WRITING,
            "Librarian": TaskType.EMBEDDING,
            "Operator": TaskType.FAST_SIMPLE,
            "Scheduler": TaskType.FAST_SIMPLE,
            "Translator": TaskType.CREATIVE_WRITING
        }
        
        task_type = agent_task_map.get(agent_name, TaskType.CHAT)
        
        # Agents prefer local models when available
        constraints = {"prefer_local": True}
        
        return self.select_model(task_type, constraints)


# Singleton instance
_router = None

def get_model_router() -> ModelRouter:
    """Get the global model router instance."""
    global _router
    if _router is None:
        _router = ModelRouter()
    return _router


if __name__ == "__main__":
    router = ModelRouter()
    
    print("Available Models:")
    for model in router.get_available_models():
        print(f"  - {model['name']} ({model['provider']}) - {model['type']}")
    
    print("\nModel Selection Tests:")
    
    # Test different task types
    for task in [TaskType.CREATIVE_WRITING, TaskType.CODE_GENERATION, TaskType.FAST_SIMPLE]:
        result = router.select_model(task)
        print(f"\n{task.value}:")
        print(f"  Selected: {result.get('selected')}")
        print(f"  Reasoning: {result.get('reasoning')}")
        print(f"  Alternatives: {result.get('alternatives')}")
    
    # Test with constraints
    print("\n\nWith prefer_local + prefer_cheap constraints:")
    result = router.select_model(
        TaskType.CREATIVE_WRITING,
        {"prefer_local": True, "prefer_cheap": True}
    )
    print(f"  Selected: {result.get('selected')}")
    print(f"  Reasoning: {result.get('reasoning')}")
