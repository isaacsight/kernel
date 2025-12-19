
import logging
import json
import os
from typing import List, Dict, Any
from datetime import datetime
from admin.brain.agent_base import BaseAgent
from admin.engineers.web_scout import get_web_scout
from admin.brain.model_router import get_model_router, TaskType

logger = logging.getLogger("LexScrubber")

class LexScrubber(BaseAgent):
    """
    Lex Fridman Podcast Scrubber Agent
    
    Mission: Scrub Lex Fridman podcast transcripts for specific topics and extract insights 
    to help the user.
    """
    
    def __init__(self):
        super().__init__(agent_id="lex_scrubber")
        self.web_scout = get_web_scout()
        self.model_router = get_model_router()
        self.name = "Lex Scrubber"
        self.role = "Podcast Intelligence"
        
    async def execute(self, action: str, **params) -> Dict[str, Any]:
        """
        Executes an action.
        """
        if action == "scrub":
            topic = params.get("topic", "AI")
            limit = params.get("limit", 5)
            return self.scrub(topic, limit)
        else:
            raise NotImplementedError(f"Action {action} not supported.")

    def scrub(self, topic: str, limit: int = 5) -> Dict[str, Any]:
        """
        Scrubs Lex Fridman transcripts for the given topic and analyzes findings.
        """
        logger.info(f"[{self.name}] Scrubbing Lex Fridman podcast for: {topic}")
        
        # 1. Generate Podcast-specific queries
        # Targeting specific transcript sites or his official site if indexed
        queries = [
            f'site:lexfridman.com/transcript "{topic}"',
            f'site:lexfridman.com "{topic}" transcript',
            f'Lex Fridman podcast "{topic}" transcript',
        ]
        
        all_results = []
        
        # 2. Search
        for query in queries:
            results = self.web_scout.search(query, num_results=limit)
            all_results.extend(results)
            if len(all_results) >= limit * 2: # Stop if we have enough candidates
                break
            
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
        You are a research assistant analyzing Lex Fridman podcast content.
        
        Analyze these search results for podcast transcripts/summaries about '{topic}':
        
        {findings_text}
        
        Identify:
        1. Key insights or arguments made by guests regarding {topic}.
        2. Specific episodes or guests that are most relevant.
        3. Any repeated themes or consensus views.
        4. Direct quotes if available in snippets.
        
        Format the output as a Markdown report.
        """
        
        # Use ModelRouter for analysis
        try:
            model_info = self.model_router.select_model(TaskType.ANALYSIS)
            # Using simple LLM call pattern for now, similar to RedditScrubber
            # Ideally this uses a shared utility in matching existing patterns
            response = self._simple_llm_call(model_info, analysis_prompt)
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            response = f"Analysis failed due to error: {e}. Raw findings: {findings_text}"
        
        return {
            "status": "success",
            "topic": topic,
            "source_count": len(unique_results),
            "report": response,
            "sources": list(unique_results)
        }

    def _simple_llm_call(self, model_info, prompt):
        """Simplified LLM call handling - temporary duplication from RedditScrubber until refactored"""
        try:
            from google import genai
            import os
            
            # Default to Gemini
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                return "Error: GEMINI_API_KEY not found."
                
            client = genai.Client(api_key=api_key)
            # Hardcode a safe model for now or use the one from router
            model_name = "gemini-2.0-flash" 
            
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
    scrubber = LexScrubber()
    result = scrubber.scrub("Alien Life", limit=3)
    print(result.get("report"))
