import os
import json
import time
import logging
import google.generativeai as genai
from typing import List, Dict, Optional, Any
import sys

# Ensure project root is in path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if project_root not in sys.path:
    sys.path.append(project_root)

from admin.config import config
from admin.brain.agent_base import BaseAgent
from admin.brain.research_utils import log_activity, update_activity, load_ledger

logger = logging.getLogger("LabCoordinator")

class LabCoordinator(BaseAgent):
    """
    The Lab Coordinator.
    Oversees the Research Ledger and coordinates swarms between agents.
    """
    def __init__(self):
        super().__init__(agent_id="lab_coordinator")
        
        # Configure Gemini
        api_key = config.GEMINI_API_KEY
        if not api_key:
            logger.warning("[LabCoordinator] GEMINI_API_KEY not found.")
        else:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL)
            
        self.lab_notes_dir = os.path.join(config.BASE_DIR, "admin", "docs", "lab_notes")
        os.makedirs(self.lab_notes_dir, exist_ok=True)

    def review_ledger(self) -> str:
        """Provides a summary of current lab activities."""
        ledger = load_ledger()
        if not ledger["activities"]:
            return "The Research Ledger is currently empty. Ready for the first hypothesis."
            
        summary = f"### [Antigravity Research Lab] Current Status\n"
        for act in ledger["activities"][-5:]: # Show last 5
            summary += f"- **{act['id']}**: {act['title']} ({act['status']})\n"
            
        return summary

    def propose_hypothesis(self, title: str, hypothesis: str, agents: List[str]) -> str:
        """Logs a new hypothesis to the ledger."""
        aid = log_activity("hypothesis", title, status="proposed", agents=agents)
        update_activity(aid, event=f"Hypothesis: {hypothesis}")
        return f"Hypothesis '{title}' logged as {aid}. Agents assigned: {', '.join(agents)}."

    def publish_lab_note(self, activity_id: str) -> str:
        """
        Synthesizes an activity into a Lab Note (summary paper).
        """
        ledger = load_ledger()
        target_act = next((a for a in ledger["activities"] if a["id"] == activity_id), None)
        
        if not target_act:
            return f"Error: Activity {activity_id} not found."
            
        prompt = f"""
        You are the Lab Coordinator. Write a 'Lab Note' for Activity {activity_id}.
        
        ACTIVITY DATA:
        Title: {target_act['title']}
        History: {json.dumps(target_act['log'])}
        Artifacts: {target_act['artifacts']}
        
        TASK:
        Create a 1-page summary for the research blog. 
        Focus on the 'Key Discovery' and 'Practical Value'.
        
        Format: Markdown.
        """
        
        try:
            response = self.model.generate_content(prompt)
            content = response.text
            
            filename = f"lab_note_{activity_id.lower()}.md"
            filepath = os.path.join(self.lab_notes_dir, filename)
            
            with open(filepath, 'w') as f:
                f.write(content)
                
            update_activity(activity_id, status="completed", event=f"Lab Note published at {filepath}", artifact=filepath)
            return f"Lab Note published for {activity_id} at {filepath}."
        except Exception as e:
            return f"Failed to publish Lab Note: {e}"

if __name__ == "__main__":
    coordinator = LabCoordinator()
    print(coordinator.review_ledger())
