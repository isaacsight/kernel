
import os

# Mock content of build.py functions
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
            metadata[key.strip()] = value.strip()
            
    return metadata, body

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

TEMPLATE_DIR = 'templates'
CONTENT_DIR = 'content'

print("Reading template...")
post_template = read_file(os.path.join(TEMPLATE_DIR, 'post.html'))
print(f"Template length: {len(post_template)}")
print(f"Template contains {{{{ date }}}}: {'{{ date }}' in post_template}")

print("Reading director.md...")
content = read_file(os.path.join(CONTENT_DIR, 'systems/director.md'))
metadata, body = parse_frontmatter(content)
print(f"Metadata: {metadata}")

post = metadata.copy()
post['content'] = body # Simplified

post_html = post_template.replace('{{ title }}', post.get('title', 'Untitled'))
post_html = post_html.replace('{{ date }}', post.get('date', ''))

context_html = ""
if post.get('context'):
     context_html = f'<p class="context-note">{post.get("context")}</p>'
post_html = post_html.replace('{{ post_context }}', context_html)

print(f"Final HTML contains {{{{ date }}}}: {'{{ date }}' in post_html}")
print(f"Final HTML contains {{{{ post_context }}}}: {'{{ post_context }}' in post_html}")

if '{{ date }}' in post_html:
    print("FATAL: {{ date }} NOT REPLACED")
else:
    print("SUCCESS: {{ date }} Replaced")
    
if '{{ post_context }}' in post_html:
    print("FATAL: {{ post_context }} NOT REPLACED")
else:
    print("SUCCESS: {{ post_context }} Replaced")
