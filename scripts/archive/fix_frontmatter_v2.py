import os
import re

CONTENT_DIR = 'content'

def fix_file(filename):
    filepath = os.path.join(CONTENT_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content

    # Fix 1: Broken multi-line titles with "Theme:"
    # Pattern: title: '... (Theme: Theme\n  N: ...)'
    # We want to match the whole block and replace it with a single line.
    # Note: The indentation might vary, so \s+ is good.
    
    def join_title(match):
        full_text = match.group(0)
        # Replace newlines and extra spaces with a single space
        fixed_text = re.sub(r"'\n\s+", "' ", full_text) # If quote is at end of line? No, quote is at end of value.
        # The split is usually: ... (Theme: Theme\n  N: ...)'
        # So we just want to remove \n and the following indentation.
        fixed_text = re.sub(r"\n\s+", " ", full_text)
        return fixed_text

    pattern_title = r"title: '.*\(Theme: Theme\n\s+\d+: .*\)'"
    content = re.sub(pattern_title, join_title, content)

    # Fix 2: Separator missing newline
    # Pattern: ---##
    content = content.replace('---##', '---\n\n##')

    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed {filename}")

for filename in os.listdir(CONTENT_DIR):
    if filename.endswith('.md') and filename.startswith('ai-'):
        fix_file(filename)
