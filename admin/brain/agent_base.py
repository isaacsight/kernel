"""
Base Agent - The Foundation of the Data-Driven Brain

This class enables agents to be defined primarily by data (PROFILE.md, SKILLS.yaml).
It handles:
- Loading persona and mission from filesystem.
- Loading and exposing skills.
- Standardized task execution.
"""

import os
import yaml
import logging
from typing import Dict, Any, Optional, List, Union
from admin.brain.skills import SkillLoader
from admin.config import config

logger = logging.getLogger("BaseAgent")

class BaseAgent:
    def __init__(self, agent_id: str):
        """
        Initialize the agent by loading its definition from the Brain.
        
        Args:
            agent_id: The folder name in admin/brain/agents/ (e.g., 'alchemist')
        """
        self.agent_id = agent_id
        self.brain_path = os.path.join(config.BRAIN_DIR, 'agents', agent_id)
        
        if not os.path.exists(self.brain_path):
            raise ValueError(f"Agent definition not found at {self.brain_path}")
            
        # 1. Load Profile (Persona)
        self.profile = self._load_profile()
        self.name = self.profile.get('name', agent_id.capitalize())
        self.role = self.profile.get('role', 'Agent')
        self.system_prompt = self.profile.get('content', '')
        
        # 2. Load Skills
        self.skill_loader = SkillLoader(config.SKILLS_DIR) # Load all available definitions
        self.enabled_skills = self._load_enabled_skills()
        
        logger.info(f"[{self.name}] Initialized from brain/agents/{agent_id}")
        
    def _load_profile(self) -> Dict[str, Any]:
        """Reads PROFILE.md frontmatter and content."""
        import frontmatter
        profile_path = os.path.join(self.brain_path, 'PROFILE.md')
        if not os.path.exists(profile_path):
            return {"name": self.agent_id, "content": "You are a helpful AI assistant."}
            
        with open(profile_path, 'r') as f:
            post = frontmatter.load(f)
            
        return {
            "name": post.metadata.get('name', self.agent_id),
            "role": post.metadata.get('role', 'Agent'),
            "content": post.content
        }

    def _load_enabled_skills(self) -> List[str]:
        """Reads SKILLS.yaml to see what this agent is allowed to use."""
        skills_path = os.path.join(self.brain_path, 'SKILLS.yaml')
        if not os.path.exists(skills_path):
            return []
            
        with open(skills_path, 'r') as f:
            data = yaml.safe_load(f) or {}
            
        return data.get('skills', [])

    def get_system_prompt(self) -> str:
        """Combines profile and enabled skills into the final system prompt."""
        prompt = self.system_prompt
        
        # Inject Skill Instructions
        if self.enabled_skills:
            prompt += "\n\n## ENABLED SKILLS\n"
            prompt += "You have access to the following skills. To use them, output the corresponding tool call format.\n"
            
            for skill_name in self.enabled_skills:
                skill = self.skill_loader.get_skill(skill_name)
                if skill:
                    prompt += f"\n### {skill.name}\n{skill.description}\n"
                    # We could inject full instructions here, or depend on the 'generic' knowledge 
                    # from the SkillLoader if we want. For now, let's keep it lightweight.
                else:
                    logger.warning(f"[{self.name}] Configured skill '{skill_name}' not found in registry.")
                    
            prompt += "\n" + self.skill_loader.get_system_prompt_additions()
            
        return prompt

    def run(self, input_text: str):
        """Standard execution entry point."""
        # This would connect to the ModelRouter eventually.
        raise NotImplementedError("Subclasses must implement run() or connect to ModelRouter.")
