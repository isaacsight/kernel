#!/usr/bin/env python3
"""
Orchestrate Daily Loop - Process all seeded tasks through the Studio OS Council.
"""
import os
import sys
import json
import logging
from pathlib import Path

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.council import GrandCouncil
from admin.engineers.editor import Editor
from admin.engineers.librarian import Librarian
from admin.engineers.alchemist import Alchemist

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger("DailyLoop")

TASK_DIR = Path("admin/tasks")

def run_loop():
    logger.info("🌤️ Starting Studio OS Daily Loop...")
    
    # 1. Initialize Council and Register Agents
    council = GrandCouncil()
    
    logger.info("   ↳ Registering Council Members...")
    council.register_agent("Editor", Editor())
    council.register_agent("Librarian", Librarian())
    council.register_agent("Alchemist", Alchemist())
    
    # 2. Find Pending Tasks
    if not TASK_DIR.exists():
        logger.info("No tasks directory found. Seed a task first.")
        return
        
    tasks = [d for d in TASK_DIR.iterdir() if d.is_dir()]
    pending_tasks = []
    
    for task_path in tasks:
        task_json = task_path / "task.json"
        if task_json.exists():
            with open(task_json, "r") as f:
                data = json.load(f)
                if data.get("status") == "seeded":
                    pending_tasks.append(data["id"])
    
    if not pending_tasks:
        logger.info("✨ No pending tasks. System idle.")
        return
        
    logger.info(f"📋 Found {len(pending_tasks)} pending tasks: {pending_tasks}")
    
    # 3. Execute Each Task
    for task_id in pending_tasks:
        try:
            council.execute_task(task_id)
        except Exception as e:
            logger.error(f"❌ Failed to execute task {task_id}: {e}")
            
    logger.info("🌙 Daily Loop completed. Artifacts awaiting review.")

if __name__ == "__main__":
    run_loop()
