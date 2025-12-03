import logging
import sys
import os

# Add parent directory to path to import plugins
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.plugins import Plugin

logger = logging.getLogger("Architect")

class Architect:
    """
    The Architect (AI Solutions Architect)
    
    Mission: Ensure the core infrastructure is robust, fast, and extensible.
    
    Responsibilities:
    - System Design & Scalability
    - Plugin Architecture
    - API Integration
    """
    def __init__(self):
        self.name = "The Architect"
        self.role = "AI Solutions Architect"
        self.plugins = []
        self.node_url = os.environ.get("STUDIO_NODE_URL")

    def register_plugin(self, plugin: Plugin):
        """
        Registers a new plugin to the system.
        """
        if not isinstance(plugin, Plugin):
            logger.error(f"Failed to register plugin: {plugin} is not a valid Plugin instance.")
            return
        
        self.plugins.append(plugin)
        logger.info(f"Registered plugin: {plugin.name}")

    def run_hook(self, hook_name, *args, **kwargs):
        """
        Executes a specific hook across all registered plugins.
        """
        logger.debug(f"Running hook: {hook_name}")
        for plugin in self.plugins:
            try:
                hook_method = getattr(plugin, hook_name, None)
                if callable(hook_method):
                    hook_method(*args, **kwargs)
            except Exception as e:
                logger.error(f"Error in plugin {plugin.name} during {hook_name}: {e}")

    def create_blueprint(self, mission):
        """
        Creates a technical plan (Blueprint) to achieve the mission.
        """
        logger.info(f"Creating blueprint for mission: {mission}")
        
        if not self.node_url:
            return {"error": "STUDIO_NODE_URL not configured."}

        # 1. Gather Context (simplified for now)
        # In a real system, we'd look at the files mentioned in the mission
        context_files = ["admin/core.py", "admin/api/main.py"]
        code_context = ""
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        for rel_path in context_files:
            path = os.path.join(base_dir, rel_path)
            if os.path.exists(path):
                with open(path, 'r') as f:
                    code_context += f"\n--- FILE: {rel_path} ---\n{f.read()[:2000]}\n"

        prompt = f"""
        You are The Architect. Create a JSON blueprint to achieve this mission: "{mission}"
        
        CODE CONTEXT:
        {code_context}
        
        Return ONLY valid JSON with this structure:
        {{
            "plan_summary": "Brief description of changes",
            "changes": [
                {{
                    "file": "path/to/file.py",
                    "action": "modify", 
                    "search": "exact string to replace",
                    "replace": "new content"
                }}
            ]
        }}
        """
        
        import requests
        import json
        
        try:
            payload = {
                "prompt": prompt,
                "model": "mistral",
                "system_prompt": "You are a senior software architect. Output ONLY JSON."
            }
            response = requests.post(f"{self.node_url}/generate", json=payload, timeout=60)
            response.raise_for_status()
            
            content = response.json().get("response", "")
            
            # Clean up potential markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
                
            blueprint = json.loads(content.strip())
            return blueprint
            
        except Exception as e:
            logger.error(f"Blueprint creation failed: {e}")
            return {"error": str(e)}

    def implement_blueprint(self, blueprint):
        """
        Executes the changes defined in the blueprint.
        """
        logger.info("Implementing blueprint...")
        
        if "error" in blueprint:
            return f"Cannot implement blueprint with errors: {blueprint['error']}"
            
        changes = blueprint.get("changes", [])
        results = []
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

        for change in changes:
            try:
                file_path = os.path.join(base_dir, change["file"])
                action = change.get("action")
                
                if action == "modify":
                    if not os.path.exists(file_path):
                        results.append(f"Failed: File not found {change['file']}")
                        continue
                        
                    with open(file_path, 'r') as f:
                        content = f.read()
                    
                    search_text = change.get("search")
                    replace_text = change.get("replace")
                    
                    if search_text in content:
                        new_content = content.replace(search_text, replace_text)
                        with open(file_path, 'w') as f:
                            f.write(new_content)
                        results.append(f"Modified {change['file']}")
                    else:
                        results.append(f"Failed: Search text not found in {change['file']}")
                        
                elif action == "create":
                    # Handle creation
                    pass
                    
            except Exception as e:
                results.append(f"Error processing {change.get('file')}: {e}")
                
        return "\n".join(results)