"""
Active Inference Module - The Engineering of Surprise Minimization

This module provides the core logic for Active Inference (FEP) within the Studio OS.
It enables agents to:
1. Maintain persistent Belief States (Perception).
2. Calculate Expected Free Energy (EFE) for policy selection.
3. Balance Epistemic (Exploration) and Pragmatic (Exploitation) values.
"""

import os
import json
import logging
import math
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger("ActiveInference")

class ActiveInferenceMixin:
    """
    Mixin providing Active Inference capabilities to AI agents.
    
    Active Inference posits that agents act to minimize their Free Energy,
    which is equivalent to minimizing 'Surprise' or maximizing 'Evidence'
    for their internal generative model.
    """
    
    def __init__(self, agent_id: str, memory_store=None, model_router=None):
        self.agent_id = agent_id
        self.memory_store = memory_store
        self.model_router = model_router

    def update_beliefs(self, entity_id: str, observation: Any, context: str) -> Dict[str, Any]:
        """
        The 'Perception' step: Update internal belief states based on a new observation.
        
        Args:
            entity_id: The thing we are forming beliefs about (e.g., 'user_intent', 'task_success')
            observation: The new data received (e.g., a tool output or user message)
            context: The broader background context
            
        Returns:
            The new belief state and confidence.
        """
        logger.info(f"[{self.agent_id}] Updating beliefs about {entity_id}...")
        
        # 1. Retrieve previous beliefs from MemoryStore
        prev_beliefs = self.memory_store.get_latest_beliefs(self.agent_id, entity_id)
        prev_data = prev_beliefs[0]["belief_data"] if prev_beliefs else {}

        # 2. Use LLM to calculate the 'Prediction Error' and update the state
        # We prompt the LLM to act as a Variational Inference engine.
        prompt = f"""
        As the internal Variational Inference engine for {self.agent_id}, update your Belief State ($b$).
        
        ENTITY: {entity_id}
        PREVIOUS BELIEFS: {json.dumps(prev_data)}
        NEW OBSERVATION: {observation}
        CONTEXT: {context}
        
        TASK:
        1. Calculate the 'Prediction Error' (Difference between previous belief and new observation).
        2. Update the probability distribution over latent states.
        3. Estimate the 'Entropy' (Uncertainty) of the new state.
        4. Provide a 'Confidence' score (1.0 - surprise).
        
        Return JSON ONLY:
        {{
            "latent_state_estimate": "...",
            "summary_of_change": "...",
            "probabilities": {{"state_a": 0.X, "state_b": 0.Y}},
            "confidence": 0.X,
            "entropy": 0.X
        }}
        """
        
        # Simplified: In a real implementation we would call the ModelRouter here.
        # For this demo, we'll return a simulated state update if the model call fails or isn't feasible.
        try:
            # Placeholder for actual LLM call via ModelRouter/BaseAgent.run
            # result = self.call_reasoning_model(prompt)
            # data = json.loads(result)
            
            # Simulation for now to ensure flow works
            data = {
                "latent_state_estimate": f"Updated understanding of {entity_id} based on observation.",
                "summary_of_change": "Refined state estimate.",
                "probabilities": {"success": 0.8, "failure": 0.2},
                "confidence": 0.85,
                "entropy": 0.15
            }
            
            # 3. Save to MemoryStore
            self.memory_store.save_belief_state(
                self.agent_id, 
                entity_id, 
                data, 
                confidence=data["confidence"], 
                entropy=data["entropy"]
            )
            
            return data
        except Exception as e:
            logger.error(f"Belief update failed: {e}")
            return {}

    def select_action_via_efe(self, potential_actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        The 'Action' step: Select the policy that minimizes Expected Free Energy (G).
        
        G = Uncertainty (Epistemic Value) + Preference (Pragmatic Value)
        
        Args:
            potential_actions: List of possible actions with their descriptions.
            
        Returns:
            The action with the lowest EFE.
        """
        logger.info(f"[{self.agent_id}] Selecting action via EFE minimization...")
        
        # 1. Prompt LLM to evaluate actions on two axes:
        # - Epistemic: How much will this action resolve my uncertainty?
        # - Pragmatic: How much does this action move me toward the user's goal?
        
        # 2. Assign scores (Low EFE is better)
        # In a real system, the agent would simulate the future for each action.
        
        scored_actions = []
        for action in potential_actions:
            # Pragmatic Value (Preference/Goal Alignment)
            # Default to 0.5 if not provided. Higher is better for alignment, 
            # so we invert for EFE (since lower EFE is better).
            prag_val = action.get("pragmatic_value", 0.5)
            
            # Incorporate Reward Signal (if present)
            # Reward increases pragmatic value (decreases EFE)
            reward = action.get("reward", 0.0)
            beta = action.get("reward_sensitivity", 0.5) # Weight for reward
            
            augmented_pragmatic = prag_val + (beta * reward)
            # Clip to [0, 1] for normalization
            augmented_pragmatic = max(0.0, min(1.0, augmented_pragmatic))
            
            pragmatic = 1.0 - augmented_pragmatic
            
            # Epistemic Value (Information Gain/Uncertainty Resolution)
            epi_val = action.get("epistemic_value", 0.1)
            epistemic = 1.0 - epi_val
            
            efe = pragmatic + epistemic
            
            scored_actions.append({
                **action,
                "efe": efe,
                "pragmatic": pragmatic,
                "epistemic": epistemic
            })
            
            # Save prior to DB
            self.memory_store.save_action_prior(
                self.agent_id, 
                action["type"], 
                efe, 
                pragmatic=pragmatic, 
                epistemic=epistemic
            )
            
        # 3. Sort by EFE (ASC)
        scored_actions.sort(key=lambda x: x["efe"])
        return scored_actions[0] if scored_actions else {}

    def calculate_surprise(self, prediction: Dict[str, float], observation: Dict[str, float]) -> float:
        """
        Calculate the 'Surprise' (KL-Divergence) between a predicted distribution and observed distribution.
        Prompt #81: Implementing real KL-Divergence metric.
        
        Args:
            prediction: Probability dict {state: prob}
            observation: Probability dict {state: prob} (Post-Hoc/Observed frequency)
        """
        kl_divergence = 0.0
        epsilon = 1e-10 # Prevent log(0)
        
        # Iterate over all states in the observation
        for state, q_prob in observation.items():
            p_prob = prediction.get(state, epsilon)
            
            # KL(Q||P) = sum(Q(x) * log(Q(x) / P(x)))
            # Surprise is the information gain moving from P to Q
            kl_divergence += q_prob * math.log((q_prob + epsilon) / (p_prob + epsilon))
            
        return max(0.0, kl_divergence)

    def log_efe_telemetry(self, action: str, efe: float, surprise: float):
        """
        Telemetry hook (Prompt #41): Visualize Expected Free Energy.
        """
        # In a real system, this would push to Grafana
        logger.info(
            f"[ActiveInference] Action: {action} | EFE: {efe:.4f} | Surprise: {surprise:.4f} | "
            f"State: {'Learning' if surprise > 0.5 else 'Performing'}"
        )
