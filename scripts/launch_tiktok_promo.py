
import sys
import os
import json

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from admin.engineers.tiktok_workflow import create_tiktok_from_post, TikTokWorkflow

def main():
    print("🚀 Launching TikTok Promo Generator...")
    
    # Define the post manually to ensure clean input
    post = {
        "title": "Studio OS: An AI-First Operating System",
        "slug": "studio-os",
        "content": """
        Studio OS is an experiment in "personal enterprise software". 
        It is a distributed operating system designed to orchestrate a team of autonomous AI agents to assist with creative work.
        
        The system runs on a distributed hybrid-cloud architecture:
        1. The Control Plane (MacBook Air) - A React-based "Mission Control".
        2. The Compute Plane (Studio Node) - Dual NVIDIA 3090s running Qwen 2.5 72B.
        
        Key Components:
        - The Alchemist: Creative generation.
        - The Editor: Style enforcement.
        - The Visionary: Image generation.
        
        Most AI tools force you to work in them. Studio OS works for you.
        """,
        "tags": ["ai", "coding", "tech", "studio"]
    }
    
    print(f"📄 Post: {post['title']}")
    
    # Execute Workflow
    # We use 'tech' or 'educational' template, or auto
    template = "thought_leader" # Seems appropriate for "Studio OS"
    print(f"🎬 Template: {template}")
    
    result = create_tiktok_from_post(post, template=template)
    
    print("\n" + "="*50)
    print("✅ WORKFLOW EXECUTION COMPLETE")
    print("="*50)
    
    if result.get("status") == "paused_for_export":
        print("\n⚠️  MANUAL STEP REQUIRED")
        print(f"👉 Draft ID: {result.get('draft_id')}")
        print("1. Open CapCut Desktop")
        print("2. Verify the new draft (Captions, Audio, etc.)")
        print("3. File -> Export -> Name it 'studio-os.mp4'")
        print(f"4. Save to: {os.path.abspath(os.path.join(os.path.dirname(__file__), '../static/videos'))}")
        print("\nThen run: python scripts/deploy_tiktok.py")
    else:
         print(f"Result: {json.dumps(result, indent=2)}")

if __name__ == "__main__":
    main()
