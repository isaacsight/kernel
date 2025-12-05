#!/usr/bin/env python3
"""
Test the enhanced TikTok content pipeline.

Usage:
    python3 test_tiktok_pipeline.py [slug]
    
    slug: Optional blog post slug to test with. Defaults to a sample post.
"""

import sys
import json
from admin.engineers.viral_coach import ViralCoach
from admin.engineers.content_repurposer import ContentRepurposer
from admin.engineers.tiktok_workflow import TikTokWorkflow

def test_pipeline(slug=None):
    """Tests the full TikTok pipeline."""
    
    print("=" * 60)
    print("🎬 TikTok Content Pipeline Test")
    print("=" * 60)
    
    # Sample post for testing
    if slug:
        import frontmatter
        with open(f"content/{slug}.md", 'r') as f:
            post = frontmatter.load(f)
            post = {
                "title": post.get("title", slug),
                "content": post.content,
                "slug": slug,
                "tags": post.get("tags", [])
            }
    else:
        post = {
            "title": "The Lost Art of Stillness",
            "slug": "the-lost-art-of-stillness",
            "content": """
            In a world increasingly defined by constant connectivity,
            we've lost something precious: the ability to simply be still.
            
            I used to fill every quiet moment with podcasts or scrolling.
            But then I tried 10 minutes of complete silence each morning.
            
            What I discovered surprised me. My best ideas came from
            the spaces in between, not from consuming more content.
            
            Now I protect that stillness like it's sacred. Because it is.
            """,
            "tags": ["mindfulness", "productivity"]
        }
    
    print(f"\n📄 Testing with: {post['title']}")
    print("-" * 60)
    
    # Step 1: Content Repurposer
    print("\n🔄 Step 1: Repurposing content...")
    repurposer = ContentRepurposer()
    repurposed = repurposer.repurpose(post, platforms=["tiktok"])
    tiktok_script = repurposed["outputs"]["tiktok"]["script"]
    print(f"✓ Generated TikTok script ({len(tiktok_script.split())} words)")
    print(f"   Preview: {tiktok_script[:100]}...")
    
    # Step 2: Viral Coach
    print("\n🏋️ Step 2: Viral Coach analysis...")
    coach = ViralCoach()
    analysis = coach.analyze_tiktok_script(tiktok_script)
    print(f"   Hook Score:      {analysis['hook_score']}/10")
    print(f"   Retention Score: {analysis['retention_score']}/10")
    print(f"   CTA Score:       {analysis['cta_score']}/10")
    print(f"   Overall:         {analysis['overall_score']}/10")
    
    if analysis['overall_score'] < 7:
        print("\n   📝 Suggestions:")
        for s in analysis['suggestions']:
            print(f"      • {s}")
        
        # Try to improve
        print("\n   🔧 Attempting improvement...")
        improved = coach.improve_script(tiktok_script)
        if improved.get("improved"):
            print(f"   ✓ Score improved: {analysis['overall_score']} → {improved['improved_analysis']['overall_score']}")
    
    # Step 3: Auto template selection
    print("\n📋 Step 3: Template selection...")
    recommended = TikTokWorkflow.auto_select_template(post)
    print(f"   Recommended template: {recommended}")
    print(f"   Template config: {json.dumps(TikTokWorkflow.TEMPLATES[recommended], indent=6)}")
    
    print("\n" + "=" * 60)
    print("✅ Pipeline test complete!")
    print("=" * 60)
    
    print("\n💡 To generate full video, run:")
    print(f"   python3 broadcast_single.py")
    
    return {
        "post": post,
        "script": tiktok_script,
        "analysis": analysis,
        "template": recommended
    }


if __name__ == "__main__":
    slug = sys.argv[1] if len(sys.argv) > 1 else None
    test_pipeline(slug)
