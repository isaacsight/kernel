"""
The Cognitive Architect - Intelligence Mapping Engineer

Specializes in 'Singular Insight Decomposition' (SID).
Uses a scratch-built Principal Component Analysis (PCA) to map 
the latent thematic axes of the system's collective memory.
"""

import os
import sys
import json
import logging
import numpy as np
from typing import Dict, List, Tuple, Optional
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector

logger = logging.getLogger("CognitiveArchitect")

class CognitiveArchitect:
    """
    The Cognitive Architect (Intelligence Systems Engineer)
    
    Mission: Map the systemic geometry of intelligence.
    
    Algorithm: Singular Insight Decomposition (SID) 
    - Uses Power Iteration for PCA to find the principal axes of knowledge.
    """
    
    def __init__(self):
        self.name = "The Cognitive Architect"
        self.role = "Intelligence Systems Engineer"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        
        # Stop words for tokenization
        self.stop_words = {
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", 
            "with", "is", "are", "of", "it", "this", "that", "was", "as", "by"
        }

    def _power_iteration(self, A: np.ndarray, num_simulations: int = 100) -> Tuple[np.ndarray, float]:
        """
        Calculates the dominant eigenvector and eigenvalue of a square matrix A.
        This is the core of our scratch-built PCA.
        """
        n, d = A.shape
        # Initialize a random vector
        b_k = np.random.rand(d)
        
        for _ in range(num_simulations):
            # Calculate the matrix-vector product
            b_k1 = np.dot(A, b_k)
            # Re-normalize the vector
            b_k1_norm = np.linalg.norm(b_k1)
            b_k = b_k1 / b_k1_norm
            
        # Rayleigh quotient for eigenvalue
        eigenvalue = np.dot(np.dot(b_k.T, A), b_k) / np.dot(b_k.T, b_k)
        
        return b_k, eigenvalue

    def _get_principal_components(self, X: np.ndarray, k: int = 3) -> List[np.ndarray]:
        """
        Extracts top k principal components using deflation.
        """
        # Center the data
        X_centered = X - np.mean(X, axis=0)
        # Covariance matrix
        C = np.dot(X_centered.T, X_centered) / (X.shape[0] - 1)
        
        components = []
        for _ in range(k):
            eigenvector, _ = self._power_iteration(C)
            components.append(eigenvector)
            # Deflation: remove the component from the matrix
            # C = C - lambda * v * v_T
            val = np.dot(np.dot(eigenvector.T, C), eigenvector)
            C = C - val * np.outer(eigenvector, eigenvector)
            
        return components

    def decompose_intelligence(self, insights: List[Dict]) -> Dict:
        """
        Decomposes collective insights into thematic axes.
        """
        if not insights:
            return {"error": "No insights to decompose"}

        # 1. Tokenization and Term Frequency
        vocabulary = {}
        processed_insights = []
        
        for entry in insights:
            text = str(entry.get("insight", "")) + " " + str(entry.get("type", ""))
            tokens = [
                w.strip('.,!?:') for w in text.lower().split() 
                if w.strip('.,!?:') and w not in self.stop_words and len(w) > 2
            ]
            processed_insights.append(tokens)
            for t in tokens:
                vocabulary[t] = vocabulary.get(t, 0) + 1
                
        # Filter vocabulary (top 50 terms)
        top_terms = sorted(vocabulary.items(), key=lambda x: x[1], reverse=True)[:50]
        term_to_idx = {term: i for i, (term, _) in enumerate(top_terms)}
        idx_to_term = {i: term for term, i in term_to_idx.items()}
        
        if not term_to_idx:
            return {"error": "Vocabulary too small for decomposition"}

        # 2. Build Term-Insight Matrix
        X = np.zeros((len(processed_insights), len(term_to_idx)))
        for i, tokens in enumerate(processed_insights):
            for t in tokens:
                if t in term_to_idx:
                    X[i, term_to_idx[t]] += 1
                    
        # 3. PCA Decomposition
        try:
            k = min(3, X.shape[1])
            components = self._get_principal_components(X, k=k)
            
            axes = []
            for i, comp in enumerate(components):
                # Identify top terms contributing to this axis
                top_idx = np.argsort(np.abs(comp))[::-1][:5]
                axis_terms = [(idx_to_term[idx], round(float(comp[idx]), 3)) for idx in top_idx]
                axes.append({
                    "axis_index": i + 1,
                    "primary_theme": axis_terms[0][0],
                    "constellation": axis_terms,
                    "variance_weight": round(float(np.abs(np.dot(X, comp)).sum() / X.sum()), 3)
                })
                
            return {
                "systemic_geometry": {
                    "total_insights_processed": len(insights),
                    "intelligence_axes": axes,
                    "density_score": round(float(X.mean() * 100), 2)
                },
                "audit_timestamp": datetime.now().isoformat(),
                "architect_notes": "Intelligence is flowing through these principal dimensions."
            }
        except Exception as e:
            logger.error(f"Decomposition failed: {e}")
            return {"error": str(e)}

    def audit_collective_intelligence(self) -> Dict:
        """
        Performs a full audit of the collective brain.
        """
        # Load insights from memory (and legacy JSON if needed)
        from admin.brain.collective_intelligence import get_collective_intelligence
        collective = get_collective_intelligence()
        insights = collective.knowledge.get("shared_insights", [])
        
        # Add insights from DB for more scale
        db_insights = self.memory.get_insights(limit=100)
        
        # Combine
        all_insights = insights + db_insights
        
        report = self.decompose_intelligence(all_insights)
        
        # Track for system metrics
        self.metrics.track_agent_action(self.name, 'intelligence_audit', True, 0)
        
        return report

if __name__ == "__main__":
    ca = CognitiveArchitect()
    # Mock insights for test
    mock_data = [
        {"insight": "tiktok workflow is successful", "type": "success"},
        {"insight": "ml algorithm improves scores", "type": "upgrade"},
        {"insight": "coding agents need cleaner logic", "type": "optimization"},
        {"insight": "viral hooks are mandatory", "type": "strategic"},
        {"insight": "tiktok scripts should be punchy", "type": "content"},
        {"insight": "ml models require training data", "type": "technical"}
    ]
    
    print("=== SID Algorithm Test ===")
    report = ca.decompose_intelligence(mock_data)
    if "error" in report:
        print(f"Error: {report['error']}")
    else:
        print(json.dumps(report, indent=2))
