"""
Generate a blog post about the Studio Node upgrade.
Uses the Alchemist with the 'remote' provider to prove it works.
"""

import os
import sys
import logging
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.alchemist import Alchemist
from config import config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NodeAnnouncement")

def generate_announcement():
    alchemist = Alchemist()
    
    topic = "The Other Computer: Awakening the Studio Node"
    
    doctrine = """
    We value technical transparency and emotional resonance.
    We write about code as if it were a living thing.
    We explore the concept of "distributed cognition" - two machines sharing one brain.
    We end with the question: Does this feel true?
    """
    
    print(f"Generating post about '{topic}' using Studio Node...")
    
    try:
        # Force 'remote' provider to prove the node is working
        content = alchemist.generate(topic, doctrine, provider="remote")
        
        # Create file
        slug = "awakening-the-studio-node"
        date = datetime.now().strftime('%Y-%m-%d')
        
        frontmatter = f"""---
title: "{topic}"
date: {date}
category: "Engineering"
tags: ["ai", "distributed-systems", "studio-os"]
---

"""
        
        filename = f"{slug}.md"
        filepath = os.path.join(config.CONTENT_DIR, filename)
        
        with open(filepath, 'w') as f:
            f.write(frontmatter + content)
            
        print(f"\nSUCCESS! Post generated and saved to: {filepath}")
        print("-" * 40)
        print(content[:500] + "...")
        print("-" * 40)
        
    except Exception as e:
        print(f"\nFAILED: {e}")

if __name__ == "__main__":
    generate_announcement()
