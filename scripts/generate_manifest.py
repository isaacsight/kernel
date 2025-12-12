import os
import json
import re

CONTENT_DIR = 'content'
OUTPUT_FILE = 'content/posts.json'

def parse_frontmatter(content):
    parts = content.split('---', 2)
    if len(parts) < 3:
        return {}, content
    
    frontmatter = parts[1].strip()
    body = parts[2].strip()
    
    metadata = {}
    for line in frontmatter.split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            metadata[key.strip()] = value.strip().strip('"').strip("'")
            
    return metadata, body

def main():
    posts = []
    print(f"Scanning {CONTENT_DIR}...")
    
    for filename in os.listdir(CONTENT_DIR):
        if not filename.endswith('.md') and not filename.endswith('.html'):
            continue
            
        filepath = os.path.join(CONTENT_DIR, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        metadata, _ = parse_frontmatter(content)
        
        # Enforce Schema
        if 'title' not in metadata: continue
        
        post_data = {
            "slug": metadata.get('slug', os.path.splitext(filename)[0]),
            "title": metadata.get('title'),
            "date": metadata.get('date'),
            "mode": metadata.get('mode', 'Essay'),
            "pillar": metadata.get('pillar', 'General'), # Default pillar if missing
            "canonical": metadata.get('canonical', 'false').lower() == 'true',
            "tldr": metadata.get('tldr', metadata.get('excerpt', '')),
            "connections": [c.strip() for c in metadata.get('connections', '').split(',') if c.strip()],
            "version": metadata.get('version', '1.0'),
            "updated": metadata.get('updated', metadata.get('date')),
            "tags": [t.strip() for t in metadata.get('tags', '').replace('[','').replace(']','').split(',') if t.strip()]
        }
        
        posts.append(post_data)
        
    # Sort by date desc
    posts.sort(key=lambda x: str(x.get('date', '0000-00-00')) if x.get('date') else '0000-00-00', reverse=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(posts, f, indent=2)
        
    print(f"Generated manifest with {len(posts)} posts at {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
