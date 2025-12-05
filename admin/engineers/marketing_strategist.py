"""
The Marketing Strategist - Chief Marketing Officer Agent

Responsible for high-level campaign strategy, market positioning,
and coordinating the tactical execution of the social media team.
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from config import config

logger = logging.getLogger("MarketingStrategist")


class MarketingStrategist:
    """
    The Marketing Strategist (CMO)
    
    Mission: Drive growth through strategic alignment of content and market trends.
    
    Responsibilities:
    - Define campaign objectives
    - Identify target audience segments
    - Coordinate with Creative Director (Brand) and Viral Coach (Tactics)
    - Analyze performance data to refine strategy
    """
    
    def __init__(self):
        self.name = "The Marketing Strategist"
        self.role = "Chief Marketing Officer"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.node_url = config.STUDIO_NODE_URL
        
    def develop_strategy(self, topic: str, current_trends: List[str] = None) -> Dict:
        """
        Develops a comprehensive marketing strategy for a topic.
        """
        logger.info(f"[{self.name}] Developing strategy for: {topic}")
        
        if not current_trends:
            current_trends = ["AI automation", "Building in public", "Digital minimalism"]
            
        strategy = {
            "topic": topic,
            "developed_by": self.name,
            "created_at": datetime.now().isoformat(),
            "market_context": {
                "trends": current_trends,
                "saturation": "medium",  # Mock analysis
                "opportunity": "high"
            }
        }
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                As a CMO, develop a marketing strategy for: "{topic}"
                
                Context:
                - Brand: "Does This Feel Right?" (Tech/Philosophy blog)
                - Trends: {current_trends}
                
                Return JSON:
                {{
                    "target_audience": ["segment1", "segment2"],
                    "core_value_prop": "one sentence value proposition",
                    "positioning": "how we stand out",
                    "campaign_angles": [
                        {{"angle": "Contrarian", "hook": "Why everyone is wrong about X"}},
                        {{"angle": "Educational", "hook": "The missing manual for X"}}
                    ],
                    "distribution_channels": ["TikTok", "LinkedIn", "Twitter"],
                    "success_metrics": ["metric1", "metric2"]
                }}
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=60
                )
                response.raise_for_status()
                result = response.json().get("response", "")
                
                if "{" in result:
                    json_str = result[result.find("{"):result.rfind("}")+1]
                    strategy["strategic_plan"] = json.loads(json_str)
                    
            except Exception as e:
                logger.warning(f"[{self.name}] Strategy generation failed: {e}")
                
        # Fallback if generation failed
        if "strategic_plan" not in strategy:
            strategy["strategic_plan"] = {
                "target_audience": ["Tech workers", "Creators"],
                "core_value_prop": "Finding balance in a tech-saturated world",
                "positioning": "The thoughtful alternative to hype",
                "campaign_angles": [{"angle": "Personal Story", "hook": "My journey with..."}]
            }
            
        return strategy

    def coordinate_tiktok_campaign(self, topic: str) -> Dict:
        """
        Coordinates a TikTok-specific campaign with the team.
        """
        from admin.engineers.creative_director import CreativeDirector
        from admin.engineers.viral_coach import ViralCoach
        
        logger.info(f"[{self.name}] Convening TikTok strategy session for: {topic}")
        
        # 1. Develop Strategy
        strategy = self.develop_strategy(topic)
        plan = strategy.get("strategic_plan", {})
        
        # 2. Consult Creative Director (Brand Alignment)
        cd = CreativeDirector()
        brand_guidelines = cd.get_brand_guidelines()
        
        # 3. Consult Viral Coach (Tactical Optimization)
        coach = ViralCoach()
        
        # 4. Synthesize Plan
        campaign_brief = {
            "campaign_name": f"TikTok Operation: {topic}",
            "objective": plan.get("core_value_prop"),
            "target_audience": plan.get("target_audience"),
            "angles": plan.get("campaign_angles"),
            "brand_guardrails": {
                "voice": brand_guidelines["voice"]["tone"],
                "avoid": brand_guidelines["voice"]["avoid"]
            },
            "viral_tactics": [
                "Use kinetic typography for retention",
                "Open loop in first 3 seconds",
                "Strong CTA for newsletter signup"
            ],
            "execution_plan": [
                "Phase 1: Teaser video (Hook focus)",
                "Phase 2: Deep dive video (Value focus)",
                "Phase 3: Behind the scenes (Authenticity focus)"
            ]
        }
        
        return campaign_brief

if __name__ == "__main__":
    cmo = MarketingStrategist()
    brief = cmo.coordinate_tiktok_campaign("The End of Coding")
    print(json.dumps(brief, indent=2))
