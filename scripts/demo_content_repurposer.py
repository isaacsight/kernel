import sys
import os
import json

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.content_repurposer import ContentRepurposer

def run_demo():
    print("🚀 Initializing Content Repurposer Demo...\n")
    repurposer = ContentRepurposer()
    
    # Read the content
    content_path = "content/viral-content-secrets.md"
    try:
        with open(content_path, "r") as f:
            full_content = f.read()
    except FileNotFoundError:
        print(f"Error: Could not find {content_path}")
        return

    # Extract title and body (simple parsing)
    lines = full_content.splitlines()
    title = "Viral Content Strategy"
    body = full_content
    for line in lines:
        if line.startswith("title:"):
            title = line.replace("title:", "").strip().strip('"')
            break
            
    # Strip frontmatter
    if full_content.strip().startswith("---"):
        try:
            parts = full_content.split("---", 2)
            if len(parts) >= 3:
                body = parts[2].strip()
        except:
            pass

    print(f"📄 Processing: '{title}'\n")
    
    post = {
        "title": title,
        "content": body,
        "tags": ["content-creation", "marketing", "growth"]
    }
    
    # Run Repurposer
    print("🔄 Generating content for TikTok, Instagram, Twitter, and LinkedIn...\n")
    result = repurposer.repurpose(post)
    
    # Display Results
    for platform, content in result["outputs"].items():
        print(f"\n📱 Platform: {platform.upper()}")
        print("-" * 50)
        
        if platform == "tiktok":
            print(f"Hook: {content['hook']}")
            print(f"Script Preview:\n{content['script'][:200]}...")
        elif platform == "twitter":
            print(f"Thread Start: {content['tweets'][0]}")
            print(f"Total Tweets: {len(content['tweets'])}")
        elif platform == "instagram":
            print(f"Slide 1 (Hook): {content['slides'][0]['headline']}")
            print(f"Slide Count: {len(content['slides'])}")
        elif platform == "linkedin":
            print(f"Post Preview:\n{content['post'][:200]}...")
            
    print("\n✅ Demo Complete! 1 Article → 5+ Assets generated.")

if __name__ == "__main__":
    run_demo()
