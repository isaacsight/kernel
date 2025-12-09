
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from admin.engineers.socialite import Socialite

def finalize_distribution():
    filename = "content/ai-meet-your-ai-engineering-team.md"
    print(f"Reading {filename}...")
    
    with open(filename, 'r', encoding='utf-8') as f:
        raw_content = f.read()
        
    parts = raw_content.split('---', 2)
    if len(parts) >= 3:
        frontmatter = parts[1]
        body = parts[2].strip()
        
        meta = {}
        for line in frontmatter.split('\n'):
            if ':' in line:
                key, val = line.split(':', 1)
                meta[key.strip()] = val.strip()
        
        post_data = {
            'title': meta.get('title', 'Untitled'),
            'excerpt': meta.get('excerpt', ''),
            'content': body
        }
    else:
        post_data = {'title': 'AI Team Post', 'content': raw_content}

    socialite = Socialite()
    success = socialite.distribute_to_substack(post_data)
    
    if success:
        print("✅ Substack distribution completed.")
    else:
        print("❌ Substack distribution failed.")

if __name__ == "__main__":
    finalize_distribution()
