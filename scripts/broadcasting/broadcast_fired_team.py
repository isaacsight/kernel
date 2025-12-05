#!/usr/bin/env python3
"""
Broadcast the 'I Fired My AI Team' article to TikTok.
"""

import os
import frontmatter
from admin.engineers.tiktok_workflow import create_tiktok_from_post
from admin.engineers.broadcaster import Broadcaster
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

def broadcast_article():
    slug = "fired-my-ai-team"
    post_path = f"content/{slug}.md"
    
    if not os.path.exists(post_path):
        print(f"❌ Post not found: {post_path}")
        return

    print(f"📄 Processing {post_path}...")
    with open(post_path, 'r') as f:
        post = frontmatter.load(f)
        post_data = {
            "title": post.get("title"),
            "content": post.content,
            "slug": slug,
            "tags": post.get("tags", [])
        }

    print(f"📝 Title: {post_data['title']}")

    # Use the new Workflow (which includes Creative Director review)
    print("\n🎬 Running TikTok Workflow (with Creative Director Review)...")
    try:
        result = create_tiktok_from_post(post_data, template="auto")
        
        if result["success"]:
            video_path = result["video_path"]
            print(f"✅ Video generated at {video_path}")
            print(f"   Viral Score: {result.get('viral_score')}")
            
            # Upload to TikTok
            print("\n📱 Uploading to TikTok...")
            broadcaster = Broadcaster()
            
            # Sanitized description
            description = f"""I Fired My AI Social Media Team

Why I audited my AI agents and installed a boss:
- No more robotic voices
- No more engagement bait
- Real creative leadership

#ai #automation #buildinginpublic #tech #socialmedia"""
            
            success = broadcaster.upload_to_tiktok(video_path, description)
            
            if success:
                print("🎉 Upload complete!")
            else:
                print("⚠️ Upload reported failure (check TikTok manually)")
                
        else:
            print(f"❌ Workflow failed: {result.get('error')}")
            
    except Exception as e:
        print(f"❌ Script failed: {e}")

if __name__ == "__main__":
    broadcast_article()
