
import logging
import json
import os
from typing import List, Dict, Any
from datetime import datetime
from admin.brain.agent_base import BaseAgent
from admin.engineers.web_scout import get_web_scout
from admin.brain.model_router import get_model_router, TaskType

logger = logging.getLogger("RedditScrubber")

class RedditScrubber(BaseAgent):
    """
    Reddit Scrubber Agent
    
    Mission: Scrub Reddit for specific AI engineering topics and extract insights 
    to improve Studio OS.
    """
    
    def __init__(self):
        super().__init__(agent_id="reddit_scrubber")
        self.web_scout = get_web_scout()
        self.model_router = get_model_router()
        self.name = "Reddit Scrubber"
        self.role = "Community Intelligence"
        
    async def execute(self, action: str, **params) -> Dict[str, Any]:
        """
        Executes an action.
        """
        if action == "scrub":
            topic = params.get("topic", "AI Engineering")
            limit = params.get("limit", 5)
            return self.scrub(topic, limit)
        else:
            raise NotImplementedError(f"Action {action} not supported.")

    def scrub(self, topic: str, limit: int = 5) -> Dict[str, Any]:
        """
        Scrubs Reddit for the given topic and analyzes findings.
        """
        logger.info(f"[{self.name}] Scrubbing Reddit for: {topic}")
        
        # 1. Generate Reddit-specific queries
        queries = [
            f'site:reddit.com "{topic}" "workflow"',
            f'site:reddit.com "{topic}" "tools"',
            f'site:reddit.com "{topic}" "best practices"',
            f'site:reddit.com "{topic}" "agents"',
            f'site:reddit.com "{topic}" "framework"'
        ]
        
        all_results = []
        
        # 2. Search
        for query in queries:
            results = self.web_scout.search(query, num_results=limit)
            all_results.extend(results)
            
        # Deduplicate by URL
        unique_results = {r['url']: r for r in all_results}.values()
        
        if not unique_results:
            return {"status": "no_results", "topic": topic}
            
        # 3. Analyze with LLM
        findings_text = "\n".join([
            f"- Title: {r.get('title')}\n  Snippet: {r.get('snippet')}\n  URL: {r.get('url')}"
            for r in unique_results
        ])
        
        analysis_prompt = f"""
        You are an AI Engineering Consultant optimizing a "Studio OS" (an operating system for AI agents).
        
        Analyze these Reddit discussions about '{topic}':
        
        {findings_text}
        
        Identify:
        1. Emerging patterns or standard workflows.
        2. Common pain points developers are facing.
        3. Specific tools or libraries that are being recommended often.
        4. Concrete opportunities or features we should add to our Studio OS.
        
        Format the output as a Markdown report.
        """
        
        # Use ModelRouter for analysis
        model_info = self.model_router.select_model(TaskType.ANALYSIS)
        
        # Use the Researcher's _call_llm logic if possible, or just duplicate simple call here
        # Since BaseAgent doesn't always have _call_llm, I'll use the one from Researcher 
        # or just implement a simple one here. simpler is better for now.
        # But wait, BaseAgent usually doesn't have the LLM logic directly.
        # I'll use a direct call pattern similar to Researcher but simplified.
        
        # Actually, let's just use the Researcher's helper if I can, or copy it.
        # Copying a simplified version of _call_llm to ensure independence.
        
        response = self._simple_llm_call(model_info, analysis_prompt)
        
        return {
            "status": "success",
            "topic": topic,
            "source_count": len(unique_results),
            "report": response,
            "sources": list(unique_results)
        }

    def _simple_llm_call(self, model_info, prompt):
        """Simplified LLM call handling"""
        try:
            from google import genai
            import os
            
            # Default to Gemini for now as it's the primary one used in Researcher
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                return "Error: GEMINI_API_KEY not found."
                
            client = genai.Client(api_key=api_key)
            # Hardcode a safe model for now or use the one from router
            model_name = config.GEMINI_MODEL
            
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            return response.text
        except Exception as e:
            logger.error(f"LLM Call failed: {e}")
            return f"Analysis failed: {e}"

if __name__ == "__main__":
    # Test run
    scrubber = RedditScrubber()
    result = scrubber.scrub("AI Agents", limit=2)
    print(result.get("report"))
