import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any
from admin.brain.memory_store import get_memory_store

logger = logging.getLogger("FeltRightIndex")

class FeltRightIndex:
    """
    Calculates the 'Felt Right Index' (FRI) for the studio.
    FRI is a composite metric of:
    1. Alignment (manual overrides vs. accepted suggestions)
    2. Recency (cadence of judgment)
    3. Sentiment (explicit 'felt right' vs. 'felt wrong' signals)
    """
    
    def __init__(self):
        self.memory = get_memory_store()

    def calculate_fri(self, days: int = 7) -> Dict[str, Any]:
        """
        Calculate the FRI for the past N days.
        Returns a score from 0 to 100.
        """
        history = self.memory.get_decision_history(limit=500)
        now = datetime.now()
        cutoff = now - timedelta(days=days)
        
        # Filter by recency
        recent_decisions = [
            d for d in history 
            if datetime.fromisoformat(d['timestamp']) > cutoff
        ]
        
        if not recent_decisions:
            return {
                "score": 50, # Neutral starting point
                "alignment": 50,
                "cadence": 0,
                "sentiment": 50,
                "sample_size": 0,
                "label": "Cold Start"
            }

        # 1. Alignment Score (Yes vs. No)
        yes_count = sum(1 for d in recent_decisions if d['decision'] == 'yes')
        no_count = sum(1 for d in recent_decisions if d['decision'] == 'no')
        total_yes_no = yes_count + no_count
        
        alignment = (yes_count / total_yes_no * 100) if total_yes_no > 0 else 50
        
        # 2. Cadence Score (Density of decisions over time)
        # Goal: At least 3 decisions per day for 'High' cadence
        target_decisions = days * 3
        cadence = min(len(recent_decisions) / target_decisions * 100, 100)
        
        # 3. Sentiment Score (Specific 'felt_wrong' flags in metadata)
        felt_wrong_count = sum(1 for d in recent_decisions if d.get('metadata', {}).get('sentiment') == 'felt_wrong')
        felt_right_count = sum(1 for d in recent_decisions if d.get('metadata', {}).get('sentiment') == 'felt_right')
        total_sentiment = felt_wrong_count + felt_right_count
        
        if total_sentiment > 0:
            sentiment = (felt_right_count / total_sentiment * 100)
        else:
            sentiment = 50 # Neutral
            
        # Composite Score (Weighted)
        # 40% Alignment, 30% Cadence, 30% Sentiment
        score = (alignment * 0.4) + (cadence * 0.3) + (sentiment * 0.3)
        
        label = self._get_label(score)
        
        return {
            "score": round(score, 1),
            "alignment": round(alignment, 1),
            "cadence": round(cadence, 1),
            "sentiment": round(sentiment, 1),
            "sample_size": len(recent_decisions),
            "label": label,
            "timestamp": now.isoformat()
        }

    def _get_label(self, score: float) -> str:
        if score >= 85: return "Flow State"
        if score >= 70: return "Aligned"
        if score >= 50: return "Stable"
        if score >= 30: return "Friction"
        return "Misaligned"

fri_engine = FeltRightIndex()
