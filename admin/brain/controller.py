"""
Model Controller - The 'Juju' of Studio OS.
Dynamically routes requests to available Charms based on their Profiles.
"""
import os
import json
import logging
import importlib
from typing import Dict, Any, Optional
import google.generativeai as genai
from admin.config import config
from admin.brain.charm import Charm

logger = logging.getLogger("ModelController")

class ModelController:
    """
    Orchestrates the Charm Ecosystem.
    """
    def __init__(self):
        # 1. Configure LLM
        self.api_key = config.GEMINI_API_KEY
        self.model = None
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL)
            
        # 2. Discover Charms (Registry)
        self.registry = self._scan_registry()
        logger.info(f"ModelController initialized with {len(self.registry)} charms.")

    def _scan_registry(self) -> Dict[str, Dict]:
        """
        Scans admin/brain/agents/ for valid Charms.
        Returns: { "CharmName": { "id": "agent_dir", "description": "...", "path": "..." } }
        """
        agents_dir = os.path.join(config.BRAIN_DIR, "agents")
        registry = {}
        
        if not os.path.exists(agents_dir):
            return registry
            
        for agent_id in os.listdir(agents_dir):
            agent_path = os.path.join(agents_dir, agent_id)
            profile_path = os.path.join(agent_path, "PROFILE.md")
            
            if os.path.isdir(agent_path) and os.path.exists(profile_path):
                try:
                    # Lightweight Frontmatter Parsing
                    with open(profile_path, 'r') as f:
                        lines = f.readlines()
                        
                    # Extract name/role from Frontmatter manually to avoid dependency overhead if needed
                    # But leveraging `frontmatter` lib is better if available (BaseAgent uses it)
                    metadata = {}
                    try:
                        import frontmatter
                        post = frontmatter.load(profile_path)
                        metadata = post.metadata
                    except ImportError:
                        # Fallback simple parser
                        pass
                        
                    name = metadata.get("name", agent_id.capitalize())
                    role = metadata.get("role", "An AI Agent.")
                    description = f"{role}"
                    
                    registry[name] = {
                        "id": agent_id,
                        "description": description,
                        "path": agent_path,
                        # Check if a specific class implementation exists
                        # Convention: admin/brain/agents/{id}/charm.py -> class {Name}Charm
                        "custom_class": os.path.exists(os.path.join(agent_path, "charm.py"))
                    }
                except Exception as e:
                    logger.warning(f"Failed to index charm {agent_id}: {e}")
                    
        return registry

    def route(self, user_input: str) -> Dict[str, Any]:
        """
        Decides which Charm should handle the request.
        """
        if not self.model:
            return {"success": False, "error": "LLM not configured"}

        # Build dynamic list of capabilities
        charms_text = "\n".join([f"- {name}: {info['description']}" for name, info in self.registry.items()])
        
        prompt = f"""
        You are the Model Controller (Orchestrator) for Studio OS.
        Route the user request to the appropriate Charm.
        
        AVAILABLE CHARMS:
        {charms_text}
        
        USER INPUT: "{user_input}"
        
        INSTRUCTIONS:
        1. Identify the Intent.
        2. Select the best Charm to handle it.
        3. Determine the 'action' (e.g., 'research', 'write', 'status').
        4. Extract parameters.
        
        Return JSON ONLY:
        {{
            "charm": "CharmName" or null (if chit-chat),
            "action": "action_name" or null,
            "params": {{ "topic": "...", "query": "..." }},
            "response": "User facing message"
        }}
        """
        
        try:
            response = self.model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
            text_response = response.text.strip()
            if text_response.startswith("```json"):
                text_response = text_response[7:-3]
            
            data = json.loads(text_response)
            return {
                "success": True,
                **data
            }
        except Exception as e:
            logger.error(f"Routing failed: {e}")
            return {"success": False, "error": str(e), "response": "I couldn't route that request."}

    def execute(self, routing_result: Dict) -> Dict:
        """
        Instantiates the Charm and executes the action.
        """
        charm_name = routing_result.get("charm")
        action = routing_result.get("action")
        params = routing_result.get("params", {})
        
        if not charm_name or not action:
            return {"success": True, "message": routing_result.get("response")}
            
        charm_info = self.registry.get(charm_name)
        if not charm_info:
            return {"success": False, "error": f"Charm '{charm_name}' is not installed."}
            
        # Instantiate Charm
        try:
            charm_instance = self._load_charm_instance(charm_name, charm_info)
            result = charm_instance.on_action(action, params)
            return result
        except Exception as e:
            return {"success": False, "error": f"Charm execution failed: {e}"}

    def _load_charm_instance(self, name: str, info: Dict) -> Charm:
        """
        Loads the specific Charm class if it exists, otherwise generic Charm.
        """
        agent_id = info["id"]
        
        if info["custom_class"]:
            # Dynamic Import: admin.brain.agents.{agent_id}.charm
            try:
                module_path = f"admin.brain.agents.{agent_id}.charm"
                # We need to ensure this path is importable. 
                # Assuming admin package is in path.
                module = importlib.import_module(module_path)
                # Convention: Class is named "{AgentId}Charm" or just "Charm"
                # Let's search for a subclass of Charm
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if isinstance(attr, type) and issubclass(attr, Charm) and attr is not Charm:
                        return attr(agent_id)
            except Exception as e:
                logger.warning(f"Failed to load custom charm for {name}: {e}. Falling back to generic.")
                
        # Fallback to Generic Charm
        return Charm(agent_id)

# Singleton Accessor
_controller = None
def get_model_controller() -> ModelController:
    global _controller
    if _controller is None:
        _controller = ModelController()
    return _controller
