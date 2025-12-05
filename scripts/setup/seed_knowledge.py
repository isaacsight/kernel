"""
Seed the Collective Intelligence with researched best practices.
This gives the AI team a "baseline" of knowledge derived from top creators.
"""

from admin.brain.collective_intelligence import get_collective_intelligence

def seed_knowledge():
    ci = get_collective_intelligence()
    
    print("🧠 Seeding Collective Intelligence with Best Practices...")
    
    # --- Universal Lessons (from Research) ---
    lessons = [
        {
            "agent": "Researcher",
            "lesson": "The first 3 seconds are critical. Use a visual or audio hook immediately.",
            "context": "tiktok viral_hook retention",
            "outcome": "positive"
        },
        {
            "agent": "Researcher",
            "lesson": "Kinetic typography (moving text) increases retention significantly compared to static slides.",
            "context": "tiktok visual_style typography",
            "outcome": "positive"
        },
        {
            "agent": "Researcher",
            "lesson": "Authenticity wins. overly polished 'corporate' content performs worse than raw, personal stories.",
            "context": "tiktok brand_voice authenticity",
            "outcome": "positive"
        },
        {
            "agent": "Researcher",
            "lesson": "Educational content must be concise. Avoid long intros. Get to the value immediately.",
            "context": "tiktok education pacing",
            "outcome": "positive"
        },
        {
            "agent": "Researcher",
            "lesson": "Trending audio can boost reach, but only if relevant to the niche.",
            "context": "tiktok audio trends",
            "outcome": "neutral"
        },
        {
            "agent": "Researcher",
            "lesson": "Engagement bait ('smash like') is detected and penalized by users and algorithms.",
            "context": "tiktok engagement_tactics avoidance",
            "outcome": "negative"
        }
    ]
    
    for l in lessons:
        ci.learn_lesson(l["agent"], l["lesson"], l["context"], l["outcome"])
        print(f"✅ Learned: {l['lesson'][:50]}...")

    # --- Shared Insights (Strategic) ---
    insights = [
        {
            "type": "content_strategy",
            "insight": "Top tech creators (e.g., Joe Karlsson) blend humor with technical depth.",
            "confidence": 0.9
        },
        {
            "type": "visual_trend",
            "insight": "Green screen effects are highly effective for code walkthroughs.",
            "confidence": 0.85
        }
    ]
    
    for i in insights:
        ci.share_insight("Researcher", i["type"], i, i["confidence"])
        print(f"💡 Insight: {i['insight'][:50]}...")

    print("\n✨ Knowledge injection complete.")

if __name__ == "__main__":
    seed_knowledge()
