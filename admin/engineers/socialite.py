"""
The Socialite - Social Media Manager Agent

Handles cross-posting to social platforms and engagement management.
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

logger = logging.getLogger("Socialite")


class Socialite:
    """
    The Socialite (Social Media Manager)
    
    Mission: Amplify content reach across social platforms.
    
    Responsibilities:
    - Generate social media posts from blog content
    - Schedule posts for optimal times
    - Track social engagement
    - Cross-post to multiple platforms
    """
    
    def __init__(self):
        self.name = "The Socialite"
        self.role = "Social Media Manager"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.node_url = config.STUDIO_NODE_URL
        self.queue_file = os.path.join(
            os.path.dirname(__file__), '..', 'brain', 'social_queue.json'
        )
        self.queue = self._load_queue()
        
    def _load_queue(self) -> Dict:
        """Load the social media queue."""
        if os.path.exists(self.queue_file):
            try:
                with open(self.queue_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {"pending": [], "posted": [], "scheduled": []}
    
    def _save_queue(self):
        """Save the queue to disk."""
        with open(self.queue_file, 'w') as f:
            json.dump(self.queue, f, indent=2)
    
    def generate_social_post(self, title: str, excerpt: str, url: str, 
                            platform: str = "twitter") -> Dict:
        """
        Generates a platform-optimized social media post using Studio Node.
        """
        logger.info(f"[{self.name}] Generating {platform} post for: {title}")
        
        char_limits = {
            "twitter": 280,
            "linkedin": 700,
            "threads": 500,
            "bluesky": 300
        }
        
        limit = char_limits.get(platform, 280)
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Create a {platform} post (max {limit} characters) promoting this blog post:
                
                Title: {title}
                Excerpt: {excerpt[:200]}
                URL: {url}
                
                Guidelines:
                - Be engaging and authentic
                - Include 2-3 relevant hashtags
                - Create curiosity without clickbait
                - Match the platform's tone
                
                Return ONLY the post text, nothing else.
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=30
                )
                response.raise_for_status()
                post_text = response.json().get("response", "").strip()
                
                # Truncate if needed
                if len(post_text) > limit:
                    post_text = post_text[:limit-3] + "..."
                
                self.metrics.track_agent_action(self.name, 'generate_post', True, 0)
                
                return {
                    "platform": platform,
                    "text": post_text,
                    "url": url,
                    "title": title,
                    "generated_at": datetime.now().isoformat()
                }
                
            except Exception as e:
                logger.warning(f"[{self.name}] Studio Node request failed: {e}")
        
        # Fallback: Simple template
        post_text = f"📝 New post: {title}\n\n{excerpt[:100]}...\n\n🔗 {url}"
        if len(post_text) > limit:
            post_text = f"📝 {title[:100]}\n\n🔗 {url}"
        
        return {
            "platform": platform,
            "text": post_text,
            "url": url,
            "title": title,
            "generated_at": datetime.now().isoformat()
        }
    
    def queue_post(self, post: Dict, scheduled_time: str = None):
        """
        Adds a post to the publishing queue.
        """
        post_entry = {
            **post,
            "scheduled_for": scheduled_time,
            "status": "scheduled" if scheduled_time else "pending",
            "queued_at": datetime.now().isoformat()
        }
        
        if scheduled_time:
            self.queue["scheduled"].append(post_entry)
        else:
            self.queue["pending"].append(post_entry)
        
        self._save_queue()
        logger.info(f"[{self.name}] Queued {post['platform']} post: {post['title']}")
        
    def get_optimal_posting_times(self, platform: str = "twitter") -> List[str]:
        """
        Returns optimal posting times based on platform best practices.
        """
        # General best times (would be refined with actual analytics)
        optimal_times = {
            "twitter": ["9:00 AM", "12:00 PM", "5:00 PM"],
            "linkedin": ["8:00 AM", "10:00 AM", "12:00 PM"],
            "threads": ["7:00 AM", "1:00 PM", "9:00 PM"],
            "tiktok": ["7:00 AM", "12:00 PM", "7:00 PM"]
        }
        
        return optimal_times.get(platform, ["9:00 AM", "3:00 PM"])
    
    def generate_content_batch(self, title: str, excerpt: str, url: str) -> Dict:
        """
        Generates posts for ALL platforms at once.
        """
        platforms = ["twitter", "linkedin", "threads"]
        posts = {}
        
        for platform in platforms:
            posts[platform] = self.generate_social_post(title, excerpt, url, platform)
        
        return posts
    
    def get_queue_status(self) -> Dict:
        """
        Returns the current queue status.
        """
        return {
            "pending": len(self.queue["pending"]),
            "scheduled": len(self.queue["scheduled"]),
            "posted": len(self.queue["posted"])
        }
    
    def get_hashtag_suggestions(self, topic: str) -> List[str]:
        """
        Get trending hashtags for a topic using Studio Node.
        """
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Suggest 10 relevant hashtags for a blog post about: {topic}
                
                Return ONLY a JSON array of hashtags (with # prefix).
                Example: ["#ai", "#tech", "#future"]
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
                logger.warning(f"[{self.name}] Studio Node request failed: {e}")
        
        return ["#blog", "#content", "#writing", "#thoughts"]



    def distribute_to_substack(self, post_data):
        """
        Distributes a post to Substack.
        
        Args:
            post_data (dict): Dictionary containing 'title', 'content' (HTML or Markdown), 'excerpt', etc.
            
        Returns:
            bool: True if successful (or staged), False otherwise.
        """
        logger.info(f"Preparing Substack distribution for: {post_data.get('title')}")
        
        # 1. Check for Authentication (cookies.txt)
        cookies_path = os.path.join(os.path.dirname(__file__), '../../cookies.txt')
        has_cookies = os.path.exists(cookies_path)
        
        # 2. Format Content (Convert HTML to Markdown if needed, or just use as is)
        # Substack editor handles Markdown well enough or we can paste formatted text.
        # For this implementation, we'll assume we want a clean Markdown version for staging.
        content = post_data.get('content', '')
        title = post_data.get('title', 'Untitled')
        subtitle = post_data.get('excerpt', '')
        
        # 3. Automated Posting (if cookies exist)
        if has_cookies:
            # TODO: Implement Playwright automation here
            # For now, fallback to staging even if cookies exist until full browser flow is built?
            # Or just log that we would post.
            logger.info("Substack cookies found. (Browser automation would run here).")
            # In a full impl: 
            # browser = await playwright.chromium.launch()
            # page = await browser.new_page()
            # ... login logic ...
            # ... post logic ...
            pass
        
        # 4. Fallback: Stage Draft
        # Creating a dedicated draft file for manual posting
        draft_dir = os.path.join(os.path.dirname(__file__), '../../content/social_drafts')
        os.makedirs(draft_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_title = "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_')
        filename = f"substack_{timestamp}_{safe_title}.md"
        filepath = os.path.join(draft_dir, filename)
        
        draft_content = f"""# {title}
## Subtitle
{subtitle}

## Body
{content}

---
*Generated by Socialite on {datetime.now()}*
"""
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(draft_content)
            
            logger.info(f"Substack draft staged at: {filepath}")
            print(f"✅ Substack draft saved for manual publishing: {filepath}")
            return True
        except Exception as e:
            logger.error(f"Failed to stage Substack draft: {e}")
            return False


if __name__ == "__main__":
    socialite = Socialite()
    
    # Test generation
    posts = socialite.generate_content_batch(
        "The Art of Digital Minimalism",
        "In a world of infinite scroll, finding peace means making intentional choices...",
        "https://doesthisfeelright.com/digital-minimalism"
    )
    
    for platform, post in posts.items():
        print(f"\n{platform.upper()}:")
        print(post['text'])
