"""
Final System Test - End-to-End Verification

Tests the complete "Self-Evolving, Trend-Aware Creative Studio" pipeline.
1. Trend Awareness: Uses a post about "AI Agents" to trigger TrendScout.
2. Viral Coaching: Optimizes the script based on trends.
3. Creative Director: Reviews for brand alignment.
4. Voice Upgrade: Uses VoiceActor (fallback to edge-tts).
5. Visual Overhaul: Generates Kinetic Typography.
"""
import json
import os
from admin.engineers.tiktok_workflow import create_tiktok_from_post

def run_final_test():
    print("🚀 Starting Final System Test...")
    
    # 1. Create a "Trendy" Post
    post = {
        "title": "Why AI Agents Are The Future",
        "slug": "ai-agents-future",
        "content": """
        Stop coding manually. The era of AI Agents is here.
        
        I just built a fully autonomous team that writes code, designs graphics, and even critiques its own work.
        It's not just a tool anymore; it's a workforce.
        
        If you're still writing every line of code yourself, you're falling behind.
        The future isn't about syntax; it's about orchestration.
        
        Are you ready to become an architect instead of a bricklayer?
        """,
        "tags": ["ai", "coding", "future"]
    }
    
    print(f"📄 Processing Post: {post['title']}")
    
    # 2. Run the Workflow
    # "auto" should select "viral_hook" or "educational" based on content
    result = create_tiktok_from_post(post, template="auto")
    
    # 3. Report Results
    print("\n" + "="*60)
    print("🎉 Workflow Complete!")
    print("="*60)
    
    if result["success"]:
        print(f"✅ Video Generated: {result['video_path']}")
        print(f"📈 Viral Score: {result['viral_score']}/10")
        
        # Print Steps Summary
        print("\n🔍 Execution Steps:")
        for step in result["steps"]:
            status_icon = "✅" if step["status"] == "completed" else "❌"
            print(f"   {status_icon} {step['name']} ({step['duration_ms']}ms)")
            
            # Show specific details for key steps
            if step["name"] == "coach":
                analysis = step["output_data"].get("analysis", {})
                print(f"      • Trend Score: {analysis.get('trend_score', 'N/A')}")
                print(f"      • Improvements: {step['output_data'].get('improvements_made')}")
            
            if step["name"] == "generate":
                print(f"      • Voice: {step['output_data'].get('voice')}")
                print(f"      • Vibe: {step['output_data'].get('vibe')}")

    else:
        print(f"❌ Workflow Failed: {result.get('error')}")
        if "steps" in result:
            failed_step = result["steps"][-1]
            print(f"   Failed at step: {failed_step['name']}")
            print(f"   Error: {failed_step.get('error')}")

if __name__ == "__main__":
    run_final_test()
