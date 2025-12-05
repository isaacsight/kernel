import os
import frontmatter
import sys

CONTENT_DIR = os.path.abspath(os.path.join(os.getcwd(), 'content'))

print(f"Checking files in {CONTENT_DIR}...")

for filename in os.listdir(CONTENT_DIR):
    if filename.endswith('.md'):
        filepath = os.path.join(CONTENT_DIR, filename)
        try:
            with open(filepath, 'r') as f:
                frontmatter.load(f)
            # print(f"OK: {filename}")
        except Exception as e:
            print(f"ERROR in {filename}: {e}")
