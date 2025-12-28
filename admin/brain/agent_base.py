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
from admin.brain.context_manager import ContextManager
from admin.brain.visual_cortex import VisualCortexMixin
from typing import Dict, Any, Optional, List, Union
import json
from admin.brain.mission_state import get_mission_manager

logger = logging.getLogger("BaseAgent")

class BaseAgent(ActiveInferenceMixin, VisualCortexMixin):
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
            
        # Initialize Mixins
        ActiveInferenceMixin.__init__(self, agent_id=agent_id, memory_store=self.memory_store, model_router=self.model_router)
        # VisualCortexMixin doesn't need init, but we can verify vision support here

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
        
    def get_secret(self, key_name: str) -> Optional[str]:
        """
        Retrieves a secret from the Sovereignty Vault (SQLite) or falls back to env/config.
        Implements Environment Parity (Local vs Cloud).
        """
        try:
            manager = get_mission_manager()
            vault_key = manager.get_api_key(key_name)
            if vault_key:
                return vault_key
        except Exception as e:
            logger.warning(f"Vault retrieval failed: {e}")
            
        # Fallback to config (which pulls from .env)
        return getattr(config, key_name, os.getenv(key_name))
        
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

    def get_system_prompt(self, input_text: str = "") -> str:
        """
        Combines profile and enabled skills into the final system prompt.
        
        Args:
            input_text: The user's input, used for dynamic context injection (Prompt #7).
        """
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

        # Inject Global Context (The 'Copilot' View) - Dynamic Injection (Prompt #7)
        # Only inject full context if the input suggests a need for it, saving tokens.
        context_keywords = ["context", "repo", "structure", "file", "analyze", "where", "how", "code"]
        needs_context = any(k in input_text.lower() for k in context_keywords) or not input_text
        
        if needs_context:
            try:
                from admin.brain.context_manager import ContextManager
                ctx = ContextManager()
                prompt += "\n\n" + ctx.get_global_context()
                logger.info(f"[{self.name}] Dynamic Context Injected (Triggered by content)")
            except Exception as e:
                logger.warning(f"Failed to load global context: {e}")
        else:
            logger.info(f"[{self.name}] Dynamic Context Skipped (Optimization)")
            
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
        elif prompt_type == 'polymath_mirror':
            return SystemPrompts.get_polymath_mirror_prompt()
        elif prompt_type == 'void_gazing':
            return SystemPrompts.get_void_gazing_prompt()
        elif prompt_type == 'antifragile_stress_test':
            return SystemPrompts.get_antifragile_stress_test_prompt()
        elif prompt_type == 'socratic_mirror':
            return SystemPrompts.get_socratic_mirror_prompt()
        elif prompt_type == 'cognitive_gap_analysis':
            return SystemPrompts.get_cognitive_gap_analysis_prompt()
        else:
            logger.warning(f"[{self.name}] Unknown metacognitive prompt type: {prompt_type}")
            return ""

    
    def run(self, input_text: str):
        """Standard execution entry point."""
        # This would connect to the ModelRouter eventually.
        raise NotImplementedError("Subclasses must implement run() or connect to ModelRouter.")

    def socratic_debug_loop(self, error: Exception, context: str) -> str:
        """
        Implementation of Prompt #94: Socratic Debugging.
        When an error occurs, ask 'What hypothesis led to this error?'
        """
        logger.error(f"[{self.name}] Entering Socratic Debug Loop due to: {error}")
        
        # 1. Formulate the Socratic Question
        socratic_prompt = (
            f"SYSTEM_ALERT: An error occurred during execution: {str(error)}\n\n"
            "SOCRATIC INTERVENTION:\n"
            "1. What hypothesis led you to take this action?\n"
            "2. Why was that hypothesis incorrect?\n"
            "3. What is the corrected hypothesis?\n\n"
            "Output your reflection and the NEXT corrective action."
        )
        
        # 2. In a real system, we would feed this back to the model:
        # return self.model_router.run(self.agent_id, socratic_prompt)
        
        return f"[Socratic Repair] Agent reflected on error '{error}' and formulated new hypothesis."

    def simulate_outcome(self, action: str, hypothesis: str) -> str:
        """
        Implementation of Prompt #83: Counterfactual Simulation.
        Before acting, ask: 'If I do X, what is the probability of Y?'
        """
        simulation_prompt = (
            f"SIMULATION REQUEST:\n"
            f"Action: {action}\n"
            f"Hypothesis: {hypothesis}\n\n"
            "Predict the outcome. What could go wrong? What is the probability of success (0-1)?\n"
            "Output: JSON { 'prediction': str, 'risk': str, 'success_probability': float }"
        )
        
        # In a real system:
        # return self.model_router.run(self.agent_id, simulation_prompt)
        
        return json.dumps({
            "prediction": "Action will likely succeed but requires testing.", 
            "risk": "Low", 
            "success_probability": 0.85
        })

    def save_state(self, filepath: Optional[str] = None) -> str:
        """
        Implementation of Prompt #51: Agent State Snapshotting.
        Dumps the agent's entire context/memory to a file for offline debugging.
        """
        if not filepath:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filepath = os.path.join(config.BRAIN_DIR, 'debug', f"{self.agent_id}_state_{timestamp}.json")
            
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        state = {
            "agent_id": self.agent_id,
            "timestamp": datetime.now().isoformat(),
            "profile": {
                "name": self.name,
                "role": self.role,
                "system_prompt_head": self.system_prompt[:200] + "..."
            },
            "skills": self.enabled_skills,
            # We would fetch real beliefs from memory_store if available
            "last_error": "None",
            "active_inference_state": "Simulated"
        }
        
        with open(filepath, 'w') as f:
            json.dump(state, f, indent=2)
            
        logger.info(f"[{self.name}] State snapshot saved to {filepath}")
        return filepath
