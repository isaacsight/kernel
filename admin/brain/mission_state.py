import os
import json
import logging
import sqlite3
from datetime import datetime
from typing import Dict, Any, List, Optional

logger = logging.getLogger("MissionState")

class MissionState:
    """
    Tracks and persists the state of an active mission using SQLite.
    Bridges the gap between the long-running DirectingLoop and the UI.
    """
    
    def __init__(self, db_path: str = None):
        if not db_path:
            # Default to the brain directory
            db_path = os.path.join(os.path.dirname(__file__), "../brain/missions.db")
        
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS missions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mission TEXT,
                        status TEXT,
                        started_at TEXT,
                        updated_at TEXT,
                        steps TEXT,
                        current_step TEXT,
                        alignment INTEGER,
                        result TEXT
                    )
                """)
                # Also create a table for API keys if we want "Vault Ingest"
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS vault (
                        key_name TEXT PRIMARY KEY,
                        key_value TEXT,
                        updated_at TEXT
                    )
                """)
        except Exception as e:
            logger.error(f"Failed to initialize mission DB: {e}")

    def start_mission(self, mission_description: str):
        try:
            now = datetime.now().isoformat()
            with sqlite3.connect(self.db_path) as conn:
                # Close any previous active missions
                conn.execute("UPDATE missions SET status = 'superseded' WHERE status IN ('planning', 'in_progress')")
                
                conn.execute("""
                    INSERT INTO missions (mission, status, started_at, updated_at, steps, current_step)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (mission_description, "planning", now, now, json.dumps([]), "planning"))
            logger.info(f"Mission started: {mission_description}")
        except Exception as e:
            logger.error(f"Failed to start mission in DB: {e}")

    def update_stage(self, stage: str, status: str, data: Optional[Dict] = None):
        try:
            now = datetime.now().isoformat()
            with sqlite3.connect(self.db_path) as conn:
                # Get the most recent mission
                cursor = conn.execute("SELECT id, steps, alignment FROM missions ORDER BY id DESC LIMIT 1")
                row = cursor.fetchone()
                if not row:
                    return
                
                mission_id, steps_json, alignment = row
                steps = json.loads(steps_json)
                
                # Update or add step record
                step_found = False
                for step in steps:
                    if step["stage"] == stage:
                        step["status"] = status
                        if data:
                            step.update(data)
                        step_found = True
                        break
                
                if not step_found:
                    new_step = {"stage": stage, "status": status}
                    if data:
                        new_step.update(data)
                    steps.append(new_step)
                
                # Extract alignment score if available
                new_alignment = alignment
                if stage == "doctrinal_audit" and data and "result" in data:
                    res = data["result"]
                    if isinstance(res, dict):
                        new_alignment = res.get("alignment_score")

                conn.execute("""
                    UPDATE missions 
                    SET status = ?, current_step = ?, steps = ?, alignment = ?, updated_at = ?
                    WHERE id = ?
                """, (status, stage, json.dumps(steps), new_alignment, now, mission_id))
            
            logger.info(f"Mission stage update: {stage} -> {status}")
        except Exception as e:
            logger.error(f"Failed to update mission stage: {e}")

    def complete_mission(self, result: str):
        try:
            now = datetime.now().isoformat()
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE missions 
                    SET status = 'complete', result = ?, current_step = 'finished', updated_at = ?
                    WHERE id = (SELECT MAX(id) FROM missions)
                """, (result, now))
            logger.info(f"Mission complete.")
        except Exception as e:
            logger.error(f"Failed to complete mission: {e}")

    def fail_mission(self, error: str):
        try:
            now = datetime.now().isoformat()
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE missions 
                    SET status = 'failed', result = ?, updated_at = ?
                    WHERE id = (SELECT MAX(id) FROM missions)
                """, (error, now))
            logger.error(f"Mission failed: {error}")
        except Exception as e:
            logger.error(f"Failed to record mission failure: {e}")

    def get_state(self) -> Dict[str, Any]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("SELECT * FROM missions ORDER BY id DESC LIMIT 1")
                row = cursor.fetchone()
                if row:
                    d = dict(row)
                    d["steps"] = json.loads(d["steps"])
                    return d
        except Exception as e:
            logger.error(f"Failed to get mission state: {e}")
        
        return {
            "mission": None,
            "status": "idle",
            "started_at": None,
            "updated_at": None,
            "steps": [],
            "current_step": None,
            "alignment": None,
            "result": None
        }

    # --- Vault Ingest Methods ---
    def save_api_key(self, name: str, value: str):
        try:
            now = datetime.now().isoformat()
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO vault (key_name, key_value, updated_at)
                    VALUES (?, ?, ?)
                """, (name, value, now))
            logger.info(f"API key '{name}' saved to vault.")
        except Exception as e:
            logger.error(f"Failed to save API key to vault: {e}")

    def get_api_key(self, name: str) -> Optional[str]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT key_value FROM vault WHERE key_name = ?", (name,))
                row = cursor.fetchone()
                return row[0] if row else None
        except Exception as e:
            logger.error(f"Failed to get API key from vault: {e}")
            return None

_mission_manager = None

def get_mission_manager() -> MissionState:
    global _mission_manager
    if _mission_manager is None:
        _mission_manager = MissionState()
    return _mission_manager
