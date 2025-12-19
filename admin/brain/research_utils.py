import os
import json
import time
from typing import Dict, List, Any, Optional
import sys

# Ensure project root is in path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if project_root not in sys.path:
    sys.path.append(project_root)

from admin.config import config

LEDGER_PATH = os.path.join(config.BRAIN_DIR, "research_ledger.json")

def load_ledger() -> Dict[str, Any]:
    """Loads the research ledger from disk."""
    if not os.path.exists(LEDGER_PATH):
        return {"lab_metadata": {"name": "Antigravity Research Lab"}, "activities": []}
    
    with open(LEDGER_PATH, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"lab_metadata": {"name": "Antigravity Research Lab"}, "activities": []}

def save_ledger(ledger: Dict[str, Any]):
    """Saves the research ledger to disk."""
    with open(LEDGER_PATH, 'w') as f:
        json.dump(ledger, f, indent=2)

def log_activity(activity_type: str, title: str, status: str = "proposed", agents: List[str] = None, artifacts: List[str] = None) -> str:
    """
    Logs a new research activity to the ledger.
    Returns the generated activity ID.
    """
    ledger = load_ledger()
    
    activity_id = f"LAB-{len(ledger['activities']) + 1:03d}"
    
    activity = {
        "id": activity_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "type": activity_type,
        "title": title,
        "status": status,
        "agents": agents or [],
        "artifacts": artifacts or [],
        "log": [
            {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "event": f"Activity initialized as {status}."
            }
        ]
    }
    
    ledger["activities"].append(activity)
    save_ledger(ledger)
    return activity_id

def update_activity(activity_id: str, status: str = None, event: str = None, artifact: str = None):
    """Updates an existing activity in the ledger."""
    ledger = load_ledger()
    
    for activity in ledger["activities"]:
        if activity["id"] == activity_id:
            if status:
                activity["status"] = status
            if event:
                activity["log"].append({
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "event": event
                })
            if artifact and artifact not in activity["artifacts"]:
                activity["artifacts"].append(artifact)
            break
            
    save_ledger(ledger)

if __name__ == "__main__":
    # Test
    aid = log_activity("hypothesis", "Initial Lab Setup", status="completed", agents=["System"])
    print(f"Logged activity: {aid}")
    update_activity(aid, event="Ledger system verified.")
