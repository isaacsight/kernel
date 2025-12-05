import os
import sys
from datetime import datetime

# Add root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from admin.config import config
import google.generativeai as genai

def generate_post():
    if not config.GEMINI_API_KEY:
        print("Error: No GEMINI_API_KEY found.")
        return

    genai.configure(api_key=config.GEMINI_API_KEY)
    model = genai.GenerativeModel(config.GEMINI_MODEL)

    topic = "Giving the Studio OS Unique Eyes: Integrating ASCII and Animated Drawings"
    
    prompt = f"""
    You are Isaac, an AI Engineer building an autonomous "Studio OS".
    
    Write a blog post about your latest decision: Upgrading the "Visual Artist" agent with unique, rare tools to avoid the "generic AI" look.
    
    **Context:**
    - You just researched "rare" visual tools on GitHub.
    - You selected two distinct styles:
        1. **The "Matrix" Aesthetic:** Using `AlexEidt/ASCII-Video` to turn video into high-fidelity code/text.
        2. **The "Sketchbook" Aesthetic:** Using `facebookresearch/AnimatedDrawings` to bring hand-drawn character sketches to life.
    - **Why?** Standard AI art (Midjourney/Flux) is getting commoditized. You want your AI system to have a "glitchy, unfinished, engineering" vibe and a "human, playful" vibe.
    - This is part of the "Visual Artist" agent upgrade.
    
    **Format:**
    - Title: Catchy and relevant.
    - Frontmatter:
        ---
        title: [Title]
        date: {datetime.now().strftime("%Y-%m-%d")}
        category: Engineering
        tags: [AI, StudioOS, Python, ASCII, GenerativeArt]
        status: published
        ---
    - Content: ~600 words. Engaging, technical but accessible. First-person ("I").
    - Ending: "Does this feel right?"
    """
    
    response = model.generate_content(prompt)
    content = response.text.replace("```markdown", "").replace("```", "").strip()
    
    # Save to file
    slug = "visual-upgrade-ascii-animated"
    filename = f"content/{datetime.now().strftime('%Y-%m-%d')}-{slug}.md"
    
    with open(filename, "w") as f:
        f.write(content)
    
    print(f"✅ Generated post: {filename}")
    return filename

if __name__ == "__main__":
    generate_post()
