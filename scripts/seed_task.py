#!/usr/bin/env python3
"""
Seed Task - Initialize a new project for the Studio OS Council.
"""
import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path

TASK_DIR = Path("admin/tasks")

def seed_task(title, description, priority="medium"):
    task_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    task_folder = TASK_DIR / task_id
    task_folder.mkdir(parents=True, exist_ok=True)
    
    task_data = {
        "id": task_id,
        "title": title,
        "description": description,
        "priority": priority,
        "status": "seeded",
        "created_at": datetime.now().isoformat(),
        "doctrine_alignment": "high",
        "council_members": ["Architect", "Researcher", "Editor"]
    }
    
    with open(task_folder / "task.json", "w") as f:
        json.dump(task_data, f, indent=4)
        
    # Create the initial plan artifact placeholder
    with open(task_folder / "plan.md", "w") as f:
        f.write(f"# Plan: {title}\n\n## Goal\n{description}\n\n## Proposed Sub-tasks\n- [ ] Research phase\n- [ ] Drafting phase\n- [ ] Review phase")

    print(f"✅ Seeded task: {title} (ID: {task_id})")
    print(f"📍 Task location: {task_folder}")
    return task_id

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed a new task for the Studio OS Council.")
    parser.add_argument("title", help="Title of the task")
    parser.add_argument("description", help="Detailed description of the task")
    parser.add_argument("--priority", default="medium", choices=["low", "medium", "high", "critical"])
    
    args = parser.parse_args()
    seed_task(args.title, args.description, args.priority)
