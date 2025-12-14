
import os
import sys

# Add project root to path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(project_root)

from admin.engineers.socialite import Socialite

def finalize_distribution():
    # Target the new Self-Evolving Studio Devlog
    post_path = os.path.join(project_root, "content", "2025-12-13-the-death-of-coding.md")
    import markdown
    
    with open(post_path, 'r', encoding='utf-8') as f:
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
        
        # Convert markdown body to HTML
        html_content = markdown.markdown(body)
        
        post_data = {
            'title': meta.get('title', 'Untitled'),
            'subtitle': meta.get('subtitle', ''),
            'excerpt': meta.get('excerpt', ''),
            'content': html_content
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
