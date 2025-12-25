import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger("CognitiveLedger")

class CognitiveLedger:
    """
    Persistence layer for Metacognitive insights.
    
    Stores Case Studies of agent behavior, failure patterns, 
    and systemic optimizations.
    """
    
    def __init__(self, ledger_path: Optional[str] = None):
        if ledger_path is None:
            # Current file is in admin/brain/agents/metacognition/
            # We want ledger.json in the same directory
            self.ledger_dir = os.path.dirname(os.path.abspath(__file__))
            self.ledger_path = os.path.join(self.ledger_dir, "ledger.json")
        else:
            self.ledger_path = ledger_path
            self.ledger_dir = os.path.dirname(ledger_path)
            
        os.makedirs(self.ledger_dir, exist_ok=True)
        self._init_ledger()

    def _init_ledger(self):
        if not os.path.exists(self.ledger_path):
            with open(self.ledger_path, 'w') as f:
                json.dump({
                    "version": "1.0",
                    "last_updated": datetime.now().isoformat(),
                    "case_studies": [],
                    "failure_patterns": {},
                    "optimization_directives": []
                }, f, indent=2)

    def record_case_study(self, agent_id: str, outcome: str, reasoning: str, success: bool = True, metadata: Dict = None):
        """Records a specific instance of agent behavior."""
        with open(self.ledger_path, 'r') as f:
            data = json.load(f)
            
        case = {
            "timestamp": datetime.now().isoformat(),
            "agent": agent_id,
            "outcome": outcome,
            "reasoning": reasoning,
            "success": success,
            "metadata": metadata or {}
        }
        
        data["case_studies"].append(case)
        data["last_updated"] = datetime.now().isoformat()
        
        # Keep only last 100 case studies
        if len(data["case_studies"]) > 100:
            data["case_studies"] = data["case_studies"][-100:]
            
        with open(self.ledger_path, 'w') as f:
            json.dump(data, f, indent=2)
            
        logger.info(f"Recorded Case Study for {agent_id} - Success: {success}")

    def report_failure_pattern(self, pattern_name: str, description: str):
        """Tracks recurring failures across the system."""
        with open(self.ledger_path, 'r') as f:
            data = json.load(f)
            
        if pattern_name not in data["failure_patterns"]:
            data["failure_patterns"][pattern_name] = {
                "count": 0,
                "description": description,
                "first_seen": datetime.now().isoformat()
            }
            
        data["failure_patterns"][pattern_name]["count"] += 1
        data["failure_patterns"][pattern_name]["last_seen"] = datetime.now().isoformat()
        data["last_updated"] = datetime.now().isoformat()
        
        with open(self.ledger_path, 'w') as f:
            json.dump(data, f, indent=2)
            
        logger.warning(f"Detected/Repeated failure pattern: {pattern_name}")

    def get_ledger_summary(self) -> Dict:
        with open(self.ledger_path, 'r') as f:
            return json.load(f)

# Singleton instance for system use
_ledger = None

def get_cognitive_ledger() -> CognitiveLedger:
    global _ledger
    if _ledger is None:
        _ledger = CognitiveLedger()
    return _ledger
