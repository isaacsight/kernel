
import os
import sys
import logging
import frontmatter
from datetime import datetime

# Setup paths
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from admin.engineers.content_repurposer import ContentRepurposer
from admin.engineers.broadcaster import Broadcaster

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("MultiPlatformLauncher")

def main():
    logger.info("=== Launching Multi-Platform Distribution Pipeline ===")
    
    # 1. Load the most recent post
    content_dir = "content"
    posts = [f for f in os.listdir(content_dir) if f.endswith(".md")]
    posts.sort(reverse=True) # Newest first
    
    if not posts:
        logger.error("No posts found!")
        return
        
    target_post_file = posts[0]
    post_path = os.path.join(content_dir, target_post_file)
    logger.info(f"Processing post: {target_post_file}")
    
    post = frontmatter.load(post_path)
    post_data = {
        "title": post.get("title"),
        "content": post.content,
        "tags": post.get("tags", []),
        "slug": os.path.splitext(target_post_file)[0]
    }
    
    # 2. Repurpose Content
    repurposer = ContentRepurposer()
    platforms = ["tiktok", "twitter", "linkedin", "instagram", "youtube"]
    logger.info(f"Repurposing for: {', '.join(platforms)}")
    
    repurposed_content = repurposer.repurpose(post_data, platforms=platforms)
    
    # 3. Distribute (Simulated)
    broadcaster = Broadcaster()
    
    # Twitter
    if "twitter" in repurposed_content["outputs"]:
        logger.info("Distributing to Twitter...")
        twitter_data = repurposed_content["outputs"]["twitter"]
        if broadcaster.distribute_to_twitter(twitter_data):
            logger.info("✅ Twitter thread staged successfully.")
        else:
            logger.error("❌ Twitter distribution failed.")
            
    # LinkedIn
    if "linkedin" in repurposed_content["outputs"]:
        logger.info("Distributing to LinkedIn...")
        linkedin_data = repurposed_content["outputs"]["linkedin"]
        if broadcaster.distribute_to_linkedin(linkedin_data):
            logger.info("✅ LinkedIn post staged successfully.")
        else:
            logger.error("❌ LinkedIn distribution failed.")

    # Instagram
    if "instagram" in repurposed_content["outputs"]:
        logger.info("Distributing to Instagram...")
        ig_data = repurposed_content["outputs"]["instagram"]
        if broadcaster.distribute_to_instagram(ig_data):
            logger.info("✅ Instagram carousel staged successfully.")
        else:
            logger.error("❌ Instagram distribution failed.")

    # YouTube
    if "youtube" in repurposed_content["outputs"]:
        logger.info("Distributing to YouTube...")
        yt_data = repurposed_content["outputs"]["youtube"]
        if broadcaster.distribute_to_youtube(yt_data):
            logger.info("✅ YouTube Shorts staged successfully.")
        else:
            logger.error("❌ YouTube distribution failed.")
            
    logger.info("=== Pipeline Complete ===")

if __name__ == "__main__":
    main()
