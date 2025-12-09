import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.viral_coach import ViralCoach

def run_demo():
    print("🚀 Initializing Viral Coach Demo...\n")
    coach = ViralCoach()
    
    # Read the target content
    content_path = "content/viral-content-secrets.md"
    try:
        with open(content_path, "r") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: Could not find {content_path}")
        return

    print(f"📄 Analyzing: {content_path}\n")
    
    # Analyze the content
    analysis = coach.analyze_tiktok_script(content)
    
    print(f"⭐️ Viral Score: {analysis['overall_score']}/10")
    print(f"   - Hook Score: {analysis['hook_score']}")
    print(f"   - Retention Score: {analysis['retention_score']}")
    print(f"   - CTA Score: {analysis['cta_score']}")
    print(f"   - Trend Score: {analysis['trend_score']}")
    
    print("\n💡 Suggestions for Improvement:")
    for suggestion in analysis['suggestions']:
        print(f"   - {suggestion}")
        
    print("\n✨ Improved Hook Suggestion:")
    print(f"   \"{analysis['improved_hook']}\"")
    
    # Try to improve it automatically
    print("\n🤖 Attempting Auto-Improvement...")
    improved = coach.improve_script(content)
    
    if improved['improved']:
        print(f"   ✅ Score boosted to: {improved['improved_analysis']['overall_score']}/10")
    else:
        print("   Script is already optimized!")

if __name__ == "__main__":
    run_demo()
