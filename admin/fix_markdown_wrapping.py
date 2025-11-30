import os
import re

CONTENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../content'))

def fix_markdown_wrapping():
    count = 0
    for filename in os.listdir(CONTENT_DIR):
        if not filename.endswith('.md'):
            continue
            
        filepath = os.path.join(CONTENT_DIR, filename)
        with open(filepath, 'r') as f:
            content = f.read()
            
        # Check for markdown wrapper
        # Usually looks like:
        # ---
        # frontmatter
        # ---
        # 
        # ```markdown
        # # Title
        # ...
        # ```
        
        # We want to remove the ```markdown line and the closing ``` line
        # But preserve frontmatter.
        
        parts = content.split('---', 2)
        if len(parts) < 3:
            continue # No frontmatter, skip or handle differently
            
        frontmatter = parts[1]
        body = parts[2]
        
        original_body = body
        
        # Remove leading ```markdown or ```
        body = re.sub(r'^\s*```(?:markdown)?\s*\n', '', body, flags=re.MULTILINE)
        
        # Remove trailing ```
        body = re.sub(r'\n\s*```\s*$', '', body, flags=re.MULTILINE)
        
        if body != original_body:
            new_content = f"---{frontmatter}---{body}"
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Fixed: {filename}")
            count += 1

    print(f"Total files fixed: {count}")

if __name__ == "__main__":
    fix_markdown_wrapping()
