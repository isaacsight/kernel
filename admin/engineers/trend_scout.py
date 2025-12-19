"""
Trend Scout - Real-time Trend Awareness

This agent is responsible for identifying current trends on social media (TikTok, Twitter, etc.)
to inform content strategy and script optimization.

Now integrated with Collective Intelligence.
"""

import logging
import random
import sys
import os
from datetime import datetime
from typing import List, Dict

# Add project root to path (for direct execution)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.brain.agent_base import BaseAgent
from admin.brain.collective_intelligence import get_collective_intelligence

logger = logging.getLogger("TrendScout")

class TrendScout(BaseAgent):
    def __init__(self):
        # Initialize BaseAgent (Profile & Skills)
        # using 'trend_scout' as the agent_id folder name
        # We might need to create this folder if it doesn't exist, but BaseAgent checks for it.
        # If it doesn't exist, we should probably fail or handle it. 
        # For now, assuming the folder might NOT exist, I will handle the exception or create it?
        # The plan didn't say I'd create the folder, but BaseAgent requires it.
        # Let's try to initialize it, if it fails, I'll fall back to a default "TrendScout" without profile.
        
        try:
            super().__init__(agent_id="trend_scout")
        except ValueError:
            # Fallback if profile doesn't exist yet
            self.name = "Trend Scout"
            self.role = "Trend Researcher"
            self.system_prompt = "You are a trend hunter."
            self.enabled_skills = []
            logger.warning("[TrendScout] Profile not found, running in fallback mode.")

        self.collective = get_collective_intelligence()
        
        # Simulated "Live" Trends Database
        self._trend_database = [
            {"topic": "AI Agents", "volume": "High", "context": "People are building autonomous teams", "sentiment": "Excited"},
            {"topic": "Coding with AI", "volume": "High", "context": "Devs using Cursor/Windsurf", "sentiment": "Curious"},
            {"topic": "Dead Internet Theory", "volume": "Medium", "context": "Is everything bots?", "sentiment": "Skeptical"},
            {"topic": "Python Tips", "volume": "Steady", "context": "Quick one-liners", "sentiment": "Educational"},
            {"topic": "Tech Layoffs", "volume": "Medium", "context": "Career advice is trending", "sentiment": "Anxious"},
            {"topic": "Day in the Life", "volume": "Steady", "context": "Software Engineer lifestyle", "sentiment": "Aspirational"},
            {"topic": "Rust vs C++", "volume": "Low", "context": "Niche wars", "sentiment": "Debate"}
        ]
        
        self._trending_audio = [
            "Spooky Skeletons (Remix)",
            "Corporate Music (Ironic)",
            "Lo-fi Coding Beats",
            "Fast Phonk (for speedruns)"
        ]

    def get_current_trends(self, niche: str = "auto") -> List[Dict]:
        """
        Returns a list of currently trending topics. 
        If niche is 'auto', it rotates through diverse domains.
        """
        # 1. Check Collective Intelligence first (simulating reading the room)
        past_insights = self.collective.get_insights("trend_report", min_confidence=0.8)
        if past_insights:
            logger.info(f"[{self.name}] Building on {len(past_insights)} past trend reports...")

        # If auto, pick a random domain
        if niche == "auto":
            domains = ["tech", "science", "history", "philosophy", "economics", "psychology", "art"]
            niche = random.choice(domains)
            
        logger.info(f"🔍 Scouting trends for niche: {niche}...")

        # Simulated Knowledge Base (In production, this hits headers)
        domain_topics = {
            "tech": [
                {"topic": "AI Agents", "volume": "High", "context": "Autonomous teams"},
                {"topic": "Local LLMs", "volume": "High", "context": "Privacy & Cost"}, 
            ],
            "science": [
                {"topic": "CRISPR 2.0", "volume": "High", "context": "Gene editing advances"},
                {"topic": "Fusion Energy", "volume": "Medium", "context": "Breakthrough results"},
            ],
            "history": [
                {"topic": "The Bronze Age Collapse", "volume": "Steady", "context": "Systems failure"},
                {"topic": "Industrial Revolution paralleling AI", "volume": "High", "context": "Economic shifts"},
            ],
            "philosophy": [
                {"topic": "Stoicism in Tech", "volume": "High", "context": "Managing burnout"},
                {"topic": "Simulation Hypothesis", "volume": "Medium", "context": "Reality debates"},
            ],
            "economics": [
                {"topic": "UBI", "volume": "High", "context": "AI displacement solutions"},
                {"topic": "De-dollarization", "volume": "Medium", "context": "Global currency shifts"},
            ],
            "psychology": [
                {"topic": "Dopamine Detox", "volume": "High", "context": "Attention span recovery"},
                {"topic": "Flow States", "volume": "Steady", "context": "Productivity science"},
            ],
            "art": [
                {"topic": "Generative Art Copyright", "volume": "High", "context": "Legal battles"},
                {"topic": "Digital brutalism", "volume": "Low", "context": "UI design trends"},
            ]
        }
        
        # Return trends for selected domain or generic fallback
        trends = domain_topics.get(niche.lower(), [{"topic": "Unknown", "volume": "Low"}])
        
        # 2. Share findings with the Collective Brain
        for trend in trends:
            self.collective.share_insight(
                agent_name=self.name,
                insight_type="trend_report",
                insight=trend,
                confidence=0.9
            )
            
        return trends

    def get_trending_audio(self) -> str:
        """Returns a trending audio track name."""
        return random.choice(self._trending_audio)

    def check_relevance(self, script_content: str) -> Dict:
        """
        Analyzes a script to see if it hits any current trends.
        Returns a report.
        """
        hits = []
        misses = []
        
        trends = self.get_current_trends("tech")
        
        for trend in trends:
            if trend['topic'].lower() in script_content.lower():
                hits.append(trend)
            else:
                misses.append(trend)
                
        score = len(hits) / len(trends) if trends else 0
        
        return {
            "score": score,
            "hits": hits,
            "misses": misses,
            "suggestion": f"Try incorporating '{misses[0]['topic']}' if relevant." if misses else "On point!"
        }

    def run(self, input_text: str):
        """Execution entry point."""
        return self.get_current_trends(input_text) if input_text else self.get_current_trends()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    scout = TrendScout()
    print("🔥 Current Trends:", scout.get_current_trends())
    print("🎵 Trending Audio:", scout.get_trending_audio())
