import logging
import json
import os
from typing import Dict, Any, List
from datetime import datetime, timedelta
from admin.brain.memory_store import get_memory_store
from admin.config import config
import google.generativeai as genai

logger = logging.getLogger("ReflectionAgent")

class ReflectionAgent:
    """
    The Reflection Agent
    
    Mission: Synthesize user thoughts and provide periodic reflections.
    
    Responsibilities:
    - Reviewing recent notes from the intake pipeline.
    - identifying patterns in user thinking.
    - Providing a "Daily Digest" or "Thematic Synthesis".
    """

    def __init__(self):
        self.memory = get_memory_store()
        
        # Initialize Gemini
        if config.GEMINI_API_KEY:
            genai.configure(api_key=config.GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.model = None

    @property
    def name(self) -> str:
        return "Reflection Agent"

    @property
    def role(self) -> str:
        return "Cognitive Synthesizer"

    async def execute(self, action: str, **params) -> Dict:
        if action == "summarize_recent_notes":
            return await self.summarize_recent_notes(days=params.get("days", 7))
        elif action == "analyze_thinking_patterns":
            return await self.analyze_thinking_patterns()
        else:
            raise NotImplementedError(f"Action {action} not supported by ReflectionAgent.")

    async def summarize_recent_notes(self, days: int = 7) -> Dict:
        """
        Retrieves notes from the last N days and provides a synthesis.
        """
        import sqlite3
        conn = sqlite3.connect(self.memory.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Query raw_intake for notes
        cursor.execute("""
            SELECT content, metadata, timestamp 
            FROM raw_intake 
            WHERE source_type = 'text' 
            ORDER BY timestamp DESC
            LIMIT 10
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            return {
                "message": f"I couldn't find any notes from the last {days} days to reflect on. Maybe upload something first?",
                "count": 0
            }
            
        notes = []
        for r in rows:
            notes.append(f"[{r['timestamp']}] {r['content']}")
            
        notes_str = "\n---\n".join(notes)
        
        prompt = f"""
        You are the Reflection Agent for Studio OS. 
        Below are the user's recent notes and thoughts from the last {days} days.
        
        RECENT NOTES:
        {notes_str}
        
        TASK:
        1. Synthesize these notes into a cohesive summary.
        2. Identify core themes or Recurring distractions.
        3. Suggest one "Question for Reflection" based on these inputs.
        
        Be insightful, slightly poetic, and encouraging. Use minimalist formatting.
        """
        
        if not self.model:
            return {"message": "LLM not configured for reflection.", "notes_found": len(notes)}
            
        try:
            response = self.model.generate_content(prompt)
            return {
                "message": response.text,
                "notes_analyzed": len(notes),
                "status": "success"
            }
        except Exception as e:
            logger.error(f"Reflection synthesis failed: {e}")
            return {"error": str(e), "notes_found": len(notes)}

    async def analyze_thinking_patterns(self) -> Dict:
        # Placeholder for deeper PCA/Clustering based analysis
        return {"status": "experimental", "message": "Thinking pattern analysis is under development."}

if __name__ == "__main__":
    # Test script
    import asyncio
    async def test():
        agent = ReflectionAgent()
        res = await agent.execute("summarize_recent_notes", days=30)
        print(res["message"])
        
    asyncio.run(test())
