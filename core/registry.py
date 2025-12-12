import os
import ast
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger("AgentRegistry")

class AgentRegistry:
    def __init__(self, engineers_dir: str):
        self.engineers_dir = engineers_dir
        self.agents: Dict[str, Dict[str, Any]] = {}
        self.load_manifest()

    def load_manifest(self):
        """
        Scans the engineers directory for Python files and extracts agent metadata.
        Uses AST parsing to avoid importing/executing code during scan.
        """
        logger.info(f"Scanning for agents in {self.engineers_dir}...")
        
        if not os.path.exists(self.engineers_dir):
            logger.warning(f"Engineers directory not found: {self.engineers_dir}")
            return

        for filename in os.listdir(self.engineers_dir):
            if filename.endswith(".py") and not filename.startswith("__"):
                self._parse_agent_file(os.path.join(self.engineers_dir, filename))
                
        logger.info(f"Loaded {len(self.agents)} agents into registry.")

    def _parse_agent_file(self, filepath: str):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read())
                
            for node in tree.body:
                if isinstance(node, ast.ClassDef):
                    # Heuristic: Valid agents usually end with 'Engineer', 'Coach', 'Artist', etc.
                    # or inherit from BaseAgent (which is hard to check via AST without base classes)
                    # For now, we take ALL classes that look like agents (CamelCase, not 'config')
                    if node.name[0].isupper() and "Config" not in node.name:
                        docstring = ast.get_docstring(node) or "No description available."
                        
                        # Clean up name (snake_case from filename is often better for IDs)
                        file_id = os.path.basename(filepath).replace(".py", "")
                        
                        self.agents[node.name] = {
                            "name": node.name,
                            "file_id": file_id,
                            "filepath": filepath,
                            "description": docstring.split('\n')[0], # First line of docstring
                            "full_description": docstring
                        }
        except Exception as e:
            logger.warning(f"Failed to parse {filepath}: {e}")

    def get_roster_summary(self) -> str:
        """
        Returns a formatted string of the team roster for the LLM context.
        """
        summary = "## Studio Team Roster:\n"
        for name, info in sorted(self.agents.items()):
            summary += f"- **{name}**: {info['description']}\n"
        return summary

# Singleton (Lazy init)
_registry = None

def get_registry():
    global _registry
    if not _registry:
        # Assuming typical structure: core/registry.py -> admin/engineers
        # core is sibling to admin? No, admin/ is root-ish.
        # Based on file structure: /Users/isaachernandez/blog design/admin/engineers
        # and this file is in /Users/isaachernandez/blog design/core/registry.py
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        engineers_path = os.path.join(base_dir, "admin", "engineers")
        _registry = AgentRegistry(engineers_path)
    return _registry
