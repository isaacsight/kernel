"""
The Content Repurposer - 1→N Content Factory

Transforms a single blog post into multiple content pieces
for different platforms (TikTok, Instagram, Twitter, LinkedIn).

Inspired by Blotato's "remix 1 article → 10+ posts" approach.
"""

import os
import sys
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from config import config

logger = logging.getLogger("ContentRepurposer")


class ContentRepurposer:
    """
    The Content Repurposer (Distribution Multiplier)
    
    Mission: Turn one piece of content into many for maximum reach.
    
    Capabilities:
    - Generate TikTok scripts from blog posts
    - Create Instagram carousel slides
    - Write Twitter/X thread breakdowns
    - Craft LinkedIn posts
    - Produce YouTube Shorts scripts
    """
    
    def __init__(self):
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        
    def repurpose(self, post: Dict, platforms: List[str] = None) -> Dict:
        """
        Repurposes a blog post into multiple platform-specific content.
        
        Args:
            post: Dict with 'title', 'content', and optional 'tags'
            platforms: List of platforms to target, or None for all
            
        Returns:
            Dict with content for each platform
        """
        if platforms is None:
            platforms = ["tiktok", "instagram", "twitter", "linkedin"]
            
        title = post.get("title", "")
        content = post.get("content", "")
        tags = post.get("tags", [])
        
        result = {
            "source": {
                "title": title,
                "word_count": len(content.split()),
                "repurposed_at": datetime.now().isoformat()
            },
            "outputs": {}
        }
        
        if "tiktok" in platforms:
            result["outputs"]["tiktok"] = self._generate_tiktok(title, content, tags)
            
        if "instagram" in platforms:
            result["outputs"]["instagram"] = self._generate_instagram(title, content, tags)
            
        if "twitter" in platforms:
            result["outputs"]["twitter"] = self._generate_twitter(title, content, tags)
            
        if "linkedin" in platforms:
            result["outputs"]["linkedin"] = self._generate_linkedin(title, content, tags)

        if "youtube" in platforms:
            result["outputs"]["youtube"] = self._generate_youtube(title, content, tags)
            
        # Track for metrics
        self.metrics.log_event("repurposer", {
            "title": title,
            "platforms": platforms,
            "output_count": len(result["outputs"])
        })
        
        return result
    
    def _generate_tiktok(self, title: str, content: str, tags: List[str]) -> Dict:
        """Generates TikTok script with hook, content, and CTA."""
        
        # Extract key points (first 3 paragraphs or sentences)
        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
        key_content = paragraphs[:3] if paragraphs else [content[:500]]
        
        # Build script structure
        hook = self._create_hook(title, "tiktok")
        main_points = self._extract_main_points(content, max_points=3)
        cta = "Follow for more deep thoughts on life and tech."
        
        script = f"""{hook}

{chr(10).join(f"• {point}" for point in main_points)}

{cta}"""
        
        # Generate hashtags
        hashtags = self._generate_hashtags(title, tags, "tiktok")
        
        return {
            "type": "script",
            "script": script.strip(),
            "hook": hook,
            "duration_estimate": f"{len(script.split()) // 2} seconds",
            "hashtags": hashtags,
            "suggested_vibe": self._suggest_vibe(content)
        }
    
    def _generate_instagram(self, title: str, content: str, tags: List[str]) -> Dict:
        """Generates Instagram carousel content."""
        
        # Carousel structure: Cover + 3-5 content slides + CTA
        slides = []
        
        # Slide 1: Hook/Title
        hook = self._create_hook(title, "instagram")
        slides.append({
            "slide_number": 1,
            "type": "cover",
            "headline": hook,
            "subtext": "Swipe to learn more →"
        })
        
        # Content slides (main points)
        main_points = self._extract_main_points(content, max_points=4)
        for i, point in enumerate(main_points, start=2):
            slides.append({
                "slide_number": i,
                "type": "content",
                "text": point
            })
        
        # CTA slide
        slides.append({
            "slide_number": len(slides) + 1,
            "type": "cta",
            "headline": "Found this helpful?",
            "cta": "Save this post 💾 • Share with a friend • Follow for more"
        })
        
        # Caption
        caption = f"{hook}\n\nFull thoughts in the carousel above ☝️\n\n{self._generate_hashtags(title, tags, 'instagram')}"
        
        return {
            "type": "carousel",
            "slide_count": len(slides),
            "slides": slides,
            "caption": caption
        }
    
    def _generate_twitter(self, title: str, content: str, tags: List[str]) -> Dict:
        """Generates Twitter/X thread."""
        
        tweets = []
        
        # Tweet 1: Hook
        hook = self._create_hook(title, "twitter")
        tweets.append(f"{hook}\n\n🧵 Thread:")
        
        # Content tweets (main points)
        main_points = self._extract_main_points(content, max_points=5)
        for i, point in enumerate(main_points, start=2):
            tweet = f"{i}/ {point}"
            # Ensure under 280 chars
            if len(tweet) > 270:
                tweet = tweet[:267] + "..."
            tweets.append(tweet)
        
        # Final tweet: CTA
        tweets.append(f"{len(tweets) + 1}/ If this resonated, give it a repost.\n\nFollow @yourusername for more thoughts like this.")
        
        return {
            "type": "thread",
            "tweet_count": len(tweets),
            "tweets": tweets,
            "total_characters": sum(len(t) for t in tweets)
        }
    
    def _generate_linkedin(self, title: str, content: str, tags: List[str]) -> Dict:
        """Generates LinkedIn post."""
        
        hook = self._create_hook(title, "linkedin")
        main_points = self._extract_main_points(content, max_points=4)
        
        # LinkedIn format: Hook → Story/Points → CTA → Hashtags
        post = f"""{hook}

Here's what I've learned:

{chr(10).join(f"→ {point}" for point in main_points)}

---

What's your take on this?

Drop a comment below 👇

{self._generate_hashtags(title, tags, 'linkedin')}"""
        
        return {
            "type": "post",
            "post": post.strip(),
            "character_count": len(post),
            "estimated_read_time": f"{len(post.split()) // 200} min"
        }
    
    def _create_hook(self, title: str, platform: str) -> str:
        """Creates a platform-specific hook from the title."""
        
        # Platform-specific styles
        if platform == "tiktok":
            return f"Nobody talks about this, but... {title.lower()} is everything."
        elif platform == "instagram":
            return f"The truth about {title.lower()} 👇"
        elif platform == "twitter":
            return f"Unpopular opinion: {title}"
        elif platform == "linkedin":
            return f"I've been thinking about {title.lower()}."
        else:
            return title
    
    def _extract_main_points(self, content: str, max_points: int = 4) -> List[str]:
        """Extracts main points from content."""
        
        # Split into sentences
        sentences = []
        for sep in [".", "!", "?"]:
            content = content.replace(sep, sep + "|||")
        raw_sentences = [s.strip() for s in content.split("|||") if s.strip()]
        
        # Filter to meaningful sentences (10-30 words)
        good_sentences = [
            s for s in raw_sentences 
            if 10 <= len(s.split()) <= 40 and not s.startswith("http")
        ]
        
        # Take first N
        return good_sentences[:max_points] if good_sentences else raw_sentences[:max_points]
    
    def _generate_hashtags(self, title: str, tags: List[str], platform: str) -> str:
        """Generates platform-appropriate hashtags using social_config.json."""
        
        # Load config
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "social_config.json")
        social_config = {}
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                social_config = json.load(f)
        
        # Base hashtags from tags
        hashtags = [f"#{tag.replace(' ', '').replace('-', '')}" for tag in tags[:3]]
        
        # Add platform-specific defaults from config
        platform_config = social_config.get("platforms", {}).get(platform, {})
        defaults = platform_config.get("default_hashtags", [])
        
        hashtags.extend(defaults[:3])
        
        # Limit based on platform norms
        max_tags = {"tiktok": 5, "instagram": 15, "twitter": 2, "linkedin": 5, "youtube": 10}
        hashtags = hashtags[:max_tags.get(platform, 5)]
        
        return " ".join(hashtags)
    
    def _suggest_vibe(self, content: str) -> str:
        """Suggests a vibe/style for the content."""
        content_lower = content.lower()
        
        if any(word in content_lower for word in ["tech", "code", "ai", "software", "data"]):
            return "tech"
        elif any(word in content_lower for word in ["story", "journey", "learned", "realized", "experience"]):
            return "chill"
        elif any(word in content_lower for word in ["urgent", "now", "must", "critical", "breaking"]):
            return "upbeat"
        else:
            return "chill"  # Default

    def _generate_youtube(self, title: str, content: str, tags: List[str]) -> Dict:
        """Generates YouTube Shorts script (similar to TikTok but optimized for YT SEO)."""
        
        script_data = self._generate_tiktok(title, content, tags)
        
        # YouTube specific metadata
        seo_title = f"{title} #Shorts"
        description = f"""
{title}

{self._extract_main_points(content, 1)[0]}

Subscribe for more: @StudioOS

{self._generate_hashtags(title, tags, 'youtube')}
"""
        return {
            "type": "shorts_script",
            "title": seo_title,
            "description": description.strip(),
            "script": script_data["script"],
            "hook": script_data["hook"]
        }


# Quick access function
def get_content_repurposer() -> ContentRepurposer:
    return ContentRepurposer()


if __name__ == "__main__":
    repurposer = ContentRepurposer()
    
    # Test with sample post
    test_post = {
        "title": "The Lost Art of Stillness",
        "content": """
        In a world increasingly defined by constant connectivity and endless notifications,
        we've lost something precious: the ability to simply be still.
        
        I used to fill every quiet moment with podcasts, scrolling, or productivity.
        But then I tried something different: 10 minutes of complete silence each morning.
        
        What I discovered surprised me. My best ideas didn't come from consuming more—
        they came from the spaces in between. The white noise of constant input was
        drowning out my own thoughts.
        
        Now I protect that stillness like it's sacred. Because it is.
        """,
        "tags": ["mindfulness", "productivity", "wellness"]
    }
    
    print("=== Content Repurposer Test ===\n")
    result = repurposer.repurpose(test_post)
    
    for platform, content in result["outputs"].items():
        print(f"\n{'='*40}")
        print(f"Platform: {platform.upper()}")
        print(f"{'='*40}")
        print(json.dumps(content, indent=2))
