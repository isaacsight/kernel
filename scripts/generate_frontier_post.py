from admin.engineers.alchemist import Alchemist
import os
from datetime import date
from dotenv import load_dotenv

load_dotenv()

# Force correct URL just in case
os.environ["STUDIO_NODE_URL"] = "http://192.168.137.1:5001"

print("⚗️ Alchemist is preparing the lab...")
alchemist = Alchemist()

topic = "How I Hired a Digital Frontier Team (My AI Agents)"
doctrine = "We believe in building small, specialized teams of agents. We believe in owning our infrastructure (local nodes). We believe in transparency."

print(f"📝 Researching and writing about: {topic}")
print("   (This uses the Windows Node GPU, so it may take 60-120 seconds...)")

try:
    content, context = alchemist.generate(topic, doctrine, provider="remote")
    
    # Save file
    today = date.today().strftime("%Y-%m-%d")
    filename = "content/hiring-the-frontier-team.md"
    
    # Add Frontmatter wrapper if missing (Alchemist usually returns just body or stripped)
    if not content.startswith("---"):
        full_post = f"""---
title: "How I Hired a Digital Frontier Team"
date: {today}
category: Studio
tags:
  - agents
  - building-in-public
  - frontier-team
---

{content}
"""
    else:
        full_post = content

    with open(filename, "w") as f:
        f.write(full_post)
        
    print(f"\n✅ Post generated and saved to: {filename}")
    
except Exception as e:
    print(f"\n❌ Generation failed: {e}")
