import os
import frontmatter
from admin.engineers.broadcaster import Broadcaster
import time

def broadcast_backlog():
    posts_to_broadcast = [
        "content/the-invisible-architect.md",
        "content/ai-the-future-of-autonomous-blogging.md",
        "content/ai-why-i-fired-myself-as-webmaster-(theme:-theme-1:-the-autonomous-web).md"
    ]

    broadcaster = Broadcaster()

    for post_path in posts_to_broadcast:
        if not os.path.exists(post_path):
            print(f"Post not found: {post_path}")
            continue

        print(f"Processing {post_path}...")
        with open(post_path, 'r') as f:
            post = frontmatter.load(f)

        # Manually add slug
        slug = os.path.splitext(os.path.basename(post_path))[0]
        post['slug'] = slug
        print(f"Title: {post.get('title')}")
        print(f"Slug: {slug}")

        # Generate Video
        print("Generating video...")
        video_path = broadcaster.generate_video(post)
        
        if video_path:
            print(f"Video generated at {video_path}")
            
            # Upload to TikTok
            print("Uploading to TikTok...")
            description = f"New post: {post.get('title')} #blog #ai #tech"
            broadcaster.upload_to_tiktok(video_path, description)
            
            print("Upload complete. Waiting 60s before next post...")
            time.sleep(60) # Wait to avoid spam detection
        else:
            print("Failed to generate video.")

if __name__ == "__main__":
    broadcast_backlog()
