import sys
import os
import logging
import frontmatter

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TikTokGenerator")

from admin.engineers.broadcaster import Broadcaster
from admin.config import config

def generate_studio_tiktok():
    print("🎬 Starting 'Self-Evolving Studio' TikTok Production...")
    
    # 1. Load the Content
    post_path = os.path.join(config.CONTENT_DIR, "devlog-self-evolving-studio.md")
    if not os.path.exists(post_path):
        logger.error(f"Post not found at {post_path}")
        return

    post = frontmatter.load(post_path)
    logger.info(f"Loaded Post: {post.get('title')}")
    
    # 2. Check Environment
    # We rely on API Keys for script/voice generation.
    if not config.GEMINI_API_KEY:
        logger.warning("⚠️ GEMINI_API_KEY is missing. Script generation might fail or rely on cache.")
    
    # 3. Create Broadcaster (The 'Use CapCut' Engine)
    broadcaster = Broadcaster()
    
    # 4. Generate
    # Vibe 'tech' triggers the internal logic to use 'Programmatic CapCut' effects like glitch/hacker
    output_path = broadcaster.generate_video(post, vibe="tech")
    
    if output_path and os.path.exists(output_path):
        print(f"✅ Video Generated Successfully: {output_path}")
        # Open it for the user
        os.system(f"open '{output_path}'")
    else:
        print("❌ Video Generation Failed.")

if __name__ == "__main__":
    generate_studio_tiktok()
