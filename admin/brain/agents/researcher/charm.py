"""
Researcher Charm
Role: Deep Research Scientist
Capabilities: Iterative searching, synthesis, and report generation.
"""
import os
import json
import logging
from typing import Dict, Any, List
from admin.brain.charm import Charm
from admin.engineers.web_scout import get_web_scout

logger = logging.getLogger("ResearcherCharm")

class ResearcherCharm(Charm):
    def on_install(self):
        super().on_install()
        # Load WebScout
        self.web_scout = get_web_scout()
        # Ensure reports directory exists
        self.reports_dir = os.path.join(self.brain_path, "reports")
        os.makedirs(self.reports_dir, exist_ok=True)
        self.set_status("active", "Ready for Research")

    def _action_research(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Action: research
        Params: topic (str), max_iterations (int, optional)
        """
        topic = params.get("topic")
        iterations = params.get("max_iterations", 3)
        
        if not topic:
            return {"success": False, "error": "Topic is required"}
            
        self.set_status("active", f"Researching: {topic}")
        report = self._iterative_research(topic, iterations)
        self.set_status("active", "Idle")
        
        return {"success": True, "report": report}

    def _action_investigate(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Alias for research"""
        return self._action_research(params)

    def _iterative_research(self, topic: str, max_iterations: int) -> str:
        """
        Performs the deep research loop.
        Does NOT use ModelRouter (self-contained logic for stability).
        """
        import google.generativeai as genai
        # We assume specific model config for Charms, or default to config.GEMINI_MODEL
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        context = f"Topic: {topic}\n"
        
        for i in range(max_iterations):
            self.set_status("active", f"Iteration {i+1}/{max_iterations}: Searching...")
            
            # 1. Plan
            plan_prompt = f"""
            Topic: {topic}
            Context: {context[:2000]}
            Generate 3 search queries to deepen understanding. JSON List only.
            """
            try:
                resp = model.generate_content(plan_prompt, generation_config={"response_mime_type": "application/json"})
                queries = json.loads(resp.text)
                if isinstance(queries, dict): queries = list(queries.values()) # Handle edge case
            except:
                queries = [f"{topic} analysis", f"{topic} details", f"{topic} latest news"]

            # 2. Search
            findings = []
            for q in queries[:3]: # Limit to 3
                if isinstance(q, str):
                    res = self.web_scout.search(q, num_results=2)
                    for r in res:
                        findings.append(f"Source: {r.get('title')}\nContent: {r.get('snippet')}")
            
            # 3. Synthesize
            context += "\nNew Findings:\n" + "\n".join(findings)
            
        # Final Report
        self.set_status("active", "Writing Report...")
        report_prompt = f"""
        Write a detailed Research Report on: {topic}
        Based on these notes:
        {context}
        """
        resp = model.generate_content(report_prompt)
        
        # Save Report
        filename = f"Report_{topic.replace(' ', '_')[:30]}.md"
        with open(os.path.join(self.reports_dir, filename), 'w') as f:
            f.write(resp.text)
            
        return resp.text
