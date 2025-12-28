
import os
import sys

# Ensure we can import from admin
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")

from admin.engineers.socialite import Socialite

def distribute():
    socialite = Socialite()
    
    # Manually specify the file we just created
    file_path = "content/frontier-notes-v1.md"
    
    print(f"Preparing Substack distribution for: {file_path}")
    
    # We can pass the file path directly if we modify Socialite or just 
    # Mock the 'post' object that Socialite expects if it expects an object, 
    # but based on previous code (which I can't see fully right now, let me check socialite usage)
    # The previous script `finalize_substack_dist.py` did:
    # post = { 'title': ..., 'content': ... }
    # Let's read the file and construct that dict.
    
    with open(file_path, "r") as f:
        raw_content = f.read()
        
    # extract frontmatter (simple split)
    parts = raw_content.split("---")
    frontmatter = parts[1]
    body = "---".join(parts[2:]).strip()
    
    # Parse title/subtitle from frontmatter
    title = "Building the Machine" # Fallback
    subtitle = "Teaching the AI to publish itself." # Fallback
    
    for line in frontmatter.split("\n"):
        if line.startswith("title:"):
            title = line.replace("title:", "").strip()
        if line.startswith("subtitle:"):
            subtitle = line.replace("subtitle:", "").strip()
            
    # Socialite expects an object-like thing or dict?
    # Let's check `socialite.py` signature. 
    # It takes `post_obj` which needs `.title`, `.subtitle`, `.content` (HTML or markdown?)
    # The `distribute_to_substack` method converts markdown to HTML internally if needed?
    # Wait, looking at `socialite.py` in my memory, it takes `post` object.
    # It accesses `post.title`, `post.subtitle`, `post.content`.
    
    print(f"DEBUG: Parsed Subtitle: '{subtitle}'")
    
    import markdown
    html_content = markdown.markdown(body)
    
    post = {
        "title": title,
        "subtitle": subtitle,
        "content": html_content
    }
    
    # Socialite expects a dict (uses .get())
    socialite.distribute_to_substack(post)

if __name__ == "__main__":
    distribute()
