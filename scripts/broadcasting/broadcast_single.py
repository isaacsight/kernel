import os
import frontmatter
from admin.engineers.broadcaster import Broadcaster
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

def broadcast_post(slug):
    post_path = f"content/{slug}.md"
    if not os.path.exists(post_path):
        print(f"Post not found: {post_path}")
        return

    print(f"Processing {post_path}...")
    with open(post_path, 'r') as f:
        post = frontmatter.load(f)

    post['slug'] = slug
    print(f"Title: {post.get('title')}")

    broadcaster = Broadcaster()
    
    # Generate Video with AI Narration (implicit in generate_video now)
    print("Generating video with AI Narration...")
    # Using 'tech' vibe for this one
    video_path = broadcaster.generate_video(post, vibe="tech")
    
    if video_path:
        print(f"Video generated at {video_path}")
        
        # Upload to TikTok
        print("Uploading to TikTok...")
        description = f"New post: {post.get('title')} #blog #ai #tech #storytime"
        broadcaster.upload_to_tiktok(video_path, description)
        print("Upload complete.")
    else:
        print("Failed to generate video.")

if __name__ == "__main__":
    broadcast_post("the-speed-of-thought")
