import sys
import os
import time
import random
import logging
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.web_scout import get_web_scout, WebScout
from admin.engineers.researcher import Researcher
from admin.engineers.librarian import Librarian
from admin.brain.memory_store import get_memory_store

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(name)s] - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("ResearchFlywheel")

class ResearchFlywheel:
    def __init__(self):
        self.scout = get_web_scout()
        self.researcher = Researcher()
        self.librarian = Librarian()
        self.memory = get_memory_store()
        
    def run_cycle(self):
        logger.info("🌀 Starting Research Flywheel Cycle")
        
        # 1. SCOUTING
        logger.info("Step 1: Scouting for topics...")
        # In a real deployed version, we'd use get_trending(). 
        # For now, we simulate finding a topic to avoid burning search credits unnecessarily in development
        # or we can try a targeted search.
        
        # trends = self.scout.get_trending("technology") 
        # For reliability in this demo, let's pick a known relevant topic if trends fail
        topic = "Local vs Cloud AI Architectures" 
        
        # Check if we've researched this recently
        recent_insights = self.memory.get_insights("research_report", min_confidence=0.8)
        completed_topics = [i['data'].get('topic') for i in recent_insights]
        
        if topic in completed_topics:
            logger.info(f"Skipping {topic} - already researched.")
            return

        logger.info(f"✨ New Target Identified: {topic}")
        
        # 2. DEEP RESEARCH
        logger.info("Step 2: Conducting Deep Research...")
        # Use our updated researcher which (will) check memory first
        result = self.researcher.iterative_research(topic, max_iterations=2)
        
        if result['status'] != 'success':
            logger.error("Research failed.")
            return
            
        report_path = result['report_path']
        report_content = result['report']
        
        logger.info(f"✅ Research Complete. Report: {report_path}")
        
        # 3. KNOWLEDGE INDEXING
        logger.info("Step 3: Indexing Knowledge...")
        
        # We want to embed the report so the Librarian can answer questions about it
        # We'll use the Librarian's index_local_content logic but specifically for this file
        # Or better, we just save the insight directly to memory now.
        
        # Save high-level insight
        self.memory.save_insight(
            insight_type="research_report",
            insight_data={
                "topic": topic,
                "summary": report_content[:500], # First 500 chars as summary
                "path": report_path,
                "timestamp": datetime.now().isoformat()
            },
            confidence=1.0,
            source="Research Flywheel"
        )
        
        # Also index the specific file for vector search
        # (Librarian doesn't have a single-file public method yet, but we can call internal or just rely on global re-index)
        # For efficiency, let's just trigger a global re-index of the reports dir if needed, 
        # but actually the Librarian.index_local_content scans directories. 
        # Let's rely on that for now or add a task to run it.
        
        logger.info("🏁 Cycle Complete. Knowledge Base Updated.")

if __name__ == "__main__":
    flywheel = ResearchFlywheel()
    flywheel.run_cycle()
