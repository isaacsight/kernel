import sys
import os
import frontmatter
import logging

# Configure logging to see what's happening
logging.basicConfig(level=logging.INFO)

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.tiktok_workflow import create_tiktok_from_post
from admin.config import config

def run_tiktok_workflow():
    post_filename = "2025-12-05-engineering-progress-kokoro-tts-voice-of-ai.md"
    post_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "content", post_filename)
    
    if not os.path.exists(post_path):
        print(f"Error: Post not found at {post_path}")
        return

    print(f"Loading post from {post_path}")
    with open(post_path, 'r') as f:
        post = frontmatter.load(f)
        
    # Convert to dict and fix slug
    post_dict = post.metadata.copy()
    post_dict['content'] = post.content
    
    # Override slug to match the built HTML filename (which comes from the markdown filename)
    file_slug = os.path.splitext(post_filename)[0]
    print(f"Overriding slug '{post_dict.get('slug')}' with filename stem '{file_slug}'")
    post_dict['slug'] = file_slug
    
    print("Starting TikTok workflow...")
    try:
        # Use 'storytime' template
        result = create_tiktok_from_post(post_dict, template="storytime")
        
        if result["success"]:
            print(f"Success! Video uploaded. Workflow ID: {result['workflow_id']}")
            print(f"Video Path: {result['video_path']}")
        else:
            print(f"Workflow failed: {result.get('error')}")
            for step in result.get('steps', []):
                print(f"Step {step['name']}: {step['status']}")
                if step.get('error'):
                    print(f"  Error: {step['error']}")
            
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_tiktok_workflow()
