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
            response = requests.post(f"{self.node_url}/api/generate", json=payload, timeout=60)
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
        Executes the changes defined in the blueprint using the Codex CLI.
        """
        logger.info("Implementing blueprint via Codex CLI...")
        
        if "error" in blueprint:
            return f"Cannot implement blueprint with errors: {blueprint['error']}"
            
        changes = blueprint.get("changes", [])
        if not changes:
            return "No changes to implement."

        import subprocess
        import json
        
        results = []
        # We pass the entire list of changes to Codex for an atomic-ish execution
        # Use workspace-write mode for safety
        try:
            prompt = f"Apply these changes to the codebase accurately:\n{json.dumps(changes, indent=2)}"
            
            # Run codex exec with full-auto mode and explicit API key
            api_key = os.environ.get("OPENAI_API_KEY")
            config_arg = f"api_key=\"{api_key}\"" if api_key else ""
            
            cmd = ["codex"]
            if config_arg:
                cmd.extend(["-c", config_arg])
            cmd.extend(["--full-auto", "exec", prompt])
            
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            results.append("Codex Execution Output:")
            results.append(process.stdout)
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Codex execution failed: {e.stderr}")
            results.append(f"Command failed with error: {e.stderr}")
        except Exception as e:
            logger.error(f"Error during Codex execution: {e}")
            results.append(f"Error: {str(e)}")
            
        return "\n".join(results)