"""
Game Theory Core - Base Classes and Enums

Defines the fundamental structures for agent negotiation and consensus.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
import uuid
import logging

logger = logging.getLogger("GameTheory")

class GameMechanism(Enum):
    DICTATOR = "dictator"          # One agent decides (legacy/linear)
    MAJORITY_VOTE = "majority"     # >50% approval
    UNANIMOUS = "unanimous"        # 100% approval required
    NASH_BARGAINING = "nash"       # Maximize product of utility gains (cooperative)
    WEIGHTED_SUM = "weighted_sum"  # Highest weighted score wins

@dataclass
class Proposal:
    """
    Represents a unit of content or a decision being debated.
    """
    content: Any  # The script, title, or object payload
    author: str   # Name of the agent who proposed it
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    metadata: Dict = field(default_factory=dict)
    
    # Tracking utility scores from different players
    # Format: {"player_name": score_float}
    scores: Dict[str, float] = field(default_factory=dict)
    
    # Qualitative feedback/critiques
    # Format: {"player_name": "critique string"}
    feedback: Dict[str, str] = field(default_factory=dict)

    def add_score(self, player_name: str, score: float, comment: str = None):
        """Register a player's utility score for this proposal."""
        self.scores[player_name] = score
        if comment:
            self.feedback[player_name] = comment

    def get_average_score(self) -> float:
        if not self.scores:
            return 0.0
        return sum(self.scores.values()) / len(self.scores)

class Player:
    """
    Abstract base class for an agent participating in the Agora.
    """
    def __init__(self, name: str, weight: float = 1.0, role: str = "voter"):
        self.name = name
        self.weight = weight
        self.role = role # 'proposer', 'voter', 'critic'
        
    def calculate_utility(self, proposal: Proposal) -> float:
        """
        Calculate the utility (0.0 to 10.0) of a proposal for this agent.
        Must be implemented by subclasses (e.g., ViralCoach, SafetyGuardian).
        """
        raise NotImplementedError("Players must implement calculate_utility")
        
    def critique(self, proposal: Proposal) -> str:
        """Optional: Provide qualitative feedback."""
        return ""
