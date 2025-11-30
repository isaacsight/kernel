import os
import re

CONTENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../content'))

def clean_posts():
    count = 0
    for filename in os.listdir(CONTENT_DIR):
        if not filename.endswith('.md'):
            continue
            
        filepath = os.path.join(CONTENT_DIR, filename)
        with open(filepath, 'r') as f:
            content = f.read()
            
        # 1. Fix Title in Frontmatter
        # Matches: title: 'AI Generated: Some Title (Theme: ...)'
        # We want: title: 'Some Title'
        
        new_content = content
        
        # Regex for Frontmatter Title
        # Look for title: 'AI Generated: ...' or title: AI Generated: ...
        # Also remove (Theme: ...) suffix
        
        def title_replacer(match):
            full_title = match.group(1)
            # Remove "AI Generated: "
            clean = re.sub(r'^AI Generated:\s*', '', full_title, flags=re.IGNORECASE)
            # Remove "(Theme: ...)"
            clean = re.sub(r'\s*\(Theme:.*?\)', '', clean)
            return f"title: '{clean}'"

        new_content = re.sub(r"title:\s*['\"]?(.*?)['\"]?$", title_replacer, new_content, flags=re.MULTILINE)

        # 2. Fix H1 in Markdown body
        # Matches: # AI Generated: Some Title (Theme: ...)
        def h1_replacer(match):
            full_h1 = match.group(1)
            clean = re.sub(r'^AI Generated:\s*', '', full_h1, flags=re.IGNORECASE)
            clean = re.sub(r'\s*\(Theme:.*?\)', '', clean)
            return f"# {clean}"
            
        new_content = re.sub(r"^#\s+(.*)$", h1_replacer, new_content, flags=re.MULTILINE)

        if new_content != content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Cleaned: {filename}")
            count += 1

    print(f"Total files cleaned: {count}")

if __name__ == "__main__":
    clean_posts()
