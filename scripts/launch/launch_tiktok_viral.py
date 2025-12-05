import sys
import os
import json

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from admin.engineers.tiktok_workflow import TikTokWorkflow

def main():
    print("🚀 Launching TikTok Automation for 'Viral Content Secrets'...")
    
    # 1. Define the Post
    post = {
        "title": "The Secret Sauce Behind Viral Content",
        "slug": "viral-content-secrets",
        "category": "Tech",
        "tags": ["ai", "automation", "content-creation", "tiktok"],
        "content": """
I spent the last few hours studying how multi-million dollar startups like n8n and Blotato approach content creation.

What I found changed everything about how I think about posting content online.

## The 1→N Principle

Stop creating content. Start **repurposing** content.

One blog post should become:
- A TikTok video
- An Instagram carousel
- A Twitter thread
- A LinkedIn post
- A YouTube Short

The effort goes into the **thinking**, not the reformatting.

## Viral Hooks Are a Science

Turns out there are patterns. Successful hooks usually fall into five categories:

1. **Controversy** - "Nobody talks about this, but..."
2. **Curiosity** - "What if I told you..."
3. **Shock** - "This changed everything..."
4. **Story** - "So this happened..."
5. **Listicle** - "3 things you need to know..."

Pick one. Stick to it. Test which works for your audience.

## The Pipeline Mindset

The creators winning right now aren't working harder—they're working smarter.

They have **systems**:
- Analyze content for viral potential
- Score hooks before posting
- Automate the boring stuff
- Iterate based on data

## What I Built

I took these lessons and built my own content pipeline:
- A **Viral Coach** that scores my scripts before I post
- A **Content Repurposer** that turns one article into five formats
- **Workflow Templates** for different content styles

The result? 10x the content output. Same time investment.
        """
    }

    # 2. Select Template
    template = TikTokWorkflow.auto_select_template(post)
    print(f"📋 Auto-selected Template: {template}")
    
    # 3. Initialize Workflow
    workflow = TikTokWorkflow(template)
    
    # 4. Execute
    try:
        result = workflow.execute(post)
        
        print("\n✅ Workflow Execution Complete!")
        print(f"Success: {result['success']}")
        
        if result['success']:
            print(f"Video Path: {result['video_path']}")
            print(f"Viral Score: {result.get('viral_score')}")
        else:
            print(f"Error: {result.get('error')}")
            
        # Log steps
        print("\n--- Steps Summary ---")
        for step in result['steps']:
            status_icon = "✅" if step['status'] == 'completed' else "❌"
            print(f"{status_icon} {step['name']}: {step['status']} ({step['duration_ms']}ms)")
            if step.get('error'):
                print(f"   Error: {step['error']}")
                
    except Exception as e:
        print(f"\n❌ Critical Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
