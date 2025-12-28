"""
Context Manager - The 'God View' for Agents
This module provides the ability for agents to 'see' the entire repository structure and content summaries.
It generates a 'Repo Map' similar to an IDE's file tree, enabling global context awareness.
"""

import os
import pathspec
from typing import Dict, List, Optional
from admin.config import config

class ContextManager:
    """
    Generates a token-optimized representation of the codebase.
    """
    
    def __init__(self, root_path: str = None):
        self.root_path = root_path or os.getcwd()
        self.ignore_spec = self._load_gitignore()

    def _load_gitignore(self) -> pathspec.PathSpec:
        """Loads .gitignore patterns."""
        gitignore = os.path.join(self.root_path, '.gitignore')
        lines = []
        if os.path.exists(gitignore):
            with open(gitignore, 'r') as f:
                lines = f.readlines()
        
        # Add default ignores
        lines.extend([
            '.git', '__pycache__', 'node_modules', '.DS_Store', 
            'studio_memory.db*', '*.pyc', '.env', 'venv'
        ])
        
        return pathspec.PathSpec.from_lines('gitwildmatch', lines)

    def generate_repo_map(self, max_depth: int = 3) -> str:
        """
        Generates a tree-like ASCII map of the project structure.
        
        Args:
            max_depth: How deep to traverse directory trees.
            
        Returns:
            A string containing the file tree.
        """
        tree_lines = []
        
        for root, dirs, files in os.walk(self.root_path):
            # Calculate current depth
            rel_path = os.path.relpath(root, self.root_path)
            depth = 0 if rel_path == '.' else rel_path.count(os.sep) + 1
            
            if depth > max_depth:
                # Don't recurse deeper
                del dirs[:]
                continue
                
            # Filter directories in-place
            dirs[:] = [d for d in dirs if not self.ignore_spec.match_file(os.path.join(rel_path, d))]
            
            # Indentation
            indent = "  " * depth
            
            # Add directory name
            if rel_path != '.':
                dirname = os.path.basename(root)
                tree_lines.append(f"{indent}📂 {dirname}/")
            
            # Add files
            for file in files:
                if self.ignore_spec.match_file(os.path.join(rel_path, file)):
                    continue
                tree_lines.append(f"{indent}  📄 {file}")
                
        return "\n".join(tree_lines)

    def get_key_file_summaries(self) -> str:
        """
        Returns content of high-leverage files (README, config, main.py).
        """
        key_files = [
            'README.md',
            'admin/config.py',
            'admin/app.py',
            'admin/api/main.py',
            'task.md'
        ]
        
        summaries = []
        for rel_path in key_files:
            abs_path = os.path.join(self.root_path, rel_path)
            if os.path.exists(abs_path):
                with open(abs_path, 'r') as f:
                    content = f.read(2000) # Truncate large files
                    summaries.append(f"## {rel_path}\n```\n{content}\n... (truncated)\n```")
                    
        return "\n\n".join(summaries)

    def get_global_context(self) -> str:
        """
        Combines Repo Map and Key Files for a full context window.
        """
        return (
            "# PROJECT GLOBAL CONTEXT\n\n"
            "## REPOSITORY STRUCTURE\n"
            f"{self.generate_repo_map()}\n\n"
            "## KEY SYSTEM FILES\n"
            f"{self.get_key_file_summaries()}"
        )
