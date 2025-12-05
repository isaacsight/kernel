
import sys
import os
import json
import logging

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from admin.engineers.game_theory import Player, Proposal, GameMechanism
from admin.engineers.agora import Agora
from admin.engineers.viral_coach import ViralCoach
from admin.engineers.creative_director import CreativeDirector

# Configure logging to show the debate clearly
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("AgoraDemo")

# --- 1. Define Agent Adapters ---

class ViralCoachPlayer(Player):
    def __init__(self):
        super().__init__(name="ViralCoach", weight=1.0, role="optimization")
        self.coach = ViralCoach()
        
    def calculate_utility(self, proposal: Proposal) -> float:
        """Utility is based on viral score."""
        script = proposal.content
        analysis = self.coach.analyze_tiktok_script(script)
        score = analysis["overall_score"]
        
        # Store detailed analysis in metadata for reference
        proposal.metadata["viral_analysis"] = analysis
        return score
        
    def critique(self, proposal: Proposal) -> str:
        analysis = proposal.metadata.get("viral_analysis", {})
        suggestions = analysis.get("suggestions", [])
        return "; ".join(suggestions) if suggestions else "No suggestions."

class CreativeDirectorPlayer(Player):
    def __init__(self):
        # Creative Director has higher weight (quality control)
        super().__init__(name="CreativeDirector", weight=1.2, role="governance")
        self.director = CreativeDirector()
        
    def calculate_utility(self, proposal: Proposal) -> float:
        """Utility is based on brand alignment."""
        script = proposal.content
        review = self.director.review_tiktok_script(script, vibe="chill")
        
        # If rejected, score is low (0-3). If approved, score is high (7-10).
        if not review["approved"]:
            score = 2.0 
            proposal.feedback[self.name] = f"REJECTED: {'; '.join(review['issues'])}"
        else:
            score = 9.0
            proposal.feedback[self.name] = "APPROVED: Aligns with brand voice."
            
        return score

# --- 2. The Simulation ---

def main():
    print("🏛️  Welcome to the Agora")
    print("-----------------------")
    
    agora = Agora()
    
    # Register agents
    agora.register_player(ViralCoachPlayer())
    agora.register_player(CreativeDirectorPlayer())
    
    # Define Proposals
    
    # Proposal A: Viral but spammy
    script_a = """
    STOP scrolling! You won't believe this secret hack to make $10k/month.
    Smash that like button and check the link in bio right now!
    """
    
    # Proposal B: Philosophical and brand-aligned
    script_b = """
    Sometimes the most productive thing you can do is nothing at all.
    I spent years chasing efficiency, only to find that clarity comes from stillness.
    """
    
    proposal_a = Proposal(content=script_a, author="MarketingBot", id="PROPOSAL_A")
    proposal_b = Proposal(content=script_b, author="PhilosopherBot", id="PROPOSAL_B")
    
    proposals = [proposal_a, proposal_b]
    
    # Run Debate
    winner, log = agora.run_debate(
        topic="Best TikTok Script for Tomorrow", 
        proposals=proposals,
        mechanism=GameMechanism.WEIGHTED_SUM
    )
    
    print("\n📊 Debate Results:")
    for p in proposals:
        print(f"\n📄 Proposal {p.id}:")
        print(f"   Content: \"{p.content.strip()[:50]}...\"")
        print(f"   Average Score: {p.get_average_score():.1f}")
        print("   Feedback:")
        for agent, feedback in p.feedback.items():
            print(f"     - {agent}: {feedback}")
            
    if winner:
        print(f"\n🏆 WINNER: {winner.id} by {winner.author}")
    else:
        print("\n❌ No consensus reached.")

if __name__ == "__main__":
    main()
