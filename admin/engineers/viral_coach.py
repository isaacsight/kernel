"""
The Viral Coach - Content Optimization Agent

Analyzes TikTok scripts and content for viral potential,
providing scores and actionable improvements based on viral patterns.
"""

import os
import sys
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from config import config

logger = logging.getLogger("ViralCoach")


class ViralCoach:
    """
    The Viral Coach (Content Optimization Specialist)
    
    Mission: Maximize content viral potential before posting.
    
    Inspired by Blotato's "AI Coach trained on 1M+ viral hits".
    Analyzes hooks, retention patterns, and CTAs.
    """
    
    # Viral hook patterns that perform well on TikTok
    HOOK_PATTERNS = {
        "controversy": [
            "Nobody talks about this, but...",
            "Hot take:",
            "Unpopular opinion:",
            "I'm going to get hate for this, but...",
            "Everyone's been lying to you about..."
        ],
        "curiosity": [
            "I just discovered something that...",
            "What if I told you...",
            "Here's what nobody tells you about...",
            "The secret to...",
            "I found out why..."
        ],
        "shock": [
            "I can't believe...",
            "This changed everything for me...",
            "Stop what you're doing...",
            "You're doing it wrong...",
            "The truth about..."
        ],
        "story": [
            "So this happened...",
            "Let me tell you about the time...",
            "Story time:",
            "I need to share this...",
            "You won't believe what happened..."
        ],
        "listicle": [
            "3 things you need to know about...",
            "Here's 5 reasons why...",
            "Top mistakes people make with...",
            "The only 3 things that matter for...",
            "Do these 3 things and..."
        ]
    }
    
    # CTA patterns for engagement
    CTA_PATTERNS = [
        "Follow for more",
        "What do you think?",
        "Comment your experience",
        "Save this for later",
        "Share with someone who needs this",
        "Link in bio",
        "Part 2?"
    ]
    
    
    def __init__(self):
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        
        # INTELLIGENCE UPGRADE
        from admin.brain.model_router import get_model_router
        from admin.engineers.contrarian import Contrarian
        self.model_router = get_model_router()
        self.contrarian = Contrarian()

    def analyze_tiktok_script(self, script: str, hook_style: str = "auto") -> Dict:
        """
        Analyzes a TikTok script and returns viral potential scores.
        Now includes Trend Awareness via TrendScout.
        """
        # Import TrendScout (lazy import to avoid circular deps if any)
        from admin.engineers.trend_scout import TrendScout
        scout = TrendScout()
        
        # Strip YAML frontmatter if present
        if script.strip().startswith("---"):
            try:
                parts = script.split("---", 2)
                if len(parts) >= 3:
                    script = parts[2].strip()
            except Exception:
                pass

        words = script.split()
        word_count = len(words)
        
        # Analyze hook (first 10 words)
        hook = " ".join(words[:10]) if word_count >= 10 else script
        hook_score = self._score_hook(hook)
        
        # Analyze retention (structure and pacing)
        retention_score = self._score_retention(script)
        
        # Analyze CTA
        cta_score = self._score_cta(script)
        
        # Analyze Trends (New)
        trend_report = scout.check_relevance(script)
        trend_score = trend_report["score"] * 10.0 # Convert 0-1 to 0-10
        
        # Calculate overall viral score (Weighted)
        # Hook: 35%, Retention: 30%, CTA: 20%, Trends: 15%
        overall_score = (hook_score * 0.35 + retention_score * 0.30 + cta_score * 0.20 + trend_score * 0.15)
        
        # Generate suggestions
        suggestions = self._generate_suggestions(
            script, hook_score, retention_score, cta_score, hook_style
        )
        
        # Add trend suggestion from Memory (New)
        trend_suggestion = self.suggest_trending_angle(script)
        if trend_suggestion:
            suggestions.append(f"Trend Pivot: {trend_suggestion}")
        
        # Add trend suggestion if missing (Old fallback)
        if trend_score < 5.0 and not trend_suggestion:
            suggestions.append(f"Trend Alert: {trend_report['suggestion']}")
        
        # Recommend hook style if auto
        recommended_style = self._recommend_hook_style(script) if hook_style == "auto" else hook_style
        
        # Generate Improved Hook (AI Powered)
        improved_hook = self._generate_ai_hook(script, recommended_style)
        
        # Generate Roast (Adversarial)
        roast = self.roast_script(script)

        result = {
            "hook_score": round(hook_score, 1),
            "retention_score": round(retention_score, 1),
            "cta_score": round(cta_score, 1),
            "trend_score": round(trend_score, 1),
            "overall_score": round(overall_score, 1),
            "word_count": word_count,
            "estimated_duration_seconds": word_count / 2.5,  # ~150 words/min speaking rate
            "recommended_hook_style": recommended_style,
            "suggestions": suggestions,
            "improved_hook": improved_hook,
            "trend_context": trend_report["hits"],
            "roast": roast
        }
        
        # Log for learning
        self.metrics.log_event("viral_coach", {"action": "script_analyzed", "result": result})
        
        return result
    
    def _score_hook(self, hook: str) -> float:
        """Scores the hook on a 0-10 scale."""
        score = 5.0  # Base score
        hook_lower = hook.lower()
        
        # Check for pattern matches
        for style, patterns in self.HOOK_PATTERNS.items():
            for pattern in patterns:
                if pattern.lower().replace("...", "") in hook_lower:
                    score += 2.0
                    break
        
        # Bonus for questions (engagement)
        if "?" in hook:
            score += 1.0
            
        # Bonus for "you" (personal connection)
        if "you" in hook_lower:
            score += 0.5
            
        # Penalty for generic starts
        generic_starts = ["hi", "hello", "hey everyone", "today i want to"]
        if any(hook_lower.startswith(g) for g in generic_starts):
            score -= 2.0
            
        return min(10.0, max(0.0, score))
    
    def _score_retention(self, script: str) -> float:
        """Scores retention potential on a 0-10 scale."""
        score = 5.0
        
        # Break into sentences
        sentences = [s.strip() for s in script.replace("?", "?.").replace("!", "!.").split(".") if s.strip()]
        
        # Bonus for short punchy sentences
        short_sentences = [s for s in sentences if len(s.split()) < 10]
        if len(short_sentences) / max(len(sentences), 1) > 0.5:
            score += 1.5
            
        # Bonus for questions throughout (keeps engagement)
        question_count = script.count("?")
        if question_count >= 2:
            score += 1.0
        elif question_count >= 1:
            score += 0.5
            
        # Bonus for "open loops" (story elements)
        open_loop_markers = ["but", "however", "then", "suddenly", "until", "finally"]
        loop_count = sum(1 for marker in open_loop_markers if marker in script.lower())
        score += min(loop_count * 0.3, 1.5)
        
        # Penalty for being too long
        word_count = len(script.split())
        if word_count > 100:
            score -= 1.0
        if word_count > 150:
            score -= 1.5
            
        return min(10.0, max(0.0, score))
    
    def _score_cta(self, script: str) -> float:
        """Scores call-to-action on a 0-10 scale."""
        score = 3.0  # Base (no CTA = 3)
        script_lower = script.lower()
        
        # Check for CTA patterns
        for cta in self.CTA_PATTERNS:
            if cta.lower() in script_lower:
                score += 3.0
                break
        
        # Bonus for questions at the end (engagement CTA)
        sentences = script.split(".")
        if sentences and "?" in sentences[-1]:
            score += 2.0
            
        # Bonus for "follow" or "comment"
        if "follow" in script_lower or "comment" in script_lower:
            score += 1.5
            
        return min(10.0, max(0.0, score))
    
    def _recommend_hook_style(self, script: str) -> str:
        """Recommends the best hook style based on content."""
        script_lower = script.lower()
        
        # Detect content type
        if any(word in script_lower for word in ["steps", "tips", "things", "reasons", "ways"]):
            return "listicle"
        elif any(word in script_lower for word in ["story", "happened", "time when", "experience"]):
            return "story"
        elif any(word in script_lower for word in ["truth", "wrong", "lie", "myth"]):
            return "controversy"
        elif any(word in script_lower for word in ["secret", "discovered", "found", "realized"]):
            return "curiosity"
        else:
            return "curiosity"  # Default to curiosity (safest viral pattern)
    
    def _generate_suggestions(self, script: str, hook_score: float, 
                             retention_score: float, cta_score: float,
                             hook_style: str) -> List[str]:
        """Generates specific improvement suggestions."""
        suggestions = []
        
        if hook_score < 7:
            suggestions.append(f"Strengthen your hook - try a '{hook_style}' style opening")
            
        if retention_score < 7:
            if len(script.split()) > 100:
                suggestions.append("Script is long - cut to under 100 words for better retention")
            suggestions.append("Add a question at second 3-5 to create an 'open loop'")
            
        if cta_score < 6:
            suggestions.append("Add a clear CTA at the end (e.g., 'Follow for more' or ask a question)")
            
        if script.count("?") < 2:
            suggestions.append("Add more questions to boost engagement")
            
        if not suggestions:
            suggestions.append("Script looks solid! Consider A/B testing different hooks")
            
        return suggestions
    
    def _generate_ai_hook(self, script: str, style: str) -> str:
        """
        Uses LLM to generate a creative hook based on the script.
        """
        # Force Gemini Flash for Zero Cost
        model = {
            "selected": "gemini-2.0-flash",
            "provider": "google",
            "type": "cloud_free"
        }
        
        prompt = f"""
        You are an Expert Content Creator.
        
        Script Topic: {script[:200]}...
        Target Style: {style}
        
        Task: Write ONE viral opening hook/sentence for this script.
        Rules:
        - Must be under 15 words.
        - Must create immediate curiosity or emotion.
        - Do NOT use generic starts like "Hey guys".
        - Style guidance: {self.HOOK_PATTERNS.get(style, ["Make it punchy"])[0]}
        
        Output ONLY the hook text.
        """
        
        try:
            return self.contrarian._call_llm(model, prompt).strip('"')
        except:
             return self._generate_improved_hook_legacy(script, style)

    def _generate_improved_hook_legacy(self, script: str, style: str) -> str:
        """Generates an improved hook for the script (Template Fallback)."""
        # Get first sentence (the "topic")
        first_sentence = script.split(".")[0] if "." in script else script[:50]
        
        # Map style to pattern
        patterns = self.HOOK_PATTERNS.get(style, self.HOOK_PATTERNS["curiosity"])
        pattern = patterns[0]  # Use first pattern as template
        
        # Simple improvement: use pattern + topic hint
        topic_words = first_sentence.split()[:5]
        topic_hint = " ".join(topic_words)
        
        return f"{pattern} {topic_hint}..."
    
    def suggest_trending_angle(self, script: str) -> Optional[str]:
        """Checks Memory for recent research insights to pivot the script."""
        insights = self.memory.get_insights("research_report", min_confidence=0.8)
        if not insights:
            return None
            
        # Find most relevant insight (simple string matching for now)
        # Ideally we use vector search, but this is a lightweight check
        for insight in insights[:2]:
            topic = insight['data'].get("topic", "")
            if topic: 
                return f"Mention '{topic}' (Recent Research: {insight['data'].get('summary')[:30]}...)"
        return None

    def roast_script(self, script: str) -> str:
        """
        Uses The Contrarian to roast the script for boredom/cringe.
        """
        prompt = f"""
        ROAST THIS SCRIPT.
        
        Script: "{script[:500]}"
        
        Tell me exactly why a viewer would scroll past this. 
        Be harsh but constructive. Focus on the first 3 seconds.
        Limit to 2 sentences.
        """
        
        # Force Gemini Flash for Zero Cost
        model = {
            "selected": "gemini-2.0-flash",
            "provider": "google",
            "type": "cloud_free"
        }
        
        try:
            return self.contrarian._call_llm(model, prompt).strip()
        except:
            return "Roast failed (Contrarian offline)."

    def improve_script(self, script: str, target_score: float = 8.0) -> Dict:
        """
        Attempts to improve a script to meet target viral score.
        """
        # Analyze original
        original_analysis = self.analyze_tiktok_script(script)
        
        if original_analysis["overall_score"] >= target_score:
            return {
                "improved": False,
                "original_script": script,
                "original_analysis": original_analysis,
                "message": "Script already meets target score!"
            }
        
        # Build improved version
        improved_script = script
        style = original_analysis["recommended_hook_style"]
        
        # Improve hook (Using AI Hook now)
        if original_analysis["hook_score"] < 7:
            improved_hook = original_analysis["improved_hook"] # Now AI generated
            # Replace first sentence
            sentences = script.split(".", 1)
            if len(sentences) > 1:
                improved_script = improved_hook + sentences[1]
        
        # Add CTA if missing
        if original_analysis["cta_score"] < 6:
            improved_script += "\n\nWhat do you think? Let me know in the comments."
        
        # Re-analyze
        improved_analysis = self.analyze_tiktok_script(improved_script)
        
        return {
            "improved": True,
            "original_script": script,
            "improved_script": improved_script,
            "original_analysis": original_analysis,
            "improved_analysis": improved_analysis,
            "score_improvement": improved_analysis["overall_score"] - original_analysis["overall_score"]
        }


# Quick access function
def get_viral_coach() -> ViralCoach:
    return ViralCoach()


if __name__ == "__main__":
    coach = ViralCoach()
    
    # Test with a sample script
    test_script = """
    Today I want to talk about finding stillness in a noisy world.
    We're constantly bombarded with notifications and messages.
    But here's what I've learned: taking just 5 minutes of silence
    each day can completely transform your mental clarity.
    Try it and see what happens.
    """
    
    print("=== Viral Coach Analysis ===\n")
    analysis = coach.analyze_tiktok_script(test_script.strip())
    print(json.dumps(analysis, indent=2))
    
    print("\n=== Improvement Attempt ===\n")
    improved = coach.improve_script(test_script.strip())
    if improved["improved"]:
        print(f"Original Score: {improved['original_analysis']['overall_score']}")
        print(f"Improved Score: {improved['improved_analysis']['overall_score']}")
        print(f"\nImproved Script:\n{improved['improved_script']}")
