# dtfr/ledger_writer.py
"""
Ledger Writer for DTFR Answer Engine.
Persists answer results to research_ledger.json for observability.
"""

import os
import json
import logging
from datetime import datetime
from typing import Optional
from admin.config import config

logger = logging.getLogger("LedgerWriter")

LEDGER_PATH = os.path.join(config.BRAIN_DIR, "research_ledger.json")


def _load_ledger() -> dict:
    """Load the existing ledger or create a new one."""
    if os.path.exists(LEDGER_PATH):
        try:
            with open(LEDGER_PATH, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load ledger: {e}. Creating new ledger.")

    return {
        "lab_metadata": {
            "name": "DTFR Answer Engine",
            "established": datetime.now().strftime("%Y-%m-%d"),
            "version": "2.0.0",
        },
        "activities": [],
    }


def _save_ledger(ledger: dict) -> None:
    """Save the ledger to disk."""
    os.makedirs(os.path.dirname(LEDGER_PATH), exist_ok=True)
    with open(LEDGER_PATH, "w") as f:
        json.dump(ledger, f, indent=2)


def _generate_activity_id(ledger: dict) -> str:
    """Generate the next activity ID."""
    activities = ledger.get("activities", [])
    if not activities:
        return "ANS-001"

    # Find highest existing ID
    max_num = 0
    for activity in activities:
        aid = activity.get("id", "")
        if aid.startswith("ANS-"):
            try:
                num = int(aid.split("-")[1])
                max_num = max(max_num, num)
            except (ValueError, IndexError):
                pass

    return f"ANS-{max_num + 1:03d}"


def log_answer_result(
    inquiry: str,
    mode: str,
    sources: list,
    answer: str,
    notes: Optional[list] = None,
    grounded: bool = True,
) -> str:
    """
    Log an answer result to the research ledger.

    Args:
        inquiry: The user's original query
        mode: The answer mode used (search, research, academic, reasoning)
        sources: List of source dicts used
        answer: The generated answer text
        notes: Optional list of cross-check notes
        grounded: Whether the answer was grounded in sources

    Returns:
        The activity ID of the logged entry
    """
    ledger = _load_ledger()
    activity_id = _generate_activity_id(ledger)

    activity = {
        "id": activity_id,
        "timestamp": datetime.now().isoformat() + "Z",
        "type": "answer",
        "title": f"Answer: {inquiry[:60]}..." if len(inquiry) > 60 else f"Answer: {inquiry}",
        "status": "completed",
        "agents": ["AnswerEngine"],
        "artifacts": [],
        "metadata": {
            "mode": mode,
            "source_count": len(sources),
            "answer_length": len(answer),
            "grounded": grounded,
            "has_notes": bool(notes),
        },
        "log": [
            {
                "timestamp": datetime.now().isoformat() + "Z",
                "event": f"Query processed in {mode} mode with {len(sources)} sources.",
            }
        ],
    }

    if notes:
        activity["log"].append(
            {
                "timestamp": datetime.now().isoformat() + "Z",
                "event": f"Cross-check notes: {'; '.join(notes[:3])}",
            }
        )

    ledger["activities"].append(activity)

    # Keep ledger manageable - only last 100 entries
    if len(ledger["activities"]) > 100:
        ledger["activities"] = ledger["activities"][-100:]

    _save_ledger(ledger)
    logger.info(f"Logged answer result: {activity_id}")

    return activity_id


def get_recent_activities(limit: int = 20) -> list:
    """Get the most recent ledger activities."""
    ledger = _load_ledger()
    return ledger.get("activities", [])[-limit:]


def get_answer_stats() -> dict:
    """Get statistics about answer engine usage."""
    ledger = _load_ledger()
    activities = [a for a in ledger.get("activities", []) if a.get("type") == "answer"]

    if not activities:
        return {"total": 0, "by_mode": {}, "avg_sources": 0, "grounded_rate": 0}

    by_mode = {}
    total_sources = 0
    grounded_count = 0

    for a in activities:
        meta = a.get("metadata", {})
        mode = meta.get("mode", "unknown")
        by_mode[mode] = by_mode.get(mode, 0) + 1
        total_sources += meta.get("source_count", 0)
        if meta.get("grounded", False):
            grounded_count += 1

    return {
        "total": len(activities),
        "by_mode": by_mode,
        "avg_sources": total_sources / len(activities) if activities else 0,
        "grounded_rate": grounded_count / len(activities) if activities else 0,
    }
