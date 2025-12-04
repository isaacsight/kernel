"""
The Researcher - Research Assistant Agent

Finds trending topics, analyzes competitors, and suggests SEO improvements.
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

logger = logging.getLogger("Researcher")


class Researcher:
    """
    The Researcher (Research Assistant)
    
    Mission: Provide data-driven insights for content strategy.
    
    Responsibilities:
    - Research trending topics
    - Analyze competitor content
    - Suggest SEO keywords
    - Find content inspiration
    """
    
    def __init__(self):
        self.name = "The Researcher"
        self.role = "Research Assistant"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.node_url = config.STUDIO_NODE_URL
        self.research_cache = os.path.join(
            os.path.dirname(__file__), '..', 'brain', 'research_cache.json'
        )
        
    def _load_cache(self) -> Dict:
        """Load research cache."""
        if os.path.exists(self.research_cache):
            try:
                with open(self.research_cache, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {"topics": [], "keywords": {}, "last_updated": None}
    
    def _save_cache(self, cache: Dict):
        """Save research cache."""
        cache["last_updated"] = datetime.now().isoformat()
        with open(self.research_cache, 'w') as f:
            json.dump(cache, f, indent=2)
    
    def research_topic(self, topic: str) -> Dict:
        """
        Deep research on a topic using Studio Node.
        """
        logger.info(f"[{self.name}] Researching topic: {topic}")
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Research the topic: "{topic}"
                
                Provide a JSON response with:
                {{
                    "key_points": ["point1", "point2", "point3"],
                    "related_topics": ["topic1", "topic2", "topic3"],
                    "target_audience": "description of who cares about this",
                    "content_angles": ["angle1", "angle2", "angle3"],
                    "seo_keywords": ["keyword1", "keyword2", "keyword3"]
                }}
                
                Return ONLY valid JSON.
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=60
                )
                response.raise_for_status()
                result = response.json().get("response", "")
                
                # Parse JSON
                if "{" in result:
                    json_str = result[result.find("{"):result.rfind("}")+1]
                    research = json.loads(json_str)
                    
                    self.metrics.track_agent_action(self.name, 'research_topic', True, 0)
                    
                    return {
                        "topic": topic,
                        "research": research,
                        "researched_at": datetime.now().isoformat()
                    }
                    
            except Exception as e:
                logger.warning(f"[{self.name}] Research failed: {e}")
        
        return {
            "topic": topic,
            "research": {
                "key_points": ["Further research needed"],
                "related_topics": [],
                "target_audience": "General readers",
                "content_angles": [],
                "seo_keywords": [topic.lower().replace(" ", "-")]
            },
            "researched_at": datetime.now().isoformat()
        }
    
    def suggest_keywords(self, title: str, content: str) -> List[str]:
        """
        Suggests SEO keywords for content.
        """
        logger.info(f"[{self.name}] Analyzing keywords for: {title}")
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Analyze this content and suggest SEO keywords:
                
                Title: {title}
                Content Preview: {content[:500]}
                
                Return a JSON array of 10 relevant SEO keywords/phrases.
                Focus on long-tail keywords with good search potential.
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=30
                )
                response.raise_for_status()
                result = response.json().get("response", "")
                
                if "[" in result and "]" in result:
                    json_str = result[result.find("["):result.rfind("]")+1]
                    return json.loads(json_str)
                    
            except Exception as e:
                logger.warning(f"[{self.name}] Keyword analysis failed: {e}")
        
        # Extract basic keywords from title
        words = title.lower().split()
        return [w for w in words if len(w) > 3][:5]
    
    def find_content_inspiration(self, theme: str, count: int = 5) -> List[Dict]:
        """
        Generates content ideas based on a theme.
        """
        logger.info(f"[{self.name}] Finding inspiration for theme: {theme}")
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Generate {count} unique blog post ideas for the theme: "{theme}"
                
                For each idea, provide:
                - title: A compelling headline
                - hook: The opening hook
                - outline: 3 key points
                
                Return as a JSON array of objects.
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=60
                )
                response.raise_for_status()
                result = response.json().get("response", "")
                
                if "[" in result and "]" in result:
                    json_str = result[result.find("["):result.rfind("]")+1]
                    ideas = json.loads(json_str)
                    
                    self.metrics.track_agent_action(self.name, 'find_inspiration', True, 0)
                    return ideas
                    
            except Exception as e:
                logger.warning(f"[{self.name}] Inspiration search failed: {e}")
        
        return [{"title": f"Exploring {theme}", "hook": "...", "outline": []}]
    
    def analyze_writing_style(self, content: str) -> Dict:
        """
        Analyzes writing style and suggests improvements.
        """
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Analyze this writing style and provide constructive feedback:
                
                Content: {content[:1000]}
                
                Return JSON with:
                {{
                    "tone": "description of tone",
                    "readability": "easy/medium/hard",
                    "strengths": ["strength1", "strength2"],
                    "improvements": ["suggestion1", "suggestion2"],
                    "similar_to": "mention any similar writing styles"
                }}
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=30
                )
                response.raise_for_status()
                result = response.json().get("response", "")
                
                if "{" in result:
                    json_str = result[result.find("{"):result.rfind("}")+1]
                    return json.loads(json_str)
                    
            except Exception as e:
                logger.warning(f"[{self.name}] Style analysis failed: {e}")
        
        return {"tone": "Unknown", "readability": "medium", "strengths": [], "improvements": []}


if __name__ == "__main__":
    researcher = Researcher()
    
    # Test research
    result = researcher.research_topic("digital wellness")
    print("Research Result:", json.dumps(result, indent=2))
    
    # Test inspiration
    ideas = researcher.find_content_inspiration("mindfulness")
    print("\nContent Ideas:", ideas)
