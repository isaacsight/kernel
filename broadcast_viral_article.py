#!/usr/bin/env python3
"""
Broadcast the viral-content-secrets article to TikTok.
"""

import os
import frontmatter
from admin.engineers.broadcaster import Broadcaster
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

def broadcast_article():
    slug = "viral-content-secrets"
    post_path = f"content/{slug}.md"
    
    if not os.path.exists(post_path):
        print(f"Post not found: {post_path}")
        return

    print(f"📄 Processing {post_path}...")
    with open(post_path, 'r') as f:
        post = frontmatter.load(f)

    post['slug'] = slug
    print(f"📝 Title: {post.get('title')}")

    broadcaster = Broadcaster()
    
    # Generate Video with AI Narration
    print("\n🎬 Generating video with AI Narration...")
    video_path = broadcaster.generate_video(post, vibe="chill")
    
    if video_path:
        print(f"✅ Video generated at {video_path}")
        
        # Upload to TikTok
        print("\n📱 Uploading to TikTok...")
        description = f"""🔥 The Secret Sauce Behind Viral Content

What I learned from studying $100M startups:
• 1→N Content Repurposing
• Viral Hook Patterns
• Pipeline Mindset

#contentcreation #viraltips #ai #automation #tiktokgrowth #fyp"""
        
        success = broadcaster.upload_to_tiktok(video_path, description)
        
        if success:
            print("🎉 Upload complete!")
        else:
            print("⚠️ Upload may have issues - check TikTok manually")
    else:
        print("❌ Failed to generate video.")

if __name__ == "__main__":
    broadcast_article()
