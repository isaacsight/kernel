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
from admin.brain.model_router import get_model_router, TaskType

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
        self.model_router = get_model_router()
            
        logger.info(f"[{self.name}] Initialized. Ready to hunt.")

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
            
            # Use ModelRouter for robust generation
            # Fallback to simple logic if router fails
            report = ""
            try:
                model = self.model_router.select_model(TaskType.ANALYSIS, {"prefer_fast": True})
                logger.info(f"Using model: {model['selected']}")
                
                if model['provider'] == 'google':
                    import google.generativeai as genai
                    genai.configure(api_key=config.GEMINI_API_KEY)
                    m = genai.GenerativeModel(model['selected'])
                    res = m.generate_content(prompt)
                    report = res.text
                elif model['provider'] == 'openai':
                    from openai import OpenAI
                    client = OpenAI(api_key=config.OPENAI_API_KEY)
                    # Fallback to a safe model if 5.2 fails
                    model_name = model['selected']
                    if "5.2" in model_name: 
                        model_name = "gpt-4o"
                    res = client.chat.completions.create(model=model_name, messages=[{"role": "user", "content": prompt}])
                    report = res.choices[0].message.content
                else: 
                     # Fallback for local models (simplified)
                     report = "Analysis model provider not fully supported in this script version."

            except Exception as e:
                logger.error(f"LLM Analysis Failed: {e}")
                report = f"**Automated Analysis Failed** ({e})\n\n**Raw Job Links**:\n" + jobs_text
            
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

    # Removed _simple_llm_call


if __name__ == "__main__":
    hunter = JobHunter()
    print("Running test hunt...")
    result = hunter.hunt_jobs("AI Engineer")
    print("\nStatus:", result['status'])
    print("Report:\n", result.get('report', 'No report'))
