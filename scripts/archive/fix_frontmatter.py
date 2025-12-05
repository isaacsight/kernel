import os
import re

CONTENT_DIR = 'content'

def fix_file(filename):
    filepath = os.path.join(CONTENT_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Fix 1: Broken multi-line titles with "Theme:"
    # Look for title: '... (Theme: \n  Theme ...)'
    # We want to join them and maybe remove the inner colons or quote properly
    
    # Regex to find the broken title block
    # It looks like: title: '... (Theme:\n  Theme ...)'
    pattern = r"(title: '.*\(Theme:)\n\s+(Theme.*)'"
    
    match = re.search(pattern, content)
    if match:
        # Join the parts
        part1 = match.group(1)
        part2 = match.group(2)
        full_title = f"{part1} {part2}'"
        # Replace in content
        content = content.replace(match.group(0), full_title)
        print(f"Fixed multi-line title in {filename}")

    # Fix 2: Unescaped quotes in title (if any remain)
    # This is harder to regex safely without breaking other things, 
    # but let's look for title: '... ' ...'
    
    with open(filepath, 'w') as f:
        f.write(content)

for filename in os.listdir(CONTENT_DIR):
    if filename.endswith('.md') and filename.startswith('ai-'):
        fix_file(filename)
