import os
import frontmatter
from admin.engineers.broadcaster import Broadcaster
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

def test_voiceover(slug):
    post_path = f"content/{slug}.md"
    if not os.path.exists(post_path):
        print(f"Post not found: {post_path}")
        return

    print(f"Processing {post_path}...")
    with open(post_path, 'r') as f:
        post = frontmatter.load(f)

    post['slug'] = slug
    print(f"Title: {post.get('title')}")
    print(f"Content (first 200 chars): {post.content[:200]}...")

    broadcaster = Broadcaster()
    
    # Test just the voiceover generation
    print("\nGenerating voiceover...")
    audio_path, vtt_path = broadcaster.generate_voiceover(post, vibe="tech")
    
    if audio_path and os.path.exists(audio_path):
        print(f"SUCCESS! Audio at: {audio_path}")
    else:
        print(f"FAILED! No audio generated.")
        
    if vtt_path and os.path.exists(vtt_path):
        print(f"SUCCESS! VTT at: {vtt_path}")
    else:
        print(f"FAILED! No VTT generated.")

if __name__ == "__main__":
    test_voiceover("the-rise-of-the-non-musician")
