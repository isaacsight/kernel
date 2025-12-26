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
from admin.brain.skills import SkillLoader
from admin.config import config
from admin.brain.memory_store import get_memory_store
from admin.brain.active_inference import ActiveInferenceMixin
from admin.brain.system_prompts import SystemPrompts
from typing import Dict, Any, Optional, List, Union

logger = logging.getLogger("BaseAgent")

class BaseAgent(ActiveInferenceMixin):
    def __init__(self, agent_id: str):
        """
        Initialize the agent by loading its definition from the Brain.
        
        Args:
            agent_id: The folder name in admin/brain/agents/ (e.g., 'alchemist')
        """
        self.agent_id = agent_id
        self.brain_path = os.path.join(config.BRAIN_DIR, 'agents', agent_id)
        
        # Initialize Active Inference substrate
        self.memory_store = get_memory_store()
        try:
            from admin.brain.model_router import get_model_router
            self.model_router = get_model_router()
        except:
            self.model_router = None
            
        super().__init__(agent_id=agent_id, memory_store=self.memory_store, model_router=self.model_router)

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
        
        logger.info(f"[{self.name}] Initialized with Active Inference engine")
        
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

    def decide(self, goal: str, context: str, potential_actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        High-level Decision Loop using Active Inference.
        Selects the action that minimizes Expected Free Energy (G).
        """
        # 1. Update internal beliefs about the goal/context
        self.update_beliefs("current_task", {"goal": goal}, context)
        
        # 2. Evaluate actions via EFE
        best_action = self.select_action_via_efe(potential_actions)
        
        logger.info(f"[{self.name}] Active Inference decided: {best_action.get('type')} (EFE: {best_action.get('efe', 0):.2f})")
        return best_action

    def get_metacognitive_prompt(self, prompt_type: str, **kwargs) -> str:
        """
        Retrieve a 'Sovereign-Grade' system prompt for metacognitive reasoning.
        
        Args:
            prompt_type: One of 'grand_council', 'intelligence_delta', 'cognitive_ledger', 'sovereign_alignment', 'recursive_optimization'
            **kwargs: Arguments to pass to the specific prompt generator (e.g. 'code_context')
            
        Returns:
            The requested prompt string.
        """
        if prompt_type == 'grand_council':
            return SystemPrompts.get_grand_council_prompt()
        elif prompt_type == 'intelligence_delta':
            return SystemPrompts.get_intelligence_delta_audit_prompt(kwargs.get('code_or_plan'))
        elif prompt_type == 'cognitive_ledger':
            return SystemPrompts.get_cognitive_ledger_post_mortem_prompt()
        elif prompt_type == 'sovereign_alignment':
            return SystemPrompts.get_sovereign_alignment_check_prompt()
        elif prompt_type == 'recursive_optimization':
            return SystemPrompts.get_recursive_optimization_prompt()
        elif prompt_type == 'active_inference':
            return SystemPrompts.get_active_inference_ops_prompt()
        elif prompt_type == 'divergent_stochastics':
            return SystemPrompts.get_divergent_stochastics_prompt()
        elif prompt_type == 'sovereign_safety':
            return SystemPrompts.get_sovereign_safety_prompt()
        elif prompt_type == 'gallery_curator':
            return SystemPrompts.get_gallery_curator_prompt()
        elif prompt_type == 'ux_heuristic':
            return SystemPrompts.get_ux_heuristic_prompt()
        elif prompt_type == 'network_weaver':
            return SystemPrompts.get_network_weaver_prompt()
        elif prompt_type == 'strategy_alignment':
            return SystemPrompts.get_strategy_alignment_prompt()
        elif prompt_type == 'alchemist_transmutation':
            return SystemPrompts.get_alchemist_transmutation_prompt()
        else:
            logger.warning(f"[{self.name}] Unknown metacognitive prompt type: {prompt_type}")
            return ""

    def run(self, input_text: str):
        """Standard execution entry point."""
        # This would connect to the ModelRouter eventually.
        raise NotImplementedError("Subclasses must implement run() or connect to ModelRouter.")
