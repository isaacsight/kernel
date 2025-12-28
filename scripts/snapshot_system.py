#!/usr/bin/env python3
"""
Snapshot System - Capture the current state of the Studio OS for long-term memory.
"""
import os
import json
from datetime import datetime
from pathlib import Path

SNAPSHOT_DIR = Path("admin/snapshots")

def capture_snapshot():
    now = datetime.now()
    snapshot_id = now.strftime("%Y%m%d_%H%M%S")
    target = SNAPSHOT_DIR / snapshot_id
    target.mkdir(parents=True, exist_ok=True)
    
    # 1. Capture Task States
    tasks = []
    task_dir = Path("admin/tasks")
    if task_dir.exists():
        for d in task_dir.iterdir():
            if d.is_dir() and (d / "task.json").exists():
                with open(d / "task.json", "r") as f:
                    tasks.append(json.load(f))
    
    # 2. Capture Rule Metadata
    rules = []
    rule_dir = Path(".agent/rules")
    if rule_dir.exists():
        for f in rule_dir.iterdir():
            if f.is_file() and f.suffix == ".md":
                rules.append({"name": f.name, "size": f.stat().st_size})
                
    # 3. Compile Snapshot
    snapshot_data = {
        "timestamp": now.isoformat(),
        "tasks_summary": {
            "total": len(tasks),
            "awaiting_review": len([t for t in tasks if t.get("status") == "awaiting_review"]),
            "completed": len([t for t in tasks if t.get("status") == "completed"])
        },
        "active_rules": rules,
        "tasks_detail": tasks
    }
    
    with open(target / "summary.json", "w") as f:
        json.dump(snapshot_data, f, indent=4)
        
    # Update 'latest' pointer
    with open(SNAPSHOT_DIR / "latest_snapshot.json", "w") as f:
        json.dump({"latest_id": snapshot_id, "timestamp": now.isoformat()}, f, indent=4)

    print(f"📦 System snapshot captured: {snapshot_id}")
    print(f"📍 Saved to: {target}")

if __name__ == "__main__":
    capture_snapshot()
