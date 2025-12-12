
import os
import sys
import logging
import time
from pathlib import Path

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AutoPoster")

def auto_post_promo():
    print("=== Auto-Posting TikTok Promo for 'Building with Antigravity' ===")
    
    # 1. Check for Manual CapCut Export first (Preferred)
    # The user might have named it 'building-with-antigravity.mp4' or similar
    # We'll check a few likely names
    video_dir = os.path.join(os.path.dirname(__file__), "../static/videos")
    candidates = [
        "building-with-antigravity.mp4",
        "promo.mp4",
        "draft_export.mp4"
    ]
    
    video_path = None
    for c in candidates:
        p = os.path.join(video_dir, c)
        if os.path.exists(p):
            video_path = p
            print(f"✅ Found manually exported video: {c}")
            break
            
    # 2. If not found, Fallback to MoviePy (Fully Automated)
    if not video_path:
        print("⚠️ Manual export not found. Switching to Fully Automated Engine (MoviePy) to ensure delivery...")
        
        from admin.engineers.tiktok_workflow import TikTokWorkflow
        
        # Post content
        post = {
            "title": "Building with Antigravity",
            "content": """
            We are building the future of AI coding interactions.
            Antigravity isn't just a name, it's a movement.
            We're creating a studio where ideas float freely into reality.
            Join us as we redefine what it means to build software.
            Coding is no longer about typing; it's about directing intelligence.
            Verify the system. Trust the process. Build the impossible.
            """,
            "url": "https://isaachernandez.com/building-with-antigravity",
            "slug": "building-with-antigravity-auto"
        }
        
        # Initialize Workflow with MoviePy engine
        workflow = TikTokWorkflow(template="educational", engine="moviepy")
        
        try:
            result = workflow.execute(post)
            if result.get("success"):
                video_path = result.get("video_path")
                print(f"✅ Generated fallback video: {video_path}")
            else:
                print("❌ Failed to generate fallback video.")
                return
        except Exception as e:
            logger.error(f"Fallback generation failed: {e}")
            return
            
    # 3. Upload to TikTok
    if video_path and os.path.exists(video_path):
        print(f"🚀 Uploading {video_path} to TikTok...")
        
        try:
            # We use Broadcaster's upload method or call uploader directly
            # Let's call uploader directly for clarity here, or instantiate Broadcaster
            from admin.engineers.broadcaster import Broadcaster
            broadcaster = Broadcaster()
            
            description = "Building the future with AI. #coding #ai #tech #startup #antigravity"
            
            # Since we are running headless potentially, ensure cookies path is correct
            # Broadcaster should handle it.
            
            success = broadcaster.upload_to_tiktok(video_path, description)
            
            if success:
                print("✅ SUCCESS: Video uploaded to TikTok!")
            else:
                print("❌ Upload failed.")
        except Exception as e:
             logger.error(f"Upload process failed: {e}")
             import traceback
             traceback.print_exc()

if __name__ == "__main__":
    auto_post_promo()
