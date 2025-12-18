"""
Skill Loader & Management System

Implements the "Claude Agent Skills" architecture:
- Skills are directory-based
- Minimal metadata (SKILL.md frontmatter) is always loaded
- Detailed instructions (SKILL.md body) are loaded on demand
"""

import os
import yaml
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional
import frontmatter

logger = logging.getLogger("Skills")

@dataclass
class Skill:
    name: str
    description: str
    path: str
    instructions: str = ""
    
    @property
    def metadata_prompt(self) -> str:
        """Returns the lightweight description for the system prompt."""
        return f"- {self.name}: {self.description}"

class SkillLoader:
    def __init__(self, skills_dir: str):
        self.skills_dir = skills_dir
        self.skills: Dict[str, Skill] = {}
        self.load_skills()
        
    def load_skills(self):
        """Scans the skills directory and loads metadata for all found skills."""
        if not os.path.exists(self.skills_dir):
            os.makedirs(self.skills_dir, exist_ok=True)
            return

        for item in os.listdir(self.skills_dir):
            skill_path = os.path.join(self.skills_dir, item)
            if os.path.isdir(skill_path):
                skill_file = os.path.join(skill_path, "SKILL.md")
                if os.path.exists(skill_file):
                    try:
                        self._load_single_skill(skill_file)
                    except Exception as e:
                        logger.error(f"Failed to load skill at {skill_path}: {e}")

    def _load_single_skill(self, file_path: str):
        """Parses a SKILL.md file and adds it to the registry."""
        with open(file_path, 'r') as f:
            post = frontmatter.load(f)
            
        name = post.metadata.get('name')
        description = post.metadata.get('description')
        
        if not name or not description:
            logger.warning(f"Skill at {file_path} missing required 'name' or 'description' in frontmatter.")
            return

        # Store the skill. Instructions are the content of the markdown file.
        self.skills[name] = Skill(
            name=name,
            description=description,
            path=os.path.dirname(file_path),
            instructions=post.content
        )
        logger.info(f"Loaded skill: {name}")

    def get_skill(self, name: str) -> Optional[Skill]:
        """Retrieves a specific skill by name."""
        return self.skills.get(name)

    def get_system_prompt_additions(self) -> str:
        """Generates the text to add to the agent's system prompt."""
        if not self.skills:
            return ""
            
        prompt = "\n\nAVAILABLE SKILLS:\n"
        for skill in self.skills.values():
            prompt += skill.metadata_prompt + "\n"
        
        prompt += "\nTo use a skill, explicitly mention you are activating it. " \
                  "The system will then provide you with the detailed instructions for that skill.\n"
        return prompt

if __name__ == "__main__":
    # Test harness
    import sys
    
    # Create a dummy skill for testing if directory doesn't exist
    test_dir = "./test_skills"
    os.makedirs(test_dir, exist_ok=True)
    
    skill_dir = os.path.join(test_dir, "test-skill")
    os.makedirs(skill_dir, exist_ok=True)
    
    with open(os.path.join(skill_dir, "SKILL.md"), "w") as f:
        f.write("---\nname: test-skill\ndescription: A test skill for verification.\n---\n# Test Skill\nThis is the detailed instruction.")
        
    loader = SkillLoader(test_dir)
    print(f"Loaded {len(loader.skills)} skills.")
    print(loader.get_system_prompt_additions())
    
    skill = loader.get_skill("test-skill")
    if skill:
        print(f"Skill Content: {skill.instructions}")
        
    # Cleanup
    import shutil
    shutil.rmtree(test_dir)
