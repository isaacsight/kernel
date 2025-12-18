
import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.brain.skills import SkillLoader
from admin.config import config
from admin.engineers.researcher import Researcher

def verify_skills():
    print("=== Verifying Agent Skills ===\n")
    
    # 1. Test Loader directly
    print("1. Testing SkillLoader...")
    skills_dir = config.SKILLS_DIR
    print(f"Skills Directory: {skills_dir}")
    
    loader = SkillLoader(skills_dir)
    print(f"Loaded Skills: {list(loader.skills.keys())}")
    
    if "web-scout" in loader.skills and "filesystem" in loader.skills:
        print("✅ Core skills found.")
    else:
        print("❌ Missing core skills.")
        
    # 2. Test Agent Integration
    print("\n2. Testing Researcher Integration...")
    researcher = Researcher()
    
    # Check if loader is attached
    if hasattr(researcher, 'skill_loader'):
        print(f"✅ Researcher has skill_loader with {len(researcher.skill_loader.skills)} skills.")
        
        # Check system prompt generation
        prompt_additions = researcher.skill_loader.get_system_prompt_additions()
        print("\nGenerated System Prompt Additions:")
        print("-" * 40)
        print(prompt_additions)
        print("-" * 40)
        
        if "web-scout" in prompt_additions and "filesystem" in prompt_additions:
             print("✅ System prompt contains skill metadata.")
        else:
             print("❌ System prompt missing skill metadata.")
             
    else:
        print("❌ Researcher missing skill_loader attribute.")

if __name__ == "__main__":
    verify_skills()
