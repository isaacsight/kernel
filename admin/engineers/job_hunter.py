import logging
import sys
import os
import json
import time
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple

# Add root to path so we can import admin
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.config import config
from admin.engineers.web_scout import get_web_scout
from admin.brain.agent_base import BaseAgent

logger = logging.getLogger("JobHunter")

class JobHunter(BaseAgent):
    """
    The JobHunter (Career Specialist)
    """
    def __init__(self):
        super().__init__(agent_id="job_hunter")
        self.web_scout = get_web_scout()
        self.reports_dir = os.path.join(config.BRAIN_DIR, "job_hunts")
        os.makedirs(self.reports_dir, exist_ok=True)
        
        # Initialize LLM Client (using same logic as Researcher/Base)
        self.api_key = config.GEMINI_API_KEY
        if self.api_key:
             try:
                 from google import genai
                 self.client = genai.Client(api_key=self.api_key)
             except ImportError:
                 self.client = None
        else:
            self.client = None
            
        logger.info(f"[{self.name}] Initialized. Target: Japan (English Speaking, Sponsor).")

    def execute(self, action: str, **params) -> Dict[str, Any]:
        if action == "hunt" or action == "search":
            role = params.get("role", "AI Engineer") # Default fallback
            return self.hunt_jobs(role)
        else:
             raise NotImplementedError(f"Action {action} not supported by JobHunter.")

    def hunt_jobs(self, role_focus: str, mode: str = "freelance") -> dict:
        """
        Performs a targeted job search.
        Modes: 'freelance', 'contract', 'fulltime_japan'
        """
        logger.info(f"[{self.name}] Starting Job Hunt for: {role_focus} [Mode: {mode}]")
        
        # 1. Define Search Strategy based on Mode
        queries = []
        if mode == "freelance" or mode == "contract":
            queries = [
                f'"{role_focus}" freelance remote contract',
                f'site:upwork.com "{role_focus}" "expert" -entry',
                f'site:linkedin.com/jobs/ "{role_focus}" contract remote',
                f'site:weworkremotely.com "{role_focus}" contract',
                f'"{role_focus}" fractional "part-time" remote'
            ]
        elif mode == "fulltime_japan":
             queries = [
                f'site:tokyodev.com "{role_focus}" "visa sponsorship" "no japanese"',
                f'site:japan-dev.com "{role_focus}" "visa sponsorship" "no japanese"',
                f'site:linkedin.com/jobs/ "Japan" "{role_focus}" "English" "Visa Sponsorship"'
            ]
        else:
            # Default global remote
            queries = [f'"{role_focus}" remote jobs', f'site:linkedin.com/jobs/ "{role_focus}" remote']
        
        gathered_jobs = []
        
        # 2. Execute Search
        for query in queries:
            logger.info(f"[{self.name}] Searching: {query}")
            results = self.web_scout.search(query, num_results=3)
            for res in results:
                # Basic filter to ensure we aren't just getting junk
                title = res.get('title', '').lower()
                if any(x in title for x in ["job", "career", "hiring", "engineer", "developer", "architect", "lead"]):
                    gathered_jobs.append(res)
        
        # 3. Analyze & Rank (using LLM)
        if gathered_jobs:
            jobs_text = "\n\n".join([f"Title: {j.get('title')}\nURL: {j.get('url')}\nSnippet: {j.get('snippet')}" for j in gathered_jobs])
            
            # Simple ranking/filtering prompt
            prompt = f"""
            You are an expert Headhunter.
            
            Filter and rank the following opportunities for a Senior/Principal {role_focus}.
            Mode: {mode.upper()}
            
            Criteria:
            - High Value / High Rate
            - Remote / Flexible
            - Relevant to "Agentic AI", "Systems Architecture", "Python"
            
            Jobs found:
            {jobs_text}
            
            Output a Markdown report summarizing the TOP 3 most promising opportunities.
            For each, generate a SHORT "Draft Application Email" snippet to the hiring manager.
            """
            
            # Use a basic model call
            report = self._simple_llm_call(prompt)
            
            report_path = self._save_report(f"{role_focus}_{mode}", report)
            
            return {
                "status": "success",
                "jobs_found": len(gathered_jobs),
                "report": report,
                "report_path": report_path
            }
        else:
            return {
                "status": "failed",
                "message": "No jobs found."
            }

    def _save_report(self, topic: str, content: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"JOB_HUNT_{timestamp}.md"
        filepath = os.path.join(self.reports_dir, filename)
        
        with open(filepath, 'w') as f:
            f.write(f"# Job Hunt Report: {topic}\n")
            f.write(f"Date: {datetime.now().isoformat()}\n")
            f.write("Constraints: Japan, English Only, Visa Sponsorship\n\n")
            f.write(content)
            
        return filepath

    def _simple_llm_call(self, prompt: str) -> str:
        """ Simplified LLM call using Gemini Flash (Hardcoded for efficiency) """
        try:
            if self.client:
                response = self.client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=prompt
                )
                return response.text
            else:
                 return "LLM Client not available. Raw results: " + prompt[:500]
        except Exception as e:
            return f"Error generating report: {e}"

if __name__ == "__main__":
    hunter = JobHunter()
    print("Running test hunt...")
    result = hunter.hunt_jobs("AI Engineer")
    print("\nStatus:", result['status'])
    print("Report:\n", result.get('report', 'No report'))
