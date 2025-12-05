"""
Office Manager - Managing the Virtual Workspace

Tracks where agents are, what they are doing, and maintains the shared whiteboard.
"""

import os
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from admin.engineers.social_engine import get_social_engine

logger = logging.getLogger("OfficeManager")

class OfficeManager:
    """
    Manages the state of the AI Office.
    """
    
    def __init__(self):
        self.name = "Office Manager"
        self.whiteboard_file = os.path.join(
            os.path.dirname(__file__), '..', 'brain', 'office_whiteboard.json'
        )
        self.social = get_social_engine()
        self.whiteboard = self._load_whiteboard()
        
        # In-memory status tracking (resets on restart, which is fine for "live" status)
        self.agent_states = self._init_agent_states()
        
        logger.info(f"[{self.name}] Office opened. {len(self.whiteboard['items'])} items on whiteboard.")

    def _init_agent_states(self) -> Dict:
        """Initialize desk states for all personas."""
        personas = self.social.get_personas()
        states = {}
        for name, data in personas.items():
            states[name] = {
                "status": "Idle",  # Idle, Working, Meeting, Break
                "current_task": "Waiting for input...",
                "last_active": datetime.now().isoformat(),
                "location": "Desk", # Desk, Whiteboard, Meeting Room, Coffee Machine
                "mood": "Neutral"
            }
        return states

    def _load_whiteboard(self) -> Dict:
        if os.path.exists(self.whiteboard_file):
            try:
                with open(self.whiteboard_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading whiteboard: {e}")
        
        return {"items": []}

    def _save_whiteboard(self):
        os.makedirs(os.path.dirname(self.whiteboard_file), exist_ok=True)
        with open(self.whiteboard_file, 'w') as f:
            json.dump(self.whiteboard, f, indent=2, default=str)

    def get_office_state(self) -> Dict:
        """Get the full state of the office."""
        return {
            "agents": self.agent_states,
            "whiteboard": self.whiteboard["items"],
            "personas": self.social.get_personas()
        }

    def update_agent_status(self, agent_name: str, status: str, task: str, location: str = "Desk"):
        """Update an agent's live status."""
        for name in self.agent_states:
            # Flexible matching
            if agent_name.lower() in name.lower():
                self.agent_states[name] = {
                    "status": status,
                    "current_task": task,
                    "last_active": datetime.now().isoformat(),
                    "location": location,
                    "mood": self._determine_mood(status, task)
                }
                logger.info(f"[{self.name}] {name} is now {status} at {location}")
                return

    def _determine_mood(self, status: str, task: str) -> str:
        """Simple rule-based mood detector."""
        if "error" in task.lower() or "fail" in task.lower():
            return "Frustrated"
        if "success" in task.lower():
            return "Happy"
        if status == "Meeting":
            return "Focused"
        if status == "Break":
            return "Relaxed"
        return "Neutral"

    def add_whiteboard_item(self, content: str, author: str, category: str = "Idea") -> Dict:
        """Add a sticky note to the whiteboard."""
        item = {
            "id": str(uuid.uuid4())[:8],
            "content": content,
            "author": author,
            "category": category, # Idea, Task, Reference, Quote
            "created_at": datetime.now().isoformat(),
            "position": {"x": 0, "y": 0} # Frontend will handle placement usually, defaults to stack
        }
        self.whiteboard["items"].insert(0, item)
        self._save_whiteboard()
        return item

    def clear_whiteboard(self):
        self.whiteboard["items"] = []
        self._save_whiteboard()

# Singleton
_office_manager = None

def get_office_manager():
    global _office_manager
    if _office_manager is None:
        _office_manager = OfficeManager()
    return _office_manager

if __name__ == "__main__":
    mgr = OfficeManager()
    print(json.dumps(mgr.get_office_state(), indent=2))
