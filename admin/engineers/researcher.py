import logging
import sys
import os
import json
import time
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
from config import config
from admin.engineers.web_scout import get_web_scout
from admin.brain.model_router import get_model_router, TaskType
from admin.brain.agent_base import BaseAgent

logger = logging.getLogger("Researcher")

class Researcher(BaseAgent):
    """
    The Researcher (AI Research Scientist)
    
    Now data-driven via admin/brain/agents/researcher/
    """
    def __init__(self):
        # Initialize BaseAgent to load Profile & Skills
        super().__init__(agent_id="researcher")
        
        # Initialize components
        self.web_scout = get_web_scout()
        self.model_router = get_model_router()
        self.reports_dir = os.path.join(config.BRAIN_DIR, "research_reports")
        os.makedirs(self.reports_dir, exist_ok=True)
        
        # Initialize Google GenAI Client (for legacy/fallback)
        self.api_key = config.GEMINI_API_KEY
        if self.api_key:
             try:
                 from google import genai
                 self.client = genai.Client(api_key=self.api_key)
             except ImportError:
                 self.client = None
        else:
            self.client = None
            
        logger.info(f"[{self.name}] Initialized with Deep Research capabilities and enabled skills")

    async def execute(self, action: str, **params) -> Dict[str, Any]:
        """
        Executes an action via the unified Agent Interface.
        """
        if action == "research" or action == "investigate":
            topic = params.get("topic")
            max_iterations = params.get("max_iterations", 3)
            
            if not topic:
                raise ValueError("Topic is required for research.")
                
            result = self.iterative_research(topic, max_iterations=max_iterations)
            return result
            
        elif action == "chat":
            message = params.get("message")
            # Logic for generic chat using system prompt
            return {"response": "Researcher chat functionality coming soon."}
            
        else:
            raise NotImplementedError(f"Action {action} not supported by Researcher.")

    def iterative_research(self, topic: str, max_iterations: int = 3) -> dict:
        """
        Performs iterative deep research using GPT-5.2-Thinking (or best available) and WebScout.
        """
        logger.info(f"[{self.name}] Starting Iterative Deep Research on: {topic}")
        
        
        # 1. Select Models (Switch to Local for Zero Cost)
        # We manually construct the model dict to bypass ModelRouter's fallback to OpenAI when local is missing.
        # This guarantees "Zero Cost" by forcing Gemini Flash (Free Tier).
        analysis_model = {
            "selected": "gemini-2.0-flash",
            "provider": "google",
            "type": "cloud_free",
            "prefer_local": True 
        }
        writing_model = analysis_model.copy()
        
        # Legacy router call (kept for reference but bypassed)
        # analysis_model = self.model_router.select_model(TaskType.ANALYSIS, {"prefer_local": True})
        
        logger.info(f"[{self.name}] Using {analysis_model['selected']} for analysis and {writing_model['selected']} for reporting.")
        
        # Check Memory for existing insights
        from admin.brain.memory_store import get_memory_store
        memory = get_memory_store()
        insights = memory.get_insights("research_report", min_confidence=0.8)
        
        memory_context = ""
        if insights:
            memory_context = "\n\nRelevant Past Insights:\n" + "\n".join([f"- {i['data'].get('topic')}: {i['data'].get('summary')}" for i in insights[:3]])
        
        # Inject Skills Discovery
        skills_context = self.skill_loader.get_system_prompt_additions()
        
        research_context = f"Topic: {topic}\n\nCurrent Knowledge:\n{memory_context}\n{skills_context}\n"
        gathered_info = []
        
        # 2. Research Loop
        for i in range(max_iterations):
            logger.info(f"[{self.name}] Iteration {i+1}/{max_iterations}")
            
            # A. Plan Search Queries
            plan_prompt = f"""
            You are a Universal Polymath Research Planner. 
            Topic: {topic}
            Current Knowledge Summary: {research_context[:4000]}...
            
            Identify the most critical missing information to understand this topic deeply.
            Look for connections across domains (Science, History, Technology, Philosophy).
            
            Generate 3 specific search queries to find this information.
            Output ONLY a JSON list of strings, e.g., ["query 1", "query 2", "query 3"].
            """
            
            queries_json = self._call_llm(analysis_model, plan_prompt, response_format="json")
            try:
                # Clean up JSON string if it contains markdown formatting
                if "```json" in queries_json:
                    queries_json = queries_json.split("```json")[1].split("```")[0].strip()
                elif "```" in queries_json:
                    queries_json = queries_json.split("```")[1].split("```")[0].strip()
                    
                queries = json.loads(queries_json) if isinstance(queries_json, str) else queries_json
                if not isinstance(queries, list):
                    queries = [f"{topic} detailed analysis", f"{topic} historical context", f"{topic} implications"]
            except Exception as e:
                 logger.warning(f"Query planning failed ({e}), using defaults. JSON: {queries_json[:100]}")
                 queries = [f"{topic} overview", f"{topic} key facts"]
            
            logger.info(f"[{self.name}] Planned queries: {queries}")
            
            # B. Execute Search
            iteration_findings = []
            for query in queries:
                results = self.web_scout.search(query, num_results=3)
                for res in results:
                    finding = f"Source: {res.get('title')}\nURL: {res.get('url')}\nContent: {res.get('snippet')}\n"
                    iteration_findings.append(finding)
                    gathered_info.append(finding)
            
            # C. Analyze & Consolidate
            findings_text = "\n".join(iteration_findings)
            analysis_prompt = f"""
            Analyze these new search findings for the topic '{topic}'.
            
            Findings:
            {findings_text}
            
            Previous Context:
            {research_context}
            
            Task: Update the 'Current Knowledge' summary by integrating these new findings. 
            Highlight key facts, cross-disciplinary connections, and note what is still missing.
            """
            
            research_context = self._call_llm(analysis_model, analysis_prompt)
        
        # 3. Final Synthesis
        report_prompt = f"""
        Write a comprehensive Deep Research Report on: {topic}
        
        Base your report ENTIRELY on the following research notes:
        {research_context}
        
        Format: Markdown
        Structure:
        - Executive Summary
        - Detailed Findings (Key Aspects)
        - Deep Analysis (Historical/Scientific/Philosophical Context)
        - Conclusion & Future Implications
        - Sources (Cite the URLs mentioned in notes)
        """
        
        final_report = self._call_llm(writing_model, report_prompt)
        report_path = self._save_report(topic, final_report)
        
        return {
            "topic": topic,
            "status": "success",
            "report": final_report,
            "report_path": report_path,
            "iterations": max_iterations,
            "model_used": analysis_model['selected']
        }

    def _call_llm(self, model_info: dict, prompt: str, response_format: str = "text") -> str:
        """
        Helper to call the appropriate LLM provider.
        Supports Google (Gemini), OpenAI (GPT), Anthropic (Claude), and Ollama.
        """
        provider = model_info.get("provider")
        model_name = model_info.get("selected")
        
        try:
            logger.info(f"Calling LLM: {provider} / {model_name}")

            # GLOBAL OVERRIDE: If "prefer_local" is requested (Zero Cost Mode) and Ollama isn't working/selected,
            # we force-switch to Gemini Flash which is our "Free Cloud" backup.
            if "prefer_local" in str(model_info):
                 provider = "google"
                 model_name = "gemini-2.0-flash"
                 logger.info(f"⚡ Zero-Cost Override: Switching to {model_name}")
            
            if provider == "google":
                # Ensure model name is clean
                # If using genai.Client, it expects clean name usually.
                clean_model_name = model_name.replace("models/", "")
                if "flash" in clean_model_name:
                     clean_model_name = "gemini-2.5-flash"
                elif "pro" in clean_model_name:
                     clean_model_name = "gemini-2.5-pro"
                
                clean_model_name = model_name.replace("models/", "")
                # Force Flash for zero-cost / high-rate-limit preference
                if "prefer_local" in str(model_info) or "flash" in clean_model_name:
                     clean_model_name = "gemini-2.0-flash"
                elif "pro" in clean_model_name:
                     clean_model_name = "gemini-2.0-flash" # Downgrade to flash to save quota
                
                if self.client:
                    response = self.client.models.generate_content(
                        model=clean_model_name,
                        contents=prompt,
                        config={"response_mime_type": "application/json"} if response_format == "json" else None
                    )
                    return response.text
                else:
                    return "Error: Gemini Client not initialized."
                
            elif provider == "openai":
                from openai import OpenAI
                client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
                
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"} if response_format == "json" else None
                )
                return response.choices[0].message.content

            elif provider == "anthropic":
                import anthropic
                client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
                if not client.api_key:
                    return "Error: ANTHROPIC_API_KEY not found."
                    
                message = client.messages.create(
                    model=model_name,
                    max_tokens=4096,
                    messages=[{"role": "user", "content": prompt}]
                )
                return message.content[0].text

            elif provider == "ollama" or provider == "local":
                import requests
                url = "http://localhost:11434/api/generate"
                payload = {
                    "model": model_name,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json" if response_format == "json" else None
                }
                resp = requests.post(url, json=payload)
                if resp.status_code == 200:
                    return resp.json().get("response", "")
                else:
                    return f"Ollama error: {resp.text}"
            
            elif provider == "remote":
                 # Studio Node (remote Ollama/VLLM)
                 import requests
                 node_url = os.environ.get("STUDIO_NODE_URL", "http://100.98.193.42:8080")
                 url = f"{node_url}/api/generate"
                 payload = {
                    "model": model_name,
                    "prompt": prompt,
                    "stream": False
                 }
                 resp = requests.post(url, json=payload, timeout=120)
                 if resp.status_code == 200:
                     return resp.json().get("response", "")
                 else:
                     return f"Remote Node error: {resp.text}"

        except Exception as e:
            logger.error(f"LLM call failed for {provider}/{model_name}: {e}")
            return f"Error generating content: {e}"
        
        return "Model provider not supported."

    def _save_report(self, topic: str, content: str) -> str:
        """Saves the research report to the brain directory."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_topic = "".join([c if c.isalnum() else "_" for c in topic])[:50]
        filename = f"{timestamp}_{safe_topic}.md"
        filepath = os.path.join(self.reports_dir, filename)
        
        with open(filepath, 'w') as f:
            f.write(f"# Research Report: {topic}\n")
            f.write(f"Date: {datetime.now().isoformat()}\n\n")
            f.write(content)
            
        return filepath

    def investigate(self, topic: str) -> dict:
        """
        Main entry point. Defaults to iterative research for better depth.
        """
        return self.iterative_research(topic)

    def deep_research(self, topic: str) -> dict:
        """Wrapped alias."""
        return self.iterative_research(topic)

if __name__ == "__main__":
    # Test the Researcher
    print("Initializing Researcher...")
    researcher = Researcher()
    
    topic = "Future of Space Exploration"
    print(f"Starting research on: {topic}")
    result = researcher.iterative_research(topic, max_iterations=1)
    
    print("\nResult Status:", result["status"])
    if result["status"] == "success":
        print(f"Report saved to: {result['report_path']}")
        print("\nPreview:\n", result["report"][:500] + "...")
