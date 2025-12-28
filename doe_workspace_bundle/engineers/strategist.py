import logging
import random
import time

logger = logging.getLogger("Strategist")

from admin.engineers.council import GrandCouncil

logger = logging.getLogger("Strategist")

class Strategist:
    """
    The Strategist is the brain of the evolution loop.
    It runs as a local agent to maintain system stability and direct the evolution process.
    """
    
    def __init__(self, engineers: dict = None):
        self.name = "The Strategist"
        self.council = GrandCouncil()
        self.engineers = engineers or {}
        
        # Register engineers to council
        if self.engineers:
            for name, agent in self.engineers.items():
                self.council.register_agent(name, agent)
        
    def process_evolution(self, state):
        """
        Simulates the decision making process using the Grand Council.
        """
        logger.info("Consulting Strategist & The Grand Council...")
        
        # Run Council Deliberation
        council_result = self.council.deliberate("Determine next evolutionary step", state)
        
        # Parse result (naive parsing for now, looking for json block in future iteration or utilizing the structured output found in text)
        output_text = council_result.get("council_output", "")
        
        action = "idle"
        directive = "Thinking..."
        
        if "mutate" in output_text.lower() and '"action": "mutate"' in output_text:
             action = "mutate"
             directive = "Council elected to Mutate."
             
        logger.info(f"Strategist decided: {action}")
        
        return {
            "next_action": action,
            "message": directive,
            "council_transcript": council_result
        }

def get_strategist(engineers=None):
    return Strategist(engineers)
