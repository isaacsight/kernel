"""
Time Keeper - Timeline and Rollback Management

Inspired by Replit's time-travel/rollback feature.
Manages system snapshots and enables reverting to previous states.
"""

import os
import json
import shutil
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
import hashlib

logger = logging.getLogger("TimeKeeper")


class TimeKeeper:
    """
    The Time Keeper (System Historian)
    
    Mission: Enable time-travel through system state, allowing rollback
    to any previous checkpoint.
    
    Inspired by Replit's human-in-the-loop rollback feature.
    
    Responsibilities:
    - Create checkpoints before destructive operations
    - Track all agent actions with timestamps
    - Enable rollback to any previous state
    - Maintain action history
    """
    
    def __init__(self):
        self.name = "The Time Keeper"
        self.role = "System Historian"
        self.emoji = "⏳"
        
        # Storage paths
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.timeline_dir = os.path.join(self.base_dir, 'brain', 'timeline')
        self.checkpoints_dir = os.path.join(self.timeline_dir, 'checkpoints')
        self.history_file = os.path.join(self.timeline_dir, 'history.json')
        
        # Ensure directories exist
        os.makedirs(self.checkpoints_dir, exist_ok=True)
        
        # Load history
        self.history = self._load_history()
        
        logger.info(f"[{self.name}] Initialized with {len(self.history)} events in timeline")
    
    def _load_history(self) -> List[Dict]:
        """Load action history from disk."""
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return []
    
    def _save_history(self):
        """Persist history to disk."""
        with open(self.history_file, 'w') as f:
            json.dump(self.history[-1000:], f, indent=2)  # Keep last 1000 events
    
    def record_action(
        self,
        agent_name: str,
        action_type: str,
        description: str,
        affected_files: List[str] = None,
        reversible: bool = True,
        metadata: Dict = None
    ) -> str:
        """
        Record an action in the timeline.
        
        Returns: event_id for the recorded action
        """
        event_id = f"evt-{int(datetime.now().timestamp() * 1000)}"
        
        event = {
            "id": event_id,
            "timestamp": datetime.now().isoformat(),
            "agent": agent_name,
            "action_type": action_type,
            "description": description,
            "affected_files": affected_files or [],
            "reversible": reversible,
            "metadata": metadata or {},
            "checkpoint_id": None
        }
        
        self.history.append(event)
        self._save_history()
        
        logger.debug(f"[{self.name}] Recorded: {agent_name} - {action_type}")
        return event_id
    
    def checkpoint(
        self,
        name: str,
        files_to_backup: List[str],
        triggered_by: str = "manual"
    ) -> str:
        """
        Create a checkpoint (snapshot) of specified files.
        
        Args:
            name: Human-readable name for the checkpoint
            files_to_backup: List of file paths to include
            triggered_by: What triggered this checkpoint
            
        Returns: checkpoint_id
        """
        checkpoint_id = f"chk-{int(datetime.now().timestamp())}"
        checkpoint_path = os.path.join(self.checkpoints_dir, checkpoint_id)
        os.makedirs(checkpoint_path, exist_ok=True)
        
        backed_up = []
        for file_path in files_to_backup:
            if os.path.exists(file_path):
                # Create relative path structure
                rel_path = os.path.relpath(file_path, self.base_dir)
                dest_path = os.path.join(checkpoint_path, rel_path)
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                
                shutil.copy2(file_path, dest_path)
                backed_up.append(rel_path)
        
        # Save checkpoint metadata
        metadata = {
            "id": checkpoint_id,
            "name": name,
            "created_at": datetime.now().isoformat(),
            "triggered_by": triggered_by,
            "files": backed_up,
            "file_count": len(backed_up)
        }
        
        with open(os.path.join(checkpoint_path, "metadata.json"), 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Record in history
        self.record_action(
            self.name,
            "checkpoint_created",
            f"Checkpoint '{name}' with {len(backed_up)} files",
            backed_up,
            metadata={"checkpoint_id": checkpoint_id}
        )
        
        logger.info(f"[{self.name}] Created checkpoint '{name}' ({checkpoint_id})")
        return checkpoint_id
    
    def rollback(self, checkpoint_id: str) -> Dict:
        """
        Rollback to a previous checkpoint.
        
        Returns: Result of the rollback operation
        """
        checkpoint_path = os.path.join(self.checkpoints_dir, checkpoint_id)
        metadata_path = os.path.join(checkpoint_path, "metadata.json")
        
        if not os.path.exists(metadata_path):
            return {"success": False, "error": f"Checkpoint {checkpoint_id} not found"}
        
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        # Create a checkpoint of current state before rollback
        current_files = [
            os.path.join(self.base_dir, f) for f in metadata["files"]
        ]
        pre_rollback_id = self.checkpoint(
            f"Pre-rollback ({checkpoint_id})",
            current_files,
            triggered_by="rollback"
        )
        
        # Restore files from checkpoint
        restored = []
        errors = []
        
        for rel_path in metadata["files"]:
            src = os.path.join(checkpoint_path, rel_path)
            dest = os.path.join(self.base_dir, rel_path)
            
            try:
                if os.path.exists(src):
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    shutil.copy2(src, dest)
                    restored.append(rel_path)
            except Exception as e:
                errors.append({"file": rel_path, "error": str(e)})
        
        # Record rollback action
        self.record_action(
            self.name,
            "rollback",
            f"Rolled back to checkpoint '{metadata['name']}'",
            restored,
            metadata={
                "target_checkpoint": checkpoint_id,
                "pre_rollback_checkpoint": pre_rollback_id
            }
        )
        
        logger.info(f"[{self.name}] Rolled back to {checkpoint_id}, restored {len(restored)} files")
        
        return {
            "success": len(errors) == 0,
            "checkpoint_name": metadata["name"],
            "restored_files": restored,
            "errors": errors,
            "pre_rollback_checkpoint": pre_rollback_id
        }
    
    def list_checkpoints(self, limit: int = 20) -> List[Dict]:
        """List available checkpoints."""
        checkpoints = []
        
        if os.path.exists(self.checkpoints_dir):
            for name in sorted(os.listdir(self.checkpoints_dir), reverse=True)[:limit]:
                metadata_path = os.path.join(self.checkpoints_dir, name, "metadata.json")
                if os.path.exists(metadata_path):
                    with open(metadata_path, 'r') as f:
                        checkpoints.append(json.load(f))
        
        return checkpoints
    
    def get_timeline(
        self,
        agent_filter: str = None,
        action_filter: str = None,
        limit: int = 50
    ) -> List[Dict]:
        """
        Get the action timeline with optional filters.
        """
        events = self.history.copy()
        
        if agent_filter:
            events = [e for e in events if e["agent"] == agent_filter]
        
        if action_filter:
            events = [e for e in events if e["action_type"] == action_filter]
        
        # Return most recent first
        return list(reversed(events[-limit:]))
    
    def get_file_history(self, file_path: str) -> List[Dict]:
        """Get all actions that affected a specific file."""
        rel_path = os.path.relpath(file_path, self.base_dir)
        
        return [
            event for event in self.history
            if rel_path in event.get("affected_files", [])
        ]
    
    def undo_last(self) -> Optional[Dict]:
        """
        Attempt to undo the last reversible action.
        """
        # Find the most recent reversible action that created a checkpoint
        for event in reversed(self.history):
            if event.get("reversible") and event.get("metadata", {}).get("checkpoint_id"):
                checkpoint_id = event["metadata"]["checkpoint_id"]
                return self.rollback(checkpoint_id)
        
        return {"success": False, "error": "No reversible action found"}


# Singleton instance
_time_keeper = None

def get_time_keeper() -> TimeKeeper:
    """Get the global time keeper instance."""
    global _time_keeper
    if _time_keeper is None:
        _time_keeper = TimeKeeper()
    return _time_keeper


if __name__ == "__main__":
    tk = TimeKeeper()
    
    # Test recording actions
    tk.record_action("Alchemist", "generate", "Generated post about AI")
    tk.record_action("Guardian", "audit", "Audited content")
    
    print("Timeline:")
    for event in tk.get_timeline(limit=5):
        print(f"  {event['timestamp']}: {event['agent']} - {event['action_type']}")
    
    print(f"\nCheckpoints: {len(tk.list_checkpoints())}")
