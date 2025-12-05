#!/usr/bin/env python3
"""
Uploads the generated video to TikTok and provides a critique using ViralCoach.
"""

import os
import sys
import frontmatter
from admin.engineers.broadcaster import Broadcaster
from admin.engineers.viral_coach import ViralCoach
from admin.engineers.content_repurposer import ContentRepurposer
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

def upload_and_critique():
    slug = "viral-content-secrets"
    post_path = f"content/{slug}.md"
    video_path = "static/videos/the-secret-sauce-behind-viral-content-what-i-learn.mp4"
    
    if not os.path.exists(post_path):
        print(f"❌ Post not found: {post_path}")
        return

    if not os.path.exists(video_path):
        print(f"❌ Video not found: {video_path}")
        return

    print(f"📄 Processing {post_path}...")
    with open(post_path, 'r') as f:
        post = frontmatter.load(f)
    
    # 1. Upload to TikTok
    print("\n📱 Uploading to TikTok...")
    broadcaster = Broadcaster()
    
    # Simplified description to avoid emoji issues with ChromeDriver
    description = f"""The Secret Sauce Behind Viral Content

What I learned from studying $100M startups:
- 1-N Content Repurposing
- Viral Hook Patterns
- Pipeline Mindset

#contentcreation #viraltips #ai #automation #tiktokgrowth #fyp"""
    
    # Attempt upload
    try:
        success = broadcaster.upload_to_tiktok(video_path, description)
        if success:
            print("✅ Upload complete!")
        else:
            print("⚠️ Upload reported failure (check TikTok manually)")
    except Exception as e:
        print(f"❌ Upload failed: {e}")

    # 2. Critique Content
    print("\n🧐 Critiquing Video Content...")
    
    # Re-generate the script that was likely used (since we don't have it saved separately)
    # We use the ContentRepurposer to get the TikTok script from the post
    repurposer = ContentRepurposer()
    repurposed = repurposer.repurpose(post, platforms=["tiktok"])
    script = repurposed["outputs"]["tiktok"]["script"]
    
    coach = ViralCoach()
    analysis = coach.analyze_tiktok_script(script)
    
    print("\n📊 Viral Coach Analysis:")
    print(f"   • Hook Score:      {analysis['hook_score']}/10")
    print(f"   • Retention Score: {analysis['retention_score']}/10")
    print(f"   • CTA Score:       {analysis['cta_score']}/10")
    print(f"   • Overall Score:   {analysis['overall_score']}/10")
    
    print("\n💡 Strengths:")
    if analysis['hook_score'] > 7:
        print("   • Strong hook that grabs attention")
    if analysis['retention_score'] > 7:
        print("   • Good pacing for retention")
    if analysis['cta_score'] > 7:
        print("   • Clear Call-to-Action")
        
    print("\n🔧 Areas for Improvement:")
    for suggestion in analysis['suggestions']:
        print(f"   • {suggestion}")
        
    # 3. Technical Critique
    print("\n⚙️ Technical Stats:")
    file_size = os.path.getsize(video_path) / (1024 * 1024)
    print(f"   • File Size: {file_size:.2f} MB")
    
    # Check duration using moviepy (since we have it)
    try:
        from moviepy import VideoFileClip
        clip = VideoFileClip(video_path)
        duration = clip.duration
        print(f"   • Duration: {duration:.1f} seconds")
        
        if duration < 15:
            print("   ⚠️ Video might be too short for this type of content")
        elif duration > 60:
            print("   ⚠️ Video is over 60s - ensure it holds attention")
        else:
            print("   ✅ Optimal duration (15-60s)")
            
        clip.close()
    except Exception as e:
        print(f"   ⚠️ Could not analyze video duration: {e}")

if __name__ == "__main__":
    upload_and_critique()
