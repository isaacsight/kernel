"""
Viral Coach Kit - Modular DTFR Component
Part of the Studio OS Open Source Evolution.

Mission: Maximize content viral potential via "Felt-Sense" scoring.
"""

import json
from typing import Dict, List, Optional

class ViralCoachKit:
    """
    Modular Viral Coach for Agentic Content Evaluation.
    """
    
    HOOK_PATTERNS = {
        "controversy": [
            "Nobody talks about this, but...",
            "Hot take:",
            "Unpopular opinion:",
            "Everyone's been lying to you about..."
        ],
        "curiosity": [
            "I just discovered something that...",
            "What if I told you...",
            "Here's what nobody tells you about...",
            "The secret to..."
        ],
        "shock": [
            "I can't believe...",
            "This changed everything for me...",
            "Stop what you're doing...",
            "You're doing it wrong..."
        ],
        "story": [
            "So this happened...",
            "Let me tell you about the time...",
            "Story time:",
            "You won't believe what happened..."
        ],
        "listicle": [
            "3 things you need to know about...",
            "Here's 5 reasons why...",
            "Top mistakes people make with...",
            "Do these 3 things and..."
        ]
    }
    
    CTA_PATTERNS = [
        "Follow for more",
        "What do you think?",
        "Comment your experience",
        "Save this for later",
        "Share with someone who needs this"
    ]

    def score_script(self, script: str) -> Dict:
        """
        Lightweight script scoring based on viral heuristics.
        """
        words = script.split()
        word_count = len(words)
        
        hook = " ".join(words[:10]) if word_count >= 10 else script
        hook_score = self._calculate_hook_score(hook)
        retention_score = self._calculate_retention_score(script)
        cta_score = self._calculate_cta_score(script)
        
        overall_score = (hook_score * 0.4 + retention_score * 0.3 + cta_score * 0.3)
        
        return {
            "overall_score": round(overall_score, 1),
            "hook_score": round(hook_score, 1),
            "retention_score": round(retention_score, 1),
            "cta_score": round(cta_score, 1),
            "word_count": word_count,
            "suggestions": self._generate_suggestions(hook_score, retention_score, cta_score)
        }

    def _calculate_hook_score(self, hook: str) -> float:
        score = 5.0
        hook_lower = hook.lower()
        
        for patterns in self.HOOK_PATTERNS.values():
            if any(p.lower().replace("...", "") in hook_lower for p in patterns):
                score += 3.0
                break
        
        if "?" in hook: score += 1.0
        if "you" in hook_lower: score += 1.0
        
        return min(10.0, score)

    def _calculate_retention_score(self, script: str) -> float:
        score = 5.0
        sentences = [s.strip() for s in script.split(".") if s.strip()]
        if not sentences: return 0.0
        
        # Pacing check
        short_sentences = [s for s in sentences if len(s.split()) < 12]
        pacing_ratio = len(short_sentences) / len(sentences)
        score += (pacing_ratio * 3.0)
        
        # Length penalty
        word_count = len(script.split())
        if word_count > 150: score -= 2.0
        
        return min(10.0, max(0.0, score))

    def _calculate_cta_score(self, script: str) -> float:
        score = 2.0
        script_lower = script.lower()
        if any(cta.lower() in script_lower for cta in self.CTA_PATTERNS):
            score += 6.0
        if "?" in script_lower.split(".")[-1]: # Question at end
            score += 2.0
        return min(10.0, score)

    def _generate_suggestions(self, h: float, r: float, c: float) -> List[str]:
        suggestions = []
        if h < 7: suggestions.append("Hook needs more 'felt-sense' impact. Try a story or controversy opening.")
        if r < 7: suggestions.append("Pacing feels slow. Break long sentences into punchy fragments.")
        if c < 7: suggestions.append("Missing a strong CTA. Invite the audience to reflect or follow.")
        return suggestions
