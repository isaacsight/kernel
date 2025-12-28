"""
Agora - The Agent Consensus Engine

Orchestrates game-theoretic interactions between agents.
Instead of linear pipelines, agents debate proposals in the Agora.
"""

import logging
from typing import List, Dict, Optional, Tuple
from admin.engineers.game_theory import Player, Proposal, GameMechanism

logger = logging.getLogger("Agora")

class Agora:
    def __init__(self):
        self.players: List[Player] = []
        self.history: List[Dict] = [] # Audit log of debates
        
    def register_player(self, player: Player):
        """Add an agent to the council."""
        self.players.append(player)
        logger.info(f"Registered player: {player.name} (Role: {player.role}, Weight: {player.weight})")
        
    def run_debate(
        self, 
        topic: str, 
        proposals: List[Proposal], 
        mechanism: GameMechanism = GameMechanism.WEIGHTED_SUM
    ) -> Tuple[Optional[Proposal], Dict]:
        """
        Conducts a debate on a specific topic.
        
        Args:
            topic: Description of what is being decided.
            proposals: List of initial proposals to vote on.
            mechanism: The rule for deciding the winner.
            
        Returns:
            (Winner Proposal, Debate Details)
        """
        logger.info(f"--- Opening Agora Debate: {topic} ---")
        logger.info(f"Mechanism: {mechanism.value}")
        logger.info(f"Proposals: {len(proposals)}")
        
        debate_log = {
            "topic": topic,
            "mechanism": mechanism.value,
            "rounds": []
        }
        
        # Round 1: Evaluation
        # Every player scores every proposal
        for proposal in proposals:
            for player in self.players:
                try:
                    score = player.calculate_utility(proposal)
                    critique = player.critique(proposal)
                    proposal.add_score(player.name, score, critique)
                    logger.info(f"   [{player.name}] gave {score}/10 to '{proposal.id}'")
                except Exception as e:
                    logger.error(f"Player {player.name} failed to vote: {e}")

        # Decision Phase
        winner = None
        
        if mechanism == GameMechanism.WEIGHTED_SUM:
            winner = self._resolve_weighted_sum(proposals)
        elif mechanism == GameMechanism.MAJORITY_VOTE:
            winner = self._resolve_majority(proposals)
        elif mechanism == GameMechanism.DICTATOR:
             # Just pick the first player's favorite
             if self.players:
                 dictator = self.players[0]
                 winner = self._resolve_dictator(proposals, dictator)
        else:
             # Default to weighted sum
             winner = self._resolve_weighted_sum(proposals)
             
        if winner:
            logger.info(f"🏆 Winner: Proposal {winner.id} by {winner.author} (Score: {winner.get_average_score():.2f})")
        else:
            logger.warning("No consensus reached.")
            
        return winner, debate_log

    def _resolve_weighted_sum(self, proposals: List[Proposal]) -> Optional[Proposal]:
        """Rank proposals by sum of (score * player_weight)."""
        best_proposal = None
        max_weighted_score = -1.0
        
        for p in proposals:
            weighted_total = 0.0
            total_weight = 0.0
            
            for player in self.players:
                score = p.scores.get(player.name, 0.0)
                weighted_total += score * player.weight
                total_weight += player.weight
                
            # Normalize to 0-10 scale
            final_score = weighted_total / total_weight if total_weight > 0 else 0
            
            if final_score > max_weighted_score:
                max_weighted_score = final_score
                best_proposal = p
                
        return best_proposal

    def _resolve_majority(self, proposals: List[Proposal]) -> Optional[Proposal]:
        """Simple majority vote (approval voting logic: score >= 7 is a YES)."""
        best_proposal = None
        max_votes = -1
        
        for p in proposals:
            votes = 0
            for player in self.players:
                if p.scores.get(player.name, 0.0) >= 7.0: # Approval threshold
                    votes += 1
            
            if votes > max_votes:
                max_votes = votes
                best_proposal = p
                
        return best_proposal

    def _resolve_dictator(self, proposals: List[Proposal], dictator: Player) -> Optional[Proposal]:
        """The dictator's choice rules all."""
        best_proposal = None
        max_score = -1.0
        
        for p in proposals:
            score = p.scores.get(dictator.name, 0.0)
            if score > max_score:
                max_score = score
                best_proposal = p
                
        return best_proposal
