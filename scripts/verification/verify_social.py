from admin.engineers.social_engine import get_social_engine
import json

def verify_social():
    engine = get_social_engine()
    
    # 1. Check Personas
    personas = engine.get_personas()
    assert "The Visionary" in personas
    print("✅ Personas loaded")
    
    # 2. Generate Post
    print("Triggering post generation...")
    post = engine.generate_post_from_event(
        "system_verification", 
        "Running deep diagnostic of social circuits.",
        "The Architect"
    )
    print(f"Generated post: {post['content']}")
    
    # 3. Check Feed
    feed = engine.get_feed()
    assert len(feed) > 0
    assert feed[0]['id'] == post['id']
    print(f"✅ Feed contains {len(feed)} posts. Latest verified.")
    
if __name__ == "__main__":
    verify_social()
