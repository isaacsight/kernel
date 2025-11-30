import os
import time
import re
from core import generate_ai_post

def main():
    titles_file = os.path.join(os.path.dirname(__file__), 'proposed_titles.txt')
    
    if not os.path.exists(titles_file):
        print(f"Error: {titles_file} not found.")
        return

    with open(titles_file, 'r') as f:
        lines = f.readlines()

    # Filter and clean titles
    titles = []
    current_theme = "General"
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if line.startswith('#'):
            current_theme = line.lstrip('#').strip()
            continue
            
        # Remove numbering (e.g., "1. Title" -> "Title")
        clean_title = re.sub(r'^\d+\.\s*', '', line)
        if clean_title:
            titles.append((clean_title, current_theme))

    print(f"Found {len(titles)} titles to generate.")
    
    success_count = 0
    fail_count = 0

    for i, (title, theme) in enumerate(titles):
        print(f"[{i+1}/{len(titles)}] Generating: {title} ({theme})...")
        try:
            # We pass the theme as context/category if possible, but generate_ai_post 
            # currently just takes topic. We'll append theme to topic for better context.
            # actually generate_ai_post signature is (topic, provider="gemini")
            # It saves with category "AI". We might want to modify core.py later to accept category,
            # but for now let's just generate.
            
            filename = generate_ai_post(f"{title} (Theme: {theme})", provider="gemini")
            print(f"  -> Saved to {filename}")
            success_count += 1
            
            # Rate limiting
            time.sleep(2) 
            
        except Exception as e:
            print(f"  -> FAILED: {e}")
            fail_count += 1
            time.sleep(5) # Wait a bit longer on error

    print(f"\nDone! Success: {success_count}, Failed: {fail_count}")

if __name__ == "__main__":
    main()
