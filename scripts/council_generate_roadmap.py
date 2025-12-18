import sys
import os
import logging
import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.council import GrandCouncil
from admin.engineers.trend_scout import TrendScout
from admin.engineers.publisher import get_publisher

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ArtifactGenerator")

def generate_roadmap():
    logger.info("🎨 Initializing Artifact Generator...")
    
    # 1. Initialize Council
    council = GrandCouncil()
    
    # 2. Register Agents
    try:
        council.register_agent("Trend Scout", TrendScout())
        council.register_agent("Publisher", get_publisher())
    except Exception as e:
        logger.warning(f"Could not register some agents: {e}")

    # 3. Define the Goal
    topic = "Create a 30-day Strategic Roadmap for the 'IsaacSight' blog. Focus on 'AI Agents', 'System 2 Thinking', and 'Automated Creativity'."
    
    # 4. Mock State
    state = {
        "status": "planning",
        "date": datetime.datetime.now().isoformat(),
        "recent_posts": ["IBM Quantum Cloud Revolution", "Engineering Log: Polymath Graph"]
    }
    
    # 5. Deliberate
    logger.info("🧠 Asking Council to deliberate...")
    result = council.deliberate(topic, state)
    
    # 6. Extract Content
    content = result.get('council_output', 'No output generated.')
    
    # 7. Save as Artifact
    filename = f"content/{datetime.datetime.now().strftime('%Y-%m-%d')}-council-strategic-roadmap.md"
    filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), filename)
    
    logger.info(f"💾 Saving artifact to: {filepath}")
    
    with open(filepath, "w") as f:
        f.write("---\n")
        f.write(f"title: Council Strategic Roadmap\n")
        f.write(f"date: {datetime.datetime.now().strftime('%Y-%m-%d')}\n")
        f.write("author: The Grand Council\n")
        f.write("---\n\n")
        f.write(f"# Council Deliberation: {topic}\n\n")
        f.write(content)
        f.write("\n\n---\n")
        f.write("### Intelligence Used\n")
        f.write(result.get('intelligence', 'None'))

    logger.info("✅ Artifact created successfully.")

if __name__ == "__main__":
    generate_roadmap()
