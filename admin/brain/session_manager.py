import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from admin.config import config

logger = logging.getLogger("SessionManager")

class SessionManager:
    """
    Manages the lifecycle of Research Sessions.
    Handles persistence to the CogOS Ledger and artifact generation.
    """
    
    def __init__(self):
        self.sessions_dir = os.path.join(config.BRAIN_DIR, "research_sessions")
        os.makedirs(self.sessions_dir, exist_ok=True)
        
    def create_session(self, inquiry: str, trace: List[Dict], directive: str) -> str:
        """Creates and persists a new research session."""
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        session_data = {
            "id": session_id,
            "timestamp": datetime.now().isoformat(),
            "inquiry": inquiry,
            "trace": trace,
            "directive": directive,
            "metadata": {
                "version": "1.0",
                "orchestrator": "The Sovereign"
            }
        }
        
        filepath = os.path.join(self.sessions_dir, f"{session_id}.json")
        with open(filepath, "w") as f:
            json.dump(session_data, f, indent=2)
            
        logger.info(f"Session persisted: {session_id}")
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict]:
        """Retrieves a session by ID."""
        filepath = os.path.join(self.sessions_dir, f"{session_id}.json")
        if not os.path.exists(filepath):
            return None
            
        with open(filepath, "r") as f:
            return json.load(f)
            
    def list_sessions(self, limit: int = 20) -> List[Dict]:
        """Lists recent sessions."""
        sessions = []
        files = sorted(
            [f for f in os.listdir(self.sessions_dir) if f.endswith(".json")],
            reverse=True
        )[:limit]
        
        for f in files:
            path = os.path.join(self.sessions_dir, f)
            try:
                with open(path, "r") as s:
                    data = json.load(s)
                    sessions.append({
                        "id": data.get("id"),
                        "timestamp": data.get("timestamp"),
                        "inquiry": data.get("inquiry")
                    })
            except:
                continue
        return sessions

    def delete_session(self, session_id: str) -> bool:
        """Deletes a session."""
        filepath = os.path.join(self.sessions_dir, f"{session_id}.json")
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False

# Global instance
_manager = None
def get_session_manager():
    global _manager
    if _manager is None:
        _manager = SessionManager()
    return _manager
