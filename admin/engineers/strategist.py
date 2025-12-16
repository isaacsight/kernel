import logging
import random
import time

logger = logging.getLogger("Strategist")

class Strategist:
    """
    The Strategist is the brain of the evolution loop.
    It runs as a local agent to maintain system stability and direct the evolution process.
    """
    
    def __init__(self):
        self.name = "The Strategist"
        
    def process_evolution(self, state):
        """
        Simulates the decision making process.
        Returns a decision to 'mutate' (take action) or 'idle' (wait).
        """
        logger.info("Consulting Strategist...")
        
        # Simulate thinking time
        time.sleep(1)
        
        # Simple random decision logic
        # 40% chance to mutate if status is active/thinking
        if state.get("status") in ["active", "thinking"]:
            action = random.choices(["mutate", "idle"], weights=[0.4, 0.6], k=1)[0]
        else:
            action = "idle"
            
        logger.info(f"Strategist decided: {action}")
        
        return {
            "next_action": action,
            "message": "Strategist decision"
        }

def get_strategist():
    return Strategist()
