import sys
import os
import frontmatter
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.tiktok_workflow import create_tiktok_from_post

def run():
    post_filename = "ai-the-lost-art-of-deep-reading-(theme:-theme-2:-digital-philosophy-&-ethics).md"
    post_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "content", post_filename)
    
    print(f"Loading post from {post_path}")
    with open(post_path, 'r') as f:
        post = frontmatter.load(f)
        
    post_dict = post.metadata.copy()
    post_dict['content'] = post.content
    # Slug must match the HTML filename exactly for screenshot capture
    post_dict['slug'] = "ai-the-lost-art-of-deep-reading-(theme:-theme-2:-digital-philosophy-&-ethics)"
    
    print("Starting Production TikTok workflow (Storytime / British Voice)...")
    
    # Storytime template triggers British voice (bf_isabella) via our fix
    result = create_tiktok_from_post(post_dict, template="storytime")
    
    if result["success"]:
        print(f"SUCCESS: Video generated at {result['video_path']}")
    else:
        print(f"FAILURE: {result.get('error')}")

if __name__ == "__main__":
    run()
