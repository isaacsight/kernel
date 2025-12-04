import os
import frontmatter
from admin.engineers.broadcaster import Broadcaster

def test_broadcast():
    post_path = "/Users/isaachernandez/blog design/content/the-engine-and-the-gallery.md"
    
    if not os.path.exists(post_path):
        print(f"Post not found: {post_path}")
        return

    print(f"Loading post: {post_path}")
    with open(post_path, 'r') as f:
        post = frontmatter.load(f)
        
    print(f"Title: {post.get('title')}")
    # Manually add slug since it's not in frontmatter usually
    post['slug'] = os.path.splitext(os.path.basename(post_path))[0]
    
    broadcaster = Broadcaster()
    
    print("Generating video...")
    video_path = broadcaster.generate_video(post)
    
    if video_path:
        print(f"Video generated: {video_path}")
        
        print("Starting upload automatically...")
        try:
            success = broadcaster.upload_to_tiktok(video_path, description=f"New post: {post.get('title')} #blog")
            if success:
                print("✅ Upload successful!")
            else:
                print("❌ Upload failed.")
        except Exception as e:
            print(f"❌ Exception during upload: {e}")
    else:
        print("❌ Video generation failed.")

if __name__ == "__main__":
    test_broadcast()
