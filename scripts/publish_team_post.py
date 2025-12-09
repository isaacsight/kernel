
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from admin.core import generate_ai_post
from admin.engineers.socialite import Socialite
from build import build

def publish_team_post():
    print("🚀 Starting AI Team Post Publication Workflow...")
    
    # 1. Generate Post
    topic = "Meet Your AI Engineering Team"
    print(f"\n📝 Step 1: Generating Post '{topic}'...")
    try:
        # prompt the Alchemist to be comprehensive
        # We can't easily modify the prompt passed to generate_ai_post without finding where 'topic' goes.
        # But 'topic' is used.
        # Let's trust the Alchemist's context.
        # Actually, let's provide a slightly more descriptive topic or context if possible.
        # looking at core.py, generate_ai_post takes (topic, provider).
        # alchemist.generate takes (topic, doctrine).
        # The Alchemist has memory, but maybe I should ensure it knows about the team roster?
        # The user provided team_roster.md. I should probably ensure that info is in the prompt.
        # But generate_ai_post is a high level wrapper.
        # Let's just try with the title first.
        
        saved_filename = generate_ai_post(topic)
        print(f"✅ Post generated and saved: {saved_filename}")
        
    except Exception as e:
        print(f"❌ Generation failed: {e}")
        return

    # 2. Build Site (Update RSS)
    print("\n🏗️ Step 2: Rebuilding Site to Update RSS Feed...")
    try:
        build()
        print("✅ Site built and RSS feed updated.")
    except Exception as e:
        print(f"❌ Build failed: {e}")
        return

    # 3. Distribute to Substack
    print("\n📨 Step 3: Distributing to Substack...")
    try:
        # Read the generated file to get content
        # saved_filename is relative or absolute? core.py says: 
        # filename = f"ai-{topic.lower().replace(' ', '-')}.md"
        # saved_filename = save_post(filename, ...) -> returns full path usually?
        # Let's assume it returns the path.
        
        # Actually save_post in core.py probably returns what we need.
        # Let's verify save_post return value if needed, but standard practice is path.
        
        if not os.path.exists(saved_filename):
             # Try content/
             possible_path = os.path.join('content', saved_filename)
             if os.path.exists(possible_path):
                 saved_filename = possible_path
                 
        with open(saved_filename, 'r', encoding='utf-8') as f:
            raw_content = f.read()
            
        # Parse frontmatter to separate title/excerpt/body if possible, 
        # or just pass raw content. Socialite expects a dict.
        # We'll use a simple split for now or similar logic to build.py
        
        parts = raw_content.split('---', 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            body = parts[2].strip()
            
            # Extract simple metadata
            meta = {}
            for line in frontmatter.split('\n'):
                if ':' in line:
                    key, val = line.split(':', 1)
                    meta[key.strip()] = val.strip()
            
            post_data = {
                'title': meta.get('title', topic),
                'excerpt': meta.get('excerpt', ''),
                'content': body
            }
        else:
            post_data = {
                'title': topic,
                'content': raw_content
            }

        socialite = Socialite()
        success = socialite.distribute_to_substack(post_data)
        
        if success:
            print("✅ Substack distribution completed (Staged or Posted).")
        else:
            print("❌ Substack distribution failed.")
            
    except Exception as e:
        print(f"❌ Distribution failed: {e}")

if __name__ == "__main__":
    publish_team_post()
