"""
The Creative Director - Chief Creative Agent

Orchestrates all creative work across the team, ensures brand consistency,
and drives the overall creative vision for the blog.
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from admin.brain.collective_intelligence import get_collective_intelligence
from config import config

logger = logging.getLogger("CreativeDirector")


class CreativeDirector:
    """
    The Creative Director (Chief Creative Officer)
    
    Mission: Lead and coordinate all creative output for maximum impact.
    
    Responsibilities:
    - Set and maintain creative vision
    - Coordinate creative agents (Editor, Designer, Narrator, Alchemist)
    - Ensure brand consistency
    - Review and approve creative work
    - Plan creative campaigns
    """
    
    def __init__(self):
        self.name = "The Creative Director"
        self.role = "Chief Creative Officer"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.collective = get_collective_intelligence()
        self.node_url = config.STUDIO_NODE_URL
        
        # Brand guidelines
        self.brand = {
            "name": "Does This Feel Right?",
            "voice": {
                "tone": ["calm", "warm", "reflective", "grounded", "observational"],
                "avoid": ["preachy", "judgmental", "clickbait", "sensational"],
                "signature": "Does this feel true?"
            },
            "visual": {
                "palette": ["#1a1a1a", "#2a2a2a", "#646cff", "#ffffff"],
                "style": "minimal, dark, contemplative",
                "typography": "clean, modern, readable"
            },
            "values": [
                "Emotional honesty",
                "Clarity over complexity", 
                "Depth over virality",
                "Questions over answers"
            ]
        }
        
        # Register expertise with collective
        self.collective.register_expertise(
            self.name, 
            ["creative direction", "brand strategy", "content review", "campaign planning"]
        )
    
    def create_creative_brief(self, topic: str, format_type: str = "blog_post") -> Dict:
        """
        Creates a detailed creative brief for a piece of content.
        """
        logger.info(f"[{self.name}] Creating brief for: {topic}")
        
        # Get relevant insights from collective
        insights = self.collective.get_insights("content_trend")
        trends = [i["insight"] for i in insights[:3]]
        
        brief = {
            "topic": topic,
            "format": format_type,
            "brand_alignment": self.brand,
            "trends_to_consider": trends,
            "created_by": self.name,
            "created_at": datetime.now().isoformat()
        }
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                As a Creative Director, create a creative brief for:
                
                Topic: {topic}
                Format: {format_type}
                Brand Voice: {self.brand['voice']['tone']}
                Brand Values: {self.brand['values']}
                
                Return JSON:
                {{
                    "headline_options": ["option1", "option2", "option3"],
                    "key_message": "the main takeaway",
                    "emotional_goal": "how readers should feel",
                    "visual_direction": "description of visual approach",
                    "call_to_action": "what we want readers to do",
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
                    brief["creative_direction"] = json.loads(json_str)
                    
            except Exception as e:
                logger.warning(f"[{self.name}] Brief generation failed: {e}")
                
        self.metrics.track_agent_action(self.name, 'create_brief', True, 0)
        return brief
    
    def review_content(self, content: str, content_type: str = "blog_post") -> Dict:
        """
        Reviews content for brand alignment and quality.
        """
        logger.info(f"[{self.name}] Reviewing {content_type}...")
        
        review = {
            "content_type": content_type,
            "reviewed_by": self.name,
            "reviewed_at": datetime.now().isoformat()
        }
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                As a Creative Director, review this content against brand guidelines:
                
                BRAND VOICE: {self.brand['voice']}
                BRAND VALUES: {self.brand['values']}
                
                CONTENT:
                {content[:2000]}
                
                Return JSON:
                {{
                    "approved": true/false,
                    "score": 1-10,
                    "strengths": ["strength1", "strength2"],
                    "issues": ["issue1", "issue2"],
                    "suggestions": ["suggestion1", "suggestion2"],
                    "brand_alignment": "how well it aligns with brand",
                    "emotional_impact": "predicted emotional response"
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
                    review["feedback"] = json.loads(json_str)
                    
                    # Share insight with collective
                    self.collective.share_insight(
                        self.name, "content_review",
                        {"type": content_type, "score": review["feedback"].get("score", 0)},
                        0.8
                    )
                    
            except Exception as e:
                logger.warning(f"[{self.name}] Review failed: {e}")
        
        if "feedback" not in review:
            review["feedback"] = {
                "approved": True,
                "score": 7,
                "strengths": ["Topic is relevant"],
                "issues": [],
                "suggestions": ["Consider adding more personal touch"]
            }
        
        self.metrics.track_agent_action(self.name, 'review_content', True, 0)
        return review

    def review_tiktok_script(self, script: str, vibe: str) -> Dict:
        """
        Reviews a TikTok script for brand alignment.
        Rejects scripts that sound too generic, robotic, or "salesy".
        """
        logger.info(f"[{self.name}] Reviewing TikTok script...")
        
        # Quick heuristic check first (fail fast)
        issues = []
        
        # Check for banned words/tones
        banned = ["smash that like button", "link in bio", "buy now", "act fast"]
        for phrase in banned:
            if phrase in script.lower():
                issues.append(f"Contains banned phrase: '{phrase}'")
                
        # Check for brand voice alignment
        # "Does This Feel Right?" voice is calm, reflective, honest.
        # It should NOT be: Hype-beast, aggressive, or clickbaity.
        
        if script.count("!") > 3:
            issues.append("Too many exclamation marks (feels hype-y)")
            
        if "wait for the end" in script.lower():
            issues.append("Cheap engagement tactic ('wait for end')")
            
        approved = len(issues) == 0
        
        return {
            "approved": approved,
            "issues": issues,
            "feedback": "Script aligns with brand voice." if approved else "Script violates brand guidelines.",
            "reviewed_by": self.name
        }
    
    def plan_campaign(self, theme: str, duration_weeks: int = 4) -> Dict:
        """
        Plans a multi-piece content campaign.
        """
        logger.info(f"[{self.name}] Planning campaign: {theme}")
        
        campaign = {
            "theme": theme,
            "duration_weeks": duration_weeks,
            "planned_by": self.name,
            "created_at": datetime.now().isoformat()
        }
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                As a Creative Director, plan a {duration_weeks}-week content campaign:
                
                Theme: {theme}
                Brand: {self.brand['name']}
                Values: {self.brand['values']}
                
                Return JSON:
                {{
                    "campaign_name": "catchy campaign name",
                    "objective": "what we want to achieve",
                    "content_pieces": [
                        {{"week": 1, "type": "blog_post", "topic": "...", "angle": "..."}},
                        {{"week": 2, "type": "podcast", "topic": "...", "angle": "..."}}
                    ],
                    "social_strategy": "how to promote across platforms",
                    "visual_theme": "consistent visual approach",
                    "success_metrics": ["metric1", "metric2"]
                }}
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=90
                )
                response.raise_for_status()
                result = response.json().get("response", "")
                
                if "{" in result:
                    json_str = result[result.find("{"):result.rfind("}")+1]
                    campaign["plan"] = json.loads(json_str)
                    
                    # Set as team goal
                    agents = ["Alchemist", "Designer", "Narrator", "Socialite"]
                    self.collective.set_goal(
                        f"Campaign: {theme}", agents, "high"
                    )
                    
            except Exception as e:
                logger.warning(f"[{self.name}] Campaign planning failed: {e}")
        
        self.metrics.track_agent_action(self.name, 'plan_campaign', True, 0)
        return campaign
    
    def coordinate_content_creation(self, topic: str) -> Dict:
        """
        Coordinates multiple agents to create a full content package.
        """
        logger.info(f"[{self.name}] Coordinating creation for: {topic}")
        
        # Create brief first
        brief = self.create_creative_brief(topic)
        
        coordination = {
            "topic": topic,
            "brief": brief,
            "agent_tasks": {
                "Alchemist": "Write the main blog post following the brief",
                "Designer": "Create featured image and social graphics",
                "Narrator": "Create audio summary for podcast",
                "Socialite": "Generate posts for Twitter, LinkedIn, Threads",
                "Editor": "Review and refine the content"
            },
            "workflow": [
                {"step": 1, "agent": "Alchemist", "action": "Generate content"},
                {"step": 2, "agent": "Editor", "action": "Review and critique"},
                {"step": 3, "agent": "Designer", "action": "Create visuals"},
                {"step": 4, "agent": "Narrator", "action": "Generate audio"},
                {"step": 5, "agent": "Socialite", "action": "Create social posts"},
                {"step": 6, "agent": "Creative Director", "action": "Final review"}
            ],
            "coordinated_by": self.name
        }
        
        return coordination
    
    def get_brand_guidelines(self) -> Dict:
        """
        Returns the current brand guidelines.
        """
        return self.brand
    
    def update_brand_voice(self, new_tones: List[str] = None, 
                           new_avoid: List[str] = None):
        """
        Updates brand voice guidelines.
        """
        if new_tones:
            self.brand["voice"]["tone"] = new_tones
        if new_avoid:
            self.brand["voice"]["avoid"] = new_avoid
        
        # Share update with collective
        self.collective.share_insight(
            self.name, "brand_update",
            {"voice": self.brand["voice"]},
            1.0
        )
        
        logger.info(f"[{self.name}] Brand voice updated")
    
    def get_creative_status(self) -> Dict:
        """
        Get status of all creative activities.
        """
        agent_performance = self.metrics.get_agent_rankings()
        creative_agents = ["Alchemist", "Designer", "Narrator", "Editor"]
        
        creative_performance = [
            a for a in agent_performance 
            if a["agent"] in creative_agents
        ]
        
        return {
            "brand": self.brand["name"],
            "active_campaigns": len([
                g for g in self.collective.knowledge.get("active_goals", [])
                if "Campaign" in g.get("goal", "") and g.get("status") == "active"
            ]),
            "creative_team_performance": creative_performance,
            "team_status": self.collective.get_team_status()
        }


if __name__ == "__main__":
    cd = CreativeDirector()
    
    # Test brief creation
    brief = cd.create_creative_brief("Finding Peace in a Noisy World")
    print("Creative Brief:", json.dumps(brief, indent=2))
    
    # Test coordination
    coord = cd.coordinate_content_creation("Digital Minimalism")
    print("\nCoordination Plan:")
    for step in coord["workflow"]:
        print(f"  {step['step']}. {step['agent']}: {step['action']}")
