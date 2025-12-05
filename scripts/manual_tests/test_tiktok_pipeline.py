import os
import sys
import frontmatter
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from admin.engineers.tiktok_workflow import create_tiktok_from_post

def test_pipeline():
    print("=== Starting TikTok Pipeline Test ===")
    
    # 1. Load the post
    post_path = os.path.join("content", "fired-my-ai-team.md")
    if not os.path.exists(post_path):
        print(f"Error: Post not found at {post_path}")
        return

    print(f"Loading post: {post_path}")
    with open(post_path, 'r') as f:
        post = frontmatter.load(f)
        
    post_data = {
        "title": post.get("title"),
        "slug": "fired-my-ai-team", # Hardcoded for test
        "content": post.content,
        "tags": post.get("tags", [])
    }
    
    # 2. Run the workflow
    print("\nRunning TikTokWorkflow...")
    try:
        # Using 'auto' template selection
        result = create_tiktok_from_post(post_data, template="auto")
        
        print("\n=== Workflow Completed ===")
        print(f"Success: {result.get('success')}")
        print(f"Workflow ID: {result.get('workflow_id')}")
        print(f"Template Used: {result.get('template')}")
        
        if result.get('success'):
            print(f"Video Path: {result.get('video_path')}")
            print("\nSteps Summary:")
            for step in result.get('steps', []):
                status_icon = "✅" if step['status'] == 'completed' else "❌"
                print(f"{status_icon} {step['name']}: {step['status']}")
        else:
            print(f"Error: {result.get('error')}")
            print("\nSteps Summary:")
            for step in result.get('steps', []):
                status_icon = "✅" if step['status'] == 'completed' else "❌"
                print(f"{status_icon} {step['name']}: {step['status']}")
                if step.get('error'):
                    print(f"   Error: {step['error']}")

    except Exception as e:
        print(f"\n❌ Pipeline Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_pipeline()
