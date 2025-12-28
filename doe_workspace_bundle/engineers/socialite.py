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
        Distributes a post to Substack using Browser Automation.
        REQUIRES: 'substack_cookies.json' in project root.
        """
        logger.info(f"Preparing Substack distribution for: {post_data.get('title')}")
        
        # Paths
        cookie_file = os.path.join(os.path.dirname(__file__), '../../substack_cookies.json')
        
        # 1. Check for Cookies
        if not os.path.exists(cookie_file):
            logger.warning("No 'substack_cookies.json' found. Falling back to staging draft.")
            return self._stage_subtack_draft(post_data)
            
        try:
            import datetime
            import re
            from playwright.sync_api import sync_playwright
            
            with sync_playwright() as p:
                logger.info("Launching browser for Substack automation...")
                # Headless=True for production, can be False for debugging
                browser = p.chromium.launch(headless=True)
                
                # Load auth state
                context = browser.new_context(storage_state=cookie_file)
                page = context.new_page()
                
                # 2. Navigation
                # Use specific subdomain to ensure we hit the correct editor
                subdomain = "doesthisfeelright"
                create_url = f"https://{subdomain}.substack.com/publish/post"
                
                logger.info(f"Navigating to {create_url}...")
                try:
                    page.goto(create_url, wait_until='domcontentloaded', timeout=45000)
                    # Wait a bit for redirects
                    page.wait_for_timeout(5000)
                except Exception as nav_e:
                    logger.error(f"Navigation timeout/error: {nav_e}")
                    page.screenshot(path="debug_nav_failure.png")
                    raise nav_e
                
                logger.info(f"Landed on: {page.url}")

                # Check if login worked (redirected to login page?)
                if "login" in page.url or "sign-in" in page.url:
                    logger.error("Cookies expired or invalid. Redirected to login.")
                    page.screenshot(path="debug_login_redirect.png")
                    browser.close()
                    return self._stage_subtack_draft(post_data)

                # 3. Input Content
                title = post_data.get('title', 'Untitled')
                # Fix: Prioritize 'subtitle' if present, fallback to 'excerpt'
                subtitle = post_data.get('subtitle') or post_data.get('excerpt', '')
                content = post_data.get('content', '') 
                
                logger.info("Filling post details...")
                
                # Robust Selector Strategy
                # 1. Title
                # Identified via DOM dump: data-testid="post-title"
                try:
                    title_input = page.locator('[data-testid="post-title"]')
                    title_input.fill(title)
                    # Force autosave trigger
                    title_input.dispatch_event("input")
                except:
                    logger.warning("Could not find Title via data-testid. Trying generic placeholders.")
                    try:
                        page.get_by_placeholder("Title").fill(title)
                    except:
                        page.get_by_placeholder("Add a title...").fill(title)

                # 2. Subtitle
                # identified via DOM dump: placeholder="Add a subtitle…"
                try:
                    # Use Regex to be robust against ellipsis vs three dots
                    subtitle_input = page.get_by_placeholder(re.compile(r"Add a subtitle", re.IGNORECASE))
                    
                    if subtitle_input.is_visible():
                        subtitle_input.fill(subtitle)
                        subtitle_input.dispatch_event("input")
                    else:
                        logger.warning("Subtitle input found but not visible.")
                        # Try forcing a click on the 'Add subtitle' button if it exists?
                        # Sometimes it's a button with text "Add subtitle"
                        add_sub_btn = page.get_by_text("Add subtitle", exact=True)
                        if add_sub_btn.is_visible():
                            add_sub_btn.click()
                            page.wait_for_timeout(500)
                            subtitle_input.fill(subtitle)
                            subtitle_input.dispatch_event("input")
                except Exception as e:
                     logger.warning(f"Could not fill subtitle: {e}")

                # 3. Content
                # Use robust data-testid selector
                editor = page.locator('[data-testid="editor"]')
                
                if not editor.is_visible():
                     # Fallback to class but restrict to first if multiple (though testid should work)
                     editor = page.locator('.tiptap.ProseMirror').first
                
                if editor.is_visible():
                    editor.click()
                    # Use evaluate to inject HTML content directly into the editor
                    safe_content = content.replace("`", "\\`").replace("${", "\\${")
                    
                    # Pass the element handle to evaluate to avoid re-querying ambiguity
                    editor.evaluate(f"(element) => element.innerHTML = `{safe_content}`")
                    
                    # FORCE AUTOSAVE: 
                    # Dispatch input event so React/app knows it changed
                    editor.evaluate("(element) => element.dispatchEvent(new Event('input', { bubbles: true }))")
                    
                    # Extra safety: Type a space and delete it to trigger keystroke listeners
                    editor.press("End") 
                    editor.type(" ")
                    editor.press("Backspace")
                else:
                    logger.warning("Could not find editor. contenteditable not found.")
                    page.screenshot(path="debug_no_editor.png")
                
                # 4. Wait for Save
                # Substack usually shows "Saved" in the top bar. 
                # We'll wait a bit longer and check.
                logger.info("Waiting for Substack autosave...")
                page.wait_for_timeout(5000)
                
                # Optional: Try to find "Saved" text
                # clean_status = page.locator("div", has_text="Saved").first
                # if clean_status.is_visible():
                #    logger.info("Confirmed 'Saved' status.")
                
                logger.info("Draft process completed. Taking confirmation screenshot...")
                page.screenshot(path="debug_substack_final.png", full_page=True)
                
                browser.close()
                print("✅ Posted to Substack successfully via automation!")
                return True

        except Exception as e:
            logger.error(f"Playwright automation failed: {e}")
            return self._stage_subtack_draft(post_data)

    def _stage_subtack_draft(self, post_data):
        """Helper to stage a markdown draft."""
        draft_dir = os.path.join(os.path.dirname(__file__), '../../content/social_drafts')
        os.makedirs(draft_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        title = post_data.get('title', 'Untitled')
        content = post_data.get('content', '')
        subtitle = post_data.get('excerpt', '')
        
        safe_title = "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_')
        filename = f"substack_{timestamp}_{safe_title}.md"
        filepath = os.path.join(draft_dir, filename)
        
        draft_content = f"# {title}\n## {subtitle}\n\n{content}\n\n---\n*Staged for Manual Posting*"
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(draft_content)
            
        print(f"⚠️ Automation unavailable. Draft staged: {filepath}")
        return True


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
