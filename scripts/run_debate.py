import sys
import os
import argparse
import logging
from datetime import datetime

# Add project root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.researcher import Researcher
from admin.engineers.contrarian import Contrarian

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger("DebateArena")

def run_debate(topic: str):
    logger.info(f"⚔️ OPENING DEBATE ARENA: {topic}")
    print("=" * 60)
    
    # 1. Proponent (The Researcher)
    researcher = Researcher()
    logger.info("ROUND 1: The Researcher presents the Thesis...")
    
    # We'll do a quick research pass (1 iteration)
    research_result = researcher.iterative_research(topic, max_iterations=1)
    thesis_summary = research_result['report'][:1000] # First 1000 chars as the core argument
    
    print(f"\n📜 THESIS SUMMARY:\n{thesis_summary}...\n")
    
    # 2. Opponent (The Contrarian)
    contrarian = Contrarian()
    logger.info("ROUND 2: The Contrarian identifies the Extreme Variable...")
    
    challenge = contrarian.challenge_thesis(topic, context=research_result['report'])
    
    print(f"\n⚠️ EXTREME VARIABLE ID: {challenge['extreme_variable']}")
    print(f"\n🔥 DISSENTING OPINION:\n{challenge['dissent']}\n")
    
    # 3. Save the Outcome
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_topic = "".join([c if c.isalnum() else "_" for c in topic])[:50]
    filename = f"debate_{timestamp}_{safe_topic}.md"
    path = os.path.join("admin/brain/research_reports", filename)
    
    with open(path, "w") as f:
        f.write(f"# Debate: {topic}\n\n")
        f.write(f"## Level 1: The Thesis (Researcher)\n{research_result['report']}\n\n")
        f.write(f"## Level 2: The Antithesis (Contrarian)\n### Extreme Variable: {challenge['extreme_variable']}\n{challenge['dissent']}\n")
        
    logger.info(f"✅ Debate Conclusion Saved: {path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run an AI Debate")
    parser.add_argument("topic", nargs="?", default="Vertical Integration in SaaS", help="Topic to debate")
    args = parser.parse_args()
    
    run_debate(args.topic)
