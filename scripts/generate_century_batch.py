import os
import json
import time
import sys
import logging
from typing import List, Dict
from dotenv import load_dotenv
import google.generativeai as genai

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
from admin.engineers.editor import Editor

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("CenturyBatch")

# Load environment variables safely
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../.env'))
load_dotenv(env_path)

# Taxonomy of the Studio OS
CATEGORIES = {
    "Neuro_OS": "The philosophy of AI not as a tool, but as an operating system. The shift from 'Assistant' to 'Environment'.",
    "Swarm_Architecture": "Technical deep dives into multi-agent systems, 'The Council', memory management, and inter-agent protocols.",
    "Mobile_Agency": "Extending agency to the edge. designing for mobile, websockets, 'Remote Control for the Brain', and the break from the desktop.",
    "Living_Web": "Websites that breathe. Generative UI, self-healing code, autonomous publishing, and the end of static content.",
    "Digital_Consultancy": "The 'Design Team' concept. AI as critique partner, brand consultant, and master editor. Moving beyond code generation to high-level strategy.",
    "Human_AI_Symbiosis": "The sociology of working with AI. Trust, delegation, the 'Neural Glitch', and co-evolution of user and system.",
    "Death_of_Chatbot": "Why chat interfaces are insufficient. The move to active, background, and omni-present intelligence. CLI, Voice, and System Control.",
    "Automated_Creativity": "Pipelines for content creation. The 'Engine', gamification (Achievement Tracker), and overcoming the 'blank page' problem.",
    "System_2_Thinking": "Deep reasoning in AI. Slow thinking vs fast response. The 'Brain' architecture and long-term memory.",
    "Future_of_Code": "Codex, autonomous refactoring, the changing role of the engineer from writer to architect."
}

TOPIC_FILE = os.path.join(os.path.dirname(__file__), "../admin/century_batch_topics.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../content/century_batch")

def configure_genai():
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        # Fallback to hard error to stop execution
        logger.critical("No API key found in environment.")
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY not found.")
    
    # Mask key for logging
    masked = api_key[:4] + "..." + api_key[-4:] if len(api_key) > 8 else "INVALID"
    logger.info(f"Configuring Gemini with key: {masked}")
    
    genai.configure(api_key=api_key)

def generate_titles_for_category(category: str, description: str, count: int = 10) -> List[str]:
    """Generates unique, high-quality titles for a specific category."""
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    prompt = f"""
    Generate {count} distinct, high-quality blog post titles for the category: "{category}".
    
    Context/Theme: {description}
    
    The blog "IsaacSight" is intellectually rigorous, slightly futuristic, and technical but accessible.
    Avoid clickbait. Aim for titles that sound like essays in a high-end tech journal or philosophical manifesto.
    
    Examples of good tone:
    - "The Tether: Extending Agency to the Edge"
    - "The Death of the Helper"
    - "Architecting Collective Intelligence"
    
    Return ONLY a raw JSON list of strings. No markdown.
    """
    
    try:
        response = model.generate_content(prompt)
        text = response.text.replace("```json", "").replace("```", "").strip()
        titles = json.loads(text)
        return titles[:count]
    except Exception as e:
        logger.error(f"Failed to generate titles for {category}: {e}")
        return []

def run_dry_run():
    """Generates the topics list but does not write the essays."""
    configure_genai()
    logger.info("Starting Century Batch DRY RUN (Topic Generation)...")
    
    all_topics = {}
    total_count = 0
    
    for category, description in CATEGORIES.items():
        logger.info(f"Dreaming up topics for: {category}...")
        titles = generate_titles_for_category(category, description)
        all_topics[category] = titles
        total_count += len(titles)
        time.sleep(1) # Polite delay
        
    # Save topics
    with open(TOPIC_FILE, 'w') as f:
        json.dump(all_topics, f, indent=2)
        
    logger.info(f"✅ Generated {total_count} topics across {len(all_topics)} categories.")
    logger.info(f"Saved to {TOPIC_FILE}")
    return all_topics

def run_production():
    """Reads the topic list and writes the essays."""
    if not os.path.exists(TOPIC_FILE):
        logger.error("Topic file not found. Run dry_run first.")
        return

    with open(TOPIC_FILE, 'r') as f:
        all_topics = json.load(f)
        
    editor = Editor()
    # Override editor drafts dir to keep things organized
    editor.drafts_dir = OUTPUT_DIR
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    total_essays = sum(len(ts) for ts in all_topics.values())
    logger.info(f"Starting Production Run: Writing {total_essays} essays...")
    
    count = 0
    for category, titles in all_topics.items():
        logger.info(f"--- Processing Category: {category} ---")
        description = CATEGORIES[category]
        
        for title in titles:
            count += 1
            logger.info(f"[{count}/{total_essays}] Writing: {title}")
            
            # Check if exists
            safe_title = "".join([c if c.isalnum() else "_" for c in title])[:50]
            filename = f"ESSAY_{safe_title}.md"
            if os.path.exists(os.path.join(OUTPUT_DIR, filename)):
                logger.info("   Skipping (Already exists)")
                continue
                
            try:
                # We inject the category description as context
                context = f"Category: {category}\nTheme: {description}\n\nThis is part of 'The Century Batch' - a series of 100 interconnected essays on the Studio OS."
                editor.write_essay(title, context)
                
                # Sleep to respect rate limits (Gemini Flash is fast but let's be safe)
                time.sleep(2) 
            except Exception as e:
                logger.error(f"Failed to write '{title}': {e}")
                
    logger.info("🎉 Century Batch Complete.")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--write":
        run_production()
    else:
        run_dry_run()
