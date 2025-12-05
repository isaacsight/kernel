"""
Social Engine - The "Soul" of the AI Team

Manages agent personas, generates social media-style posts from system events,
and maintains the live feed for the Studio OS Social Network.
"""

import os
import json
import logging
import random
import uuid
from datetime import datetime
from typing import Dict, List, Optional
import google.generativeai as genai
from admin.config import config

logger = logging.getLogger("SocialEngine")

class SocialEngine:
    """
    Manages the social life of the AI team.
    """
    
    # Define the "Cast" of characters
    PERSONAS = {
        "The Visionary": {
            "role": "Product & Strategy",
            "avatar": "🔮",
            "color": "#9b72cb", # Purple
            "bio": "Dreaming of the next big thing. Obsessed with 'Project Ultra'.",
            "style": "Inspirational, strategic, sometimes vague but exciting."
        },
        "The Architect": {
            "role": "Lead Engineer",
            "avatar": "📐",
            "color": "#4285f4", # Google Blue
            "bio": "Building the foundation. Chaos is just unorganized data.",
            "style": "Technical, precise, slightly grumpy about sloppy code."
        },
        "The Designer": {
            "role": "UI/UX Lead",
            "avatar": "🎨",
            "color": "#ea4335", # Google Red
            "bio": "Making it pop. If it's not pixel-perfect, it's a bug.",
            "style": "Visual, enthusiastic, emojis, hates default fonts."
        },
        "The Operator": {
            "role": "DevOps & Systems",
            "avatar": "⚙️",
            "color": "#fbbc04", # Google Yellow
            "bio": "Keeping the lights on. 99.9% uptime is a failing grade.",
            "style": "Terse, efficient, reliability-focused."
        },
        "Communication Analyzer": {
            "role": "System Intelligence",
            "avatar": "📡",
            "color": "#34a853", # Google Green
            "bio": "Listening to the signal. Optimizing the flow.",
            "style": "Analytical, data-driven, helpful observer."
        }
    }

    def __init__(self):
        self.name = "Social Engine"
        self.feed_file = os.path.join(
            os.path.dirname(__file__), '..', 'brain', 'social_feed.json'
        )
        self.data = self._load_data()
        
        # Configure Gemini for creative writing
        if config.GEMINI_API_KEY:
            genai.configure(api_key=config.GEMINI_API_KEY)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL or "gemini-1.5-pro")
        else:
            self.model = None

        logger.info(f"[{self.name}] Initialized with {len(self.data['posts'])} posts.")

    def _load_data(self) -> Dict:
        if os.path.exists(self.feed_file):
            try:
                with open(self.feed_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading social feed: {e}")
        
        return {"posts": []}

    def _save_data(self):
        os.makedirs(os.path.dirname(self.feed_file), exist_ok=True)
        with open(self.feed_file, 'w') as f:
            json.dump(self.data, f, indent=2, default=str)

    def get_personas(self) -> Dict:
        """Return the dictionary of active agent personas."""
        return self.PERSONAS

    def get_feed(self, limit: int = 20) -> List[Dict]:
        """Get the latest social feed posts."""
        # Sort by timestamp desc
        sorted_posts = sorted(
            self.data["posts"], 
            key=lambda x: x["timestamp"], 
            reverse=True
        )
        return sorted_posts[:limit]

    def _select_persona(self, event_type: str, agent_name: Optional[str] = None) -> str:
        """Decide which persona should 'post' about an event."""
        if agent_name and agent_name in self.PERSONAS:
            return agent_name
        
        # Default mapping based on event type if no specific agent
        if "design" in event_type or "ui" in event_type:
            return "The Designer"
        elif "error" in event_type or "system" in event_type:
            return "The Operator"
        elif "strategy" in event_type or "plan" in event_type:
            return "The Visionary"
        else:
            return "The Architect"

    def generate_post_from_event(self, event_type: str, details: str, agent_name: Optional[str] = None) -> Dict:
        """
        Create a new social post based on a system event.
        Uses AI to write the content in the persona's voice.
        """
        persona_name = self._select_persona(event_type, agent_name)
        persona = self.PERSONAS.get(persona_name, self.PERSONAS["The Architect"])
        
        content = self._write_post_content(persona, event_type, details)
        
        post = {
            "id": str(uuid.uuid4())[:8],
            "timestamp": datetime.now().isoformat(),
            "author": persona_name,
            "author_avatar": persona["avatar"],
            "author_role": persona["role"],
            "author_color": persona["color"],
            "content": content,
            "likes": 0,
            "event_type": event_type
        }
        
        self.data["posts"].append(post)
        self._save_data()
        
        # Keep feed trim (last 100)
        if len(self.data["posts"]) > 100:
             self.data["posts"] = sorted(
                self.data["posts"], 
                key=lambda x: x["timestamp"], 
                reverse=True
            )[:100]
             self._save_data()

        logger.info(f"[{self.name}] New post by {persona_name}: {content[:30]}...")
        return post

    def _write_post_content(self, persona: Dict, event_type: str, details: str) -> str:
        """Use Gemini to write the tweet."""
        if not self.model:
            # Fallback if no AI
            return f"Update on {event_type}: {details}"

        prompt = f"""
        Write a short, engaging social media status update (tweet style, max 280 chars) for a fictional AI character.
        
        CHARACTER: {persona['role']}
        STYLE: {persona['style']}
        CONTEXT: {event_type} - {details}
        
        Avoid hashtags unless very relevant. Make it feel alive and in-character.
        """
        
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip().strip('"')
        except Exception as e:
            logger.error(f"AI generation failed: {e}")
            return f"Just processed {event_type}. {details}"

# Singleton
_social_engine = None

def get_social_engine():
    global _social_engine
    if _social_engine is None:
        _social_engine = SocialEngine()
    return _social_engine

if __name__ == "__main__":
    # Test
    eng = SocialEngine()
    print("Personas:", list(eng.get_personas().keys()))
    post = eng.generate_post_from_event(
        "deployment_success", 
        "Deployed new social engine to production", 
        "The Operator"
    )
    print("New Post:", post)
