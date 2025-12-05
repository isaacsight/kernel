"""
Node Sync Manager - Orchestrates knowledge sharing between Controller and Node.
"""

import os
import logging
import requests
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Any

from admin.brain.collective_intelligence import get_collective_intelligence
from config import config

logger = logging.getLogger("NodeSync")

class NodeSyncManager:
    """
    Manages synchronization of the Collective Intelligence between
    the local Controller and the remote Studio Node.
    """
    
    def __init__(self):
        self.collective = get_collective_intelligence()
        self.node_url = os.environ.get("STUDIO_NODE_URL", "http://192.168.1.56:8000")
        self.last_sync_file = os.path.join(os.path.dirname(__file__), "last_sync.txt")
        self.last_sync_time = self._load_last_sync()
        
    def _load_last_sync(self) -> str:
        """Load the timestamp of the last successful sync."""
        if os.path.exists(self.last_sync_file):
            with open(self.last_sync_file, 'r') as f:
                return f.read().strip()
        # Default to 24 hours ago
        return (datetime.now() - timedelta(days=1)).isoformat()
        
    def _save_last_sync(self):
        """Save the current timestamp as the last sync time."""
        self.last_sync_time = datetime.now().isoformat()
        with open(self.last_sync_file, 'w') as f:
            f.write(self.last_sync_time)
            
    def sync(self) -> Dict[str, Any]:
        """
        Perform a bidirectional sync.
        1. Push local updates to Node.
        2. Pull remote updates from Node.
        """
        if not self.node_url:
            logger.warning("No STUDIO_NODE_URL configured. Skipping sync.")
            return {"status": "skipped", "reason": "no_url"}
            
        logger.info(f"Starting sync with Node at {self.node_url}...")
        results = {"pushed": {}, "pulled": {}}
        
        try:
            # 1. Push Local Updates
            # We get all knowledge since the last sync
            local_updates = self.collective.get_knowledge_since(self.last_sync_time)
            
            # Only push if there's something to push
            if any(local_updates.values()):
                push_response = requests.post(
                    f"{self.node_url}/sync/push",
                    json={
                        "knowledge": local_updates,
                        "timestamp": datetime.now().isoformat()
                    },
                    timeout=10
                )
                push_response.raise_for_status()
                results["pushed"] = push_response.json().get("added", {})
            else:
                results["pushed"] = "No local updates"
                
            # 2. Pull Remote Updates
            pull_response = requests.get(
                f"{self.node_url}/sync/pull",
                params={"since": self.last_sync_time},
                timeout=10
            )
            pull_response.raise_for_status()
            remote_updates = pull_response.json().get("updates", {})
            
            # Merge into local brain
            if any(remote_updates.values()):
                added = self.collective.merge_knowledge(remote_updates)
                results["pulled"] = added
            else:
                results["pulled"] = "No remote updates"
                
            # Update timestamp only if successful
            self._save_last_sync()
            logger.info("Sync completed successfully.")
            
            return results
            
        except Exception as e:
            logger.error(f"Sync failed: {e}")
            return {"status": "failed", "error": str(e)}

# Singleton
_sync_manager = None

def get_sync_manager() -> NodeSyncManager:
    global _sync_manager
    if _sync_manager is None:
        _sync_manager = NodeSyncManager()
    return _sync_manager

if __name__ == "__main__":
    # Test run
    logging.basicConfig(level=logging.INFO)
    manager = NodeSyncManager()
    print(manager.sync())
