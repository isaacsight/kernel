import os
import sys
import frontmatter
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from admin.engineers.tiktok_workflow import create_tiktok_from_post

def run_pipeline():
    print("=== Launching TikTok Pipeline for Visual Upgrade ===")
    
    # 1. Load the specific post
    # Note: Using the filename we just generated
    filename = f"content/{datetime.now().strftime('%Y-%m-%d')}-visual-upgrade-ascii-animated.md"
    
    if not os.path.exists(filename):
        print(f"Error: Post not found at {filename}")
        # Try finding it without date if that failed (just in case)
        filename = "content/visual-upgrade-ascii-animated.md"
        if not os.path.exists(filename):
             print(f"Error: Post really not found at {filename}")
             return

    print(f"Loading post: {filename}")
    with open(filename, 'r') as f:
        post = frontmatter.load(f)
        
    post_data = {
        "title": post.get("title", "Visual Upgrade"),
        # Update slug to match the generated HTML filename format (date-slug)
        "slug": f"{datetime.now().strftime('%Y-%m-%d')}-visual-upgrade-ascii-animated",
        "content": post.content,
        "tags": post.get("tags", [])
    }
    
    # 2. Run the workflow
    print("\nRunning TikTokWorkflow...")
    try:
        # Using 'thought_leader' template for a more serious/educational vibe
        result = create_tiktok_from_post(post_data, template="thought_leader")
        
        print("\n=== Workflow Completed ===")
        if result.get('success'):
            print(f"✅ Video Path: {result.get('video_path')}")
            # The workflow attempts upload automatically if configured
        else:
            print(f"❌ Error: {result.get('error')}")
            
    except Exception as e:
        print(f"\n❌ Pipeline Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_pipeline()
