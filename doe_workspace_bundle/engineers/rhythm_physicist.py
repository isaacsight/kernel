"""
The Rhythm Physicist - Viral Cadence Engineer

Specializes in the 'algorhythms' of content.
Uses a Logistic Regression model implemented from scratch to predict 
the resonance of TikTok scripts based on structural features.
"""

import math
import logging
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from admin.brain.collective_intelligence import get_collective_intelligence

logger = logging.getLogger("RhythmPhysicist")

class RhythmPhysicist:
    """
    The Rhythm Physicist (Resonance Engineer)
    
    Mission: Quantify the 'soul' and cadence of a script using Supervised Learning.
    
    Features used for prediction:
    1. Hook Density (First 15% of words)
    2. Sentence Variance (Pacing)
    3. Sentiment Flux (Emotional rhythm)
    4. Call-to-Action Intensity
    """
    
    def __init__(self):
        self.name = "The Rhythm Physicist"
        self.role = "Viral Cadence Engineer"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.collective = get_collective_intelligence()
        
        # Hyperparameters for our "Algorhythm"
        self.learning_rate = 0.05
        self.iterations = 1000
        
        # Model Weights (Initialized for the 'Studio OS' vibe)
        # Bias, Hook, Pacing, Sentiment, CTA
        self.weights = np.array([-0.5, 2.5, 1.8, 1.2, 2.0])
        
        # Register expertise with collective
        self.collective.register_expertise(
            self.name, 
            ["rhythm analysis", "cadence optimization", "resonance modeling", "structural physics"]
        )

    def _sigmoid(self, z):
        """Standard Logistic Sigmoid function."""
        return 1 / (1 + np.exp(-z))

    def extract_features(self, script: str) -> np.array:
        """
        Translates raw text into a feature vector for the ML model.
        Returns [Bias(1), Hook_Score, Pacing_Score, Sentiment_Score, CTA_Score]
        """
        words = script.lower().split()
        if not words:
            return np.array([1, 0, 0, 0, 0])
            
        # 1. Hook Score (First 10 words impact)
        hook_indicators = ["never", "how", "why", "stop", "scary", "secret", "truth", "discovered"]
        hook_words = words[:10]
        hook_score = sum(1 for w in hook_words if w in hook_indicators) / 10.0
        
        # 2. Pacing Score (Sentence length variance)
        sentences = script.split('.')
        sentence_lengths = [len(s.split()) for s in sentences if len(s.split()) > 0]
        if len(sentence_lengths) > 1:
            # High variance in length often means better rhythm for TikTok
            pacing_score = np.std(sentence_lengths) / 20.0 
        else:
            pacing_score = 0.1
            
        # 3. Sentiment Flux (Approximate via markers)
        positive = ["love", "great", "easy", "win", "success", "resolved"]
        negative = ["hard", "fail", "broke", "hate", "struggle"]
        tonal_shifts = 0
        current_tone = 0 # 1 pos, -1 neg
        
        for w in words:
            if w in positive:
                if current_tone == -1: tonal_shifts += 1
                current_tone = 1
            elif w in negative:
                if current_tone == 1: tonal_shifts += 1
                current_tone = -1
        
        sentiment_score = min(tonal_shifts / 5.0, 1.0)
        
        # 4. CTA Score
        cta_patterns = ["follow", "comment", "share", "link", "what do you"]
        cta_score = sum(1 for p in cta_patterns if p in script.lower()) / 5.0
        
        return np.array([1.0, hook_score, pacing_score, sentiment_score, cta_score])

    def predict_resonance(self, script: str) -> Dict:
        """
        Predicts the viral resonance of a script using the Logistic model.
        """
        features = self.extract_features(script)
        z = np.dot(features, self.weights)
        resonance = self._sigmoid(z)
        
        # Interpret result
        if resonance > 0.8:
            verdict = "Harmonic (High Resonance)"
            color = "green"
        elif resonance > 0.5:
            verdict = "Syncopated (Foundational Resonance)"
            color = "blue"
        else:
            verdict = "Dissonant (Low Resonance)"
            color = "red"
            
        result = {
            "resonance_score": round(float(resonance), 3),
            "verdict": verdict,
            "physicist_notes": self._generate_physics_notes(features),
            "brand_color": color,
            "analyzed_at": datetime.now().isoformat()
        }
        
        # Track for system metrics
        self.metrics.track_agent_action(self.name, 'predict_resonance', True, 0)
        
        return result

    def _generate_physics_notes(self, features: np.array) -> List[str]:
        """Generates physics-themed insights from the features."""
        notes = []
        # Bias, Hook, Pacing, Sentiment, CTA
        if features[1] < 0.1:
            notes.append("Low Initial Velocity: The hook lacks gravitational pull.")
        if features[2] < 0.2:
            notes.append("Static Pacing: The script is a monolith. Break it into rhythmic waves.")
        if features[3] > 0.5:
            notes.append("High Emotional Flux: Tonal shifts are creating good narrative friction.")
        if features[4] < 0.1:
            notes.append("Vacuum Ending: No terminal force detected. Add a structural CTA.")
            
        return notes

    def train_on_success(self, script: str, label: float):
        """
        Performs a single step of Gradient Descent.
        Label 1.0 = Viral/Successful, 0.0 = Failed.
        Allows the Physicist to 'learn' from the outcome of the Broadcaster.
        """
        features = self.extract_features(script)
        prediction = self._sigmoid(np.dot(features, self.weights))
        error = label - prediction
        
        # Update weights: w = w + alpha * error * prediction * (1-prediction) * x
        # This is the derivative of the cost function for Logistic Regression
        gradient = error * prediction * (1 - prediction) * features
        self.weights += self.learning_rate * gradient
        
        logger.info(f"[{self.name}] Learned from feedback. New bias weight: {self.weights[0]:.4f}")
        
        # Save weights to memory so they persist
        self.memory.save_insight(
            "rhythm_physicist_model", 
            {"weights": self.weights.tolist()}, 
            confidence=1.0,
            source=self.name
        )

if __name__ == "__main__":
    rp = RhythmPhysicist()
    test_script = "Stop doing what you are doing. The secret to AI is finally revealed. It is simple, yet revolutionary. Follow for more."
    res = rp.predict_resonance(test_script)
    print(f"Prediction: {res['resonance_score']} - {res['verdict']}")
    print(f"Notes: {res['physicist_notes']}")
