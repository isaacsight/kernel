import sys
import os
import logging
import frontmatter

# Add project root to path
import argparse

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TikTokGenerator")

from admin.engineers.broadcaster import Broadcaster
from admin.config import config

def generate_studio_tiktok(upload=False, dry_run=False):
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
    
    if dry_run:
        print("🌵 Dry Run Mode: Skipping actual generation and upload.")
        print(f"Would process post: {post.get('title')}")
        print(f"Upload requested: {upload}")
        return

    # 4. Generate
    # Vibe 'tech' triggers the internal logic to use 'Programmatic CapCut' effects like glitch/hacker
    output_path = broadcaster.generate_video(post, vibe="tech")
    
    if output_path and os.path.exists(output_path):
        print(f"✅ Video Generated Successfully: {output_path}")
        
        if upload:
            print("🚀 Uploading to TikTok...")
            success = broadcaster.upload_to_tiktok(output_path, description=f"{post.get('title')} #devlog #coding #ai")
            if success:
                print("✅ Uploaded Successfully!")
            else:
                print("❌ Upload Failed.")
        else:
            # Open it for the user if not uploading (or maybe always open?)
            # Usually if automating, we might not want to pop up windows, but for now keep existing behavior
            os.system(f"open '{output_path}'")
    else:
        print("❌ Video Generation Failed.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate and optionally upload TikTok video.")
    parser.add_argument("--upload", action="store_true", help="Upload the generated video to TikTok.")
    parser.add_argument("--dry-run", action="store_true", help="Simulate the process without generating or uploading.")
    
    args = parser.parse_args()
    
    generate_studio_tiktok(upload=args.upload, dry_run=args.dry_run)
