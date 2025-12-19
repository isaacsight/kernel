"""
Charm - The Atomic Unit of the Studio OS Ecosystem.
Inspired by Canonical's Juju Charms.

A Charm is an Agent that has a formal Lifecycle:
- on_install: Setup tools/models
- on_config_changed: Reload profiles/prompts
- on_action: Execute a named task
"""
import os
import logging
from typing import Dict, Any, Optional
from admin.brain.agent_base import BaseAgent
from admin.config import config

logger = logging.getLogger("Charm")

class Charm(BaseAgent):
    """
    Standardizes Agent behavior into a Lifecycle Pattern.
    """
    def __init__(self, charm_name: str):
        # BaseAgent loads the PROFILE.md and SKILLS.yaml
        super().__init__(agent_id=charm_name)
        
        self.charm_name = charm_name
        self.status = "maintenance" # maintenance, active, blocked, waiting
        self.status_message = "Initializing..."
        
        # Trigger Install Lifecycle Hook
        self.on_install()
        
    def on_install(self):
        """
        Called once when the Charm is instantiated.
        Load static resources, models, or connect to services.
        Override this in subclasses for specific setup.
        """
        self.set_status("maintenance", "Installing...")
        # BaseAgent __init__ has already loaded the Profile/Skills
        self.set_status("active", "Ready")
        
    def on_config_changed(self):
        """
        Called when configuration (PROFILE.md/SKILLS.yaml) changes.
        """
        self.set_status("maintenance", "Configuring...")
        # Reload the profile from disk
        self.profile = self._load_profile()
        self.enabled_skills = self._load_enabled_skills()
        self.set_status("active", "Configured")

    def on_action(self, action_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        The main entry point for requests.
        Dispatches to methods named `_action_{action_name}`.
        """
        method_name = f"_action_{action_name}"
        
        # 1. Validation
        if not hasattr(self, method_name):
            error_msg = f"Action '{action_name}' not implemented on charm '{self.charm_name}'."
            logger.warning(error_msg)
            return {"success": False, "error": error_msg}
            
        # 2. Execution
        try:
            self.set_status("active", f"Executing {action_name}")
            handler = getattr(self, method_name)
            
            # Execute the handler
            result = handler(params)
            
            self.set_status("active", "Idle")
            return result
            
        except Exception as e:
            self.set_status("blocked", f"Error in {action_name}: {str(e)}")
            logger.error(f"[{self.charm_name}] Action {action_name} failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def set_status(self, status: str, message: str):
        """Updates the status of the Charm for the Controller to see."""
        self.status = status
        self.status_message = message
        logger.info(f"[{self.charm_name}] Status: {status} - {message}")
