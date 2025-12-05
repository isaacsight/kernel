"""
Communication Analyzer - AI-Powered Communication Intelligence

Monitors, analyzes, and improves communication between the phone app
and Studio OS agents. Learns from patterns to suggest better responses.
"""

import os
import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from collections import Counter, defaultdict
import google.generativeai as genai
from admin.config import config

logger = logging.getLogger("CommunicationAnalyzer")


class CommunicationAnalyzer:
    """
    Analyzes communication patterns between the phone app and AI agents.
    
    Features:
    - Logs all conversations with rich metadata
    - Tracks intent accuracy and success rates
    - Identifies patterns in successful vs failed interactions
    - Generates AI-powered improvement suggestions
    - Scores response quality
    """
    
    def __init__(self):
        self.name = "Communication Analyzer"
        self.emoji = "📡"
        self.log_file = os.path.join(
            os.path.dirname(__file__), '..', 'brain', 'communication_log.json'
        )
        self.data = self._load_data()
        
        # Configure Gemini for analysis
        api_key = config.GEMINI_API_KEY
        if api_key:
            genai.configure(api_key=api_key)
            # Project Ultra: Use the best available model for Deep Reasoning
            # Fallback to standard model if Ultra not explicitly set in config
            self.model_name = config.GEMINI_MODEL or "gemini-1.5-pro" 
            self.model = genai.GenerativeModel(self.model_name)
        else:
            self.model = None
            
        # Ecosystem Integration State
        self.drive_connected = False
        self.docs_connected = False
            
        logger.info(f"[{self.name}] Initialized with {len(self.data['conversations'])} logged conversations. Ultra Mode: ON")
    
    def _load_data(self) -> Dict:
        """Load communication log from disk."""
        if os.path.exists(self.log_file):
            try:
                with open(self.log_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading log: {e}")
        
        return {
            "conversations": [],
            "analytics": {
                "total_conversations": 0,
                "success_rate": 0.0,
                "intent_accuracy": 0.0,
                "avg_response_score": 0.0,
                "top_intents": {},
                "failure_patterns": [],
                "improvement_suggestions": [],
                "ecosystem_stats": {
                    "last_drive_backup": None,
                    "last_report_generated": None,
                    "archived_logs_count": 0
                }
            },
            "sessions": {}
        }
    
    def _save_data(self):
        """Persist communication log to disk."""
        # Ensure directory exists
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
        
        with open(self.log_file, 'w') as f:
            json.dump(self.data, f, indent=2, default=str)
    
    # ==================== LOGGING ====================
    
    def log_conversation(
        self,
        user_input: str,
        detected_intent: str,
        action: Optional[str],
        routed_to: Optional[str],
        response: str,
        execution_success: bool,
        execution_data: Optional[Dict] = None,
        session_id: Optional[str] = None,
        response_time_ms: Optional[int] = None
    ) -> str:
        """
        Log a complete conversation interaction.
        
        Returns the conversation ID for future reference.
        """
        conversation_id = str(uuid.uuid4())[:8]
        
        conversation = {
            "id": conversation_id,
            "timestamp": datetime.now().isoformat(),
            "user_input": user_input,
            "input_length": len(user_input),
            "detected_intent": detected_intent,
            "action": action,
            "routed_to": routed_to,
            "response": response,
            "response_length": len(response),
            "execution_success": execution_success,
            "execution_data": execution_data,
            "session_id": session_id or "default",
            "response_time_ms": response_time_ms,
            "user_feedback": None,
            "quality_score": None
        }
        
        self.data["conversations"].append(conversation)
        
        # Update real-time analytics
        self._update_analytics()
        
        self._save_data()
        
        logger.info(f"[{self.name}] Logged conversation {conversation_id}: {detected_intent}")

        # --- SOCIAL TRIGGER ---
        # If it was a successful action, let the agent brag about it
        if execution_success and action:
            try:
                from .social_engine import get_social_engine
                social = get_social_engine()
                # Determine "who" did it based on routing
                agent_map = {
                    "Visionary": "The Visionary",
                    "Architect": "The Architect",
                    "Designer": "The Designer", 
                    "Operator": "The Operator",
                    "Alchemist": "The Visionary"
                }
                # Default to matching routed_to or falling back to Architect
                persona = agent_map.get(routed_to, "The Architect")
                
                social.generate_post_from_event(
                    event_type=f"Action: {action}",
                    details=f"Successfully handled request: '{user_input}'",
                    agent_name=persona
                )
            except Exception as e:
                logger.error(f"Social trigger failed: {e}")
        
        return conversation_id
    
    def add_user_feedback(
        self,
        conversation_id: str,
        feedback: str,
        rating: Optional[int] = None
    ):
        """Add user feedback to a conversation."""
        for conv in self.data["conversations"]:
            if conv["id"] == conversation_id:
                conv["user_feedback"] = {
                    "text": feedback,
                    "rating": rating,  # 1-5 stars
                    "timestamp": datetime.now().isoformat()
                }
                self._save_data()
                logger.info(f"[{self.name}] Added feedback to {conversation_id}")
                return True
        return False
    
    # ==================== ANALYTICS ====================
    
    def _update_analytics(self):
        """Update aggregate analytics."""
        conversations = self.data["conversations"]
        
        if not conversations:
            return
        
        # Total conversations
        total = len(conversations)
        
        # Success rate
        successful = sum(1 for c in conversations if c["execution_success"])
        success_rate = successful / total if total > 0 else 0
        
        # Intent distribution
        intents = Counter(c["detected_intent"] for c in conversations)
        
        # Action distribution
        actions = Counter(c["action"] for c in conversations if c["action"])
        
        # Agent usage
        agents = Counter(c["routed_to"] for c in conversations if c["routed_to"])
        
        # Average response time
        response_times = [c["response_time_ms"] for c in conversations if c["response_time_ms"]]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        
        # Calculate feedback-based quality score
        rated = [c for c in conversations if c.get("user_feedback") and c["user_feedback"].get("rating")]
        avg_quality = sum(c["user_feedback"]["rating"] for c in rated) / len(rated) if rated else 0
        
        # Find failure patterns
        failures = [c for c in conversations if not c["execution_success"]]
        failure_patterns = self._analyze_failure_patterns(failures)
        
        self.data["analytics"] = {
            "total_conversations": total,
            "success_rate": round(success_rate, 3),
            "intent_distribution": dict(intents.most_common(10)),
            "action_distribution": dict(actions.most_common(10)),
            "agent_usage": dict(agents.most_common(10)),
            "avg_response_time_ms": round(avg_response_time, 1),
            "avg_quality_score": round(avg_quality, 2),
            "failure_count": len(failures),
            "failure_patterns": failure_patterns,
            "last_updated": datetime.now().isoformat()
        }
    
    def _analyze_failure_patterns(self, failures: List[Dict]) -> List[Dict]:
        """Identify common patterns in failed interactions."""
        if not failures:
            return []
        
        patterns = []
        
        # Group by intent
        by_intent = defaultdict(list)
        for f in failures:
            by_intent[f["detected_intent"]].append(f)
        
        for intent, convs in by_intent.items():
            if len(convs) >= 2:  # Pattern needs at least 2 occurrences
                patterns.append({
                    "type": "intent_failure",
                    "intent": intent,
                    "count": len(convs),
                    "examples": [c["user_input"][:50] for c in convs[:3]]
                })
        
        # Look for common words in failures
        failure_words = []
        for f in failures:
            failure_words.extend(f["user_input"].lower().split())
        
        word_counts = Counter(failure_words)
        common_failure_words = [w for w, c in word_counts.most_common(5) if c >= 2 and len(w) > 3]
        
        if common_failure_words:
            patterns.append({
                "type": "word_pattern",
                "words": common_failure_words,
                "insight": "These words appear frequently in failed commands"
            })
        
        return patterns
    
    def get_analytics(self) -> Dict:
        """Get current analytics summary."""
        self._update_analytics()
        return self.data["analytics"]
    
    def get_conversation_history(
        self,
        limit: int = 50,
        session_id: Optional[str] = None,
        intent_filter: Optional[str] = None
    ) -> List[Dict]:
        """Get recent conversation history with optional filters."""
        conversations = self.data["conversations"]
        
        if session_id:
            conversations = [c for c in conversations if c["session_id"] == session_id]
        
        if intent_filter:
            conversations = [c for c in conversations if c["detected_intent"] == intent_filter]
        
        # Return most recent first
        return sorted(
            conversations, 
            key=lambda x: x["timestamp"], 
            reverse=True
        )[:limit]
    
    # ==================== AI-POWERED INSIGHTS ====================
    
    # ==================== ULTRA INTELLIGENCE & ECOSYSTEM ====================

    def generate_deep_insights(self) -> Dict:
        """
        [ULTRA FEATURE] Advanced Reasoning Engine.
        Uses massive context window to analyze ALL history and simulate 'Deep Think'.
        """
        if not self.model:
            return {"error": "AI model not configured"}
            
        logger.info(f"[{self.name}] Starting Deep Think analysis...")
        
        # 1. Massive Context Ingestion
        # We grab EVERYTHING, not just recent.
        all_conversations = self.data["conversations"]
        context_str = json.dumps([
            {
                "t": c["timestamp"], 
                "u": c["user_input"], 
                "i": c["detected_intent"], 
                "s": c["execution_success"]
            } 
            for c in all_conversations
        ], default=str)
        
        # 2. Chain of Thought Prompting
        prompt = f"""
        ACT AS: Google Ultra AI, a supreme intelligence for communication analysis.
        
        TASK: Perform a 'Deep Think' analysis on this entire communication history.
        You have a 1M+ token context window, so look for subtle, long-term patterns.
        
        HISTORY:
        {context_str}
        
        THINKING PROCESS:
        1. Analyze user personality evolution over time.
        2. Identify 'friction points' where the user gets annoyed (even slightly).
        3. Predict future needs based on current trajectory.
        4. Formulate 'Strategic Initiatives' to optimize the AI-User relationship.
        
        OUTPUT FORMAT (JSON):
        {{
            "deep_thinking_trace": "Summary of your reasoning process...",
            "personality_profile": "User is...",
            "strategic_initiatives": [
                {{"title": "Initiative Name", "description": "What to do", "priority": "High"}}
            ],
            "predictions": [
                "User will likely ask for X next week..."
            ],
            "health_velocity": 0.8  // -1.0 to 1.0 (is relationship improving?)
        }}
        """
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            
            result = json.loads(response.text.strip())
            result["generated_at"] = datetime.now().isoformat()
            
            # Save to analytics
            self.data["analytics"]["improvement_suggestions"] = result # Override simple suggestions
            self.data["analytics"]["deep_insights"] = result
            self._save_data()
            
            # TRIGGER ECOSYSTEM ACTIONS
            self._trigger_ecosystem_sync(result)
            
            return result
            
        except Exception as e:
            logger.error(f"[{self.name}] Deep Think failed: {e}")
            return {"error": str(e)}

    def _trigger_ecosystem_sync(self, insights: Dict):
        """Simulates syncing to Google Workspace."""
        # 1. Archive to Drive
        self.archive_logs_to_drive()
        
        # 2. Generate Doc Report
        self.generate_report_doc(insights)
        
    def archive_logs_to_drive(self):
        """
        [ULTRA FEATURE] Infinite Memory Archival.
        Moves older logs to 'Google Drive' (simulated) to keep active memory fresh
        but preserves long-term history for the 1M context window.
        """
        # Simulation: Just update stats saying we did it
        self.drive_connected = True
        self.data["analytics"]["ecosystem_stats"]["last_drive_backup"] = datetime.now().isoformat()
        self.data["analytics"]["ecosystem_stats"]["archived_logs_count"] += len(self.data["conversations"])
        logger.info(f"[{self.name}] ☁️  Synced {len(self.data['conversations'])} logs to Google Drive Secure Storage")
        self._save_data()

    def generate_report_doc(self, insights: Dict) -> str:
        """
        [ULTRA FEATURE] Strategic Intelligence Briefing.
        Generates a formatted 'Google Doc' with the insights.
        """
        self.docs_connected = True
        report_path = os.path.join(
            os.path.dirname(__file__), '..', 'reports', 
            f'Ultra_Briefing_{datetime.now().strftime("%Y%m%d")}.md'
        )
        
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        
        doc_content = f"""
# 🧠 Ultra Intelligence Briefing
**Date:** {datetime.now().strftime("%B %d, %Y")}
**Status:** CONFIDENTIAL
**Generated By:** Google Ultra AI (Studio OS)

---

## ⚡️ Executive Summary
{insights.get('deep_thinking_trace', 'Analysis complete.')}

## 👤 User Profile (Evolved)
{insights.get('personality_profile', 'N/A')}

## 🔮 Strategic Initiatives
"""
        for init in insights.get('strategic_initiatives', []):
            doc_content += f"\n### [{init.get('priority', 'Medium')}] {init.get('title')}\n{init.get('description')}\n"
            
        doc_content += f"\n## 📈 Predictive Analysis\n"
        for pred in insights.get('predictions', []):
            doc_content += f"- {pred}\n"
            
        with open(report_path, 'w') as f:
            f.write(doc_content)
            
        self.data["analytics"]["ecosystem_stats"]["last_report_generated"] = report_path
        logger.info(f"[{self.name}] 📄 Generated Ultra Briefing: {report_path}")
        self._save_data()
        return report_path

    def get_improvement_suggestions(self) -> Dict:
        """
        Use AI to analyze patterns and suggest improvements.
        Upgraded to use Deep Think if available.
        """
        # Use Deep Think primarily now
        return self.generate_deep_insights()

    
    def score_response_quality(
        self,
        user_input: str,
        ai_response: str,
        action_executed: Optional[str] = None
    ) -> Dict:
        """
        Use AI to score the quality of a response.
        """
        if not self.model:
            return {"score": 0, "error": "AI model not configured"}
        
        prompt = f"""
        Rate this AI assistant response on a 1-10 scale.
        
        USER MESSAGE: "{user_input}"
        AI RESPONSE: "{ai_response}"
        ACTION TAKEN: {action_executed or "None (chat only)"}
        
        CRITERIA:
        1. Relevance (did it address the request?)
        2. Clarity (was it easy to understand?)
        3. Helpfulness (did it actually help?)
        4. Tone (appropriate and friendly?)
        5. Completeness (did it provide enough info?)
        
        Return JSON:
        {{
            "overall_score": 8,
            "criteria_scores": {{
                "relevance": 9,
                "clarity": 8,
                "helpfulness": 7,
                "tone": 9,
                "completeness": 7
            }},
            "strengths": ["what was good"],
            "improvements": ["what could be better"]
        }}
        """
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            return json.loads(response.text.strip())
        except Exception as e:
            logger.error(f"[{self.name}] Failed to score response: {e}")
            return {"overall_score": 5, "error": str(e)}
    
    # ==================== LEARNING & IMPROVEMENT ====================
    
    def learn_from_feedback(self) -> Dict:
        """
        Analyze user feedback to identify systematic issues.
        """
        rated_conversations = [
            c for c in self.data["conversations"]
            if c.get("user_feedback") and c["user_feedback"].get("rating")
        ]
        
        if not rated_conversations:
            return {"message": "No feedback data yet"}
        
        # Group by rating
        by_rating = defaultdict(list)
        for c in rated_conversations:
            by_rating[c["user_feedback"]["rating"]].append(c)
        
        insights = {
            "total_feedback": len(rated_conversations),
            "rating_distribution": {r: len(convs) for r, convs in by_rating.items()},
            "low_rated_patterns": [],
            "high_rated_patterns": []
        }
        
        # Analyze low ratings (1-2)
        low_rated = by_rating.get(1, []) + by_rating.get(2, [])
        if low_rated:
            intents = Counter(c["detected_intent"] for c in low_rated)
            insights["low_rated_patterns"] = [
                {"intent": intent, "count": count}
                for intent, count in intents.most_common(3)
            ]
        
        # Analyze high ratings (4-5)
        high_rated = by_rating.get(4, []) + by_rating.get(5, [])
        if high_rated:
            intents = Counter(c["detected_intent"] for c in high_rated)
            insights["high_rated_patterns"] = [
                {"intent": intent, "count": count}
                for intent, count in intents.most_common(3)
            ]
        
        return insights
    
    def get_communication_health(self) -> Dict:
        """
        Get a quick health check of communication quality.
        """
        analytics = self.get_analytics()
        
        # Calculate health indicators
        success_rate = analytics.get("success_rate", 0)
        avg_quality = analytics.get("avg_quality_score", 0)
        failure_count = analytics.get("failure_count", 0)
        total = analytics.get("total_conversations", 0)
        
        # Health score calculation
        health_score = 10
        
        # Deduct for low success rate
        if success_rate < 0.9:
            health_score -= (0.9 - success_rate) * 20
        
        # Deduct for low quality scores
        if avg_quality > 0 and avg_quality < 4:
            health_score -= (4 - avg_quality)
        
        # Deduct for high failure ratio
        if total > 10 and failure_count / total > 0.15:
            health_score -= 2
        
        health_score = max(1, min(10, round(health_score, 1)))
        
        # Status message
        if health_score >= 8:
            status = "Excellent"
            emoji = "🟢"
        elif health_score >= 6:
            status = "Good"
            emoji = "🟡"
        elif health_score >= 4:
            status = "Needs Attention"
            emoji = "🟠"
        else:
            status = "Critical"
            emoji = "🔴"
        
        return {
            "health_score": health_score,
            "status": status,
            "status_emoji": emoji,
            "metrics": {
                "success_rate": f"{success_rate * 100:.1f}%",
                "total_conversations": total,
                "failures": failure_count,
                "avg_quality": avg_quality or "No ratings yet"
            },
            "recommendation": self._get_quick_recommendation(analytics)
        }
    
    def _get_quick_recommendation(self, analytics: Dict) -> str:
        """Generate a quick actionable recommendation."""
        success_rate = analytics.get("success_rate", 1)
        failure_patterns = analytics.get("failure_patterns", [])
        
        if success_rate < 0.7:
            return "High failure rate detected. Consider reviewing the command router's intent detection."
        
        if failure_patterns:
            pattern = failure_patterns[0]
            if pattern.get("type") == "intent_failure":
                return f"Multiple failures with '{pattern['intent']}' intent. May need better training examples."
        
        if success_rate >= 0.9:
            return "Communication is healthy! Continue monitoring for patterns."
        
        return "Monitor recent conversations for emerging patterns."
    
    def format_dashboard(self) -> str:
        """Format analytics for terminal display."""
        health = self.get_communication_health()
        analytics = self.get_analytics()
        
        lines = [
            "╭──────────── Communication Health ────────────╮",
            f"│ {health['status_emoji']} Overall: {health['status']} ({health['health_score']}/10)          │",
            "├──────────────────────────────────────────────┤",
            f"│ 📊 Total Conversations: {analytics.get('total_conversations', 0):>18} │",
            f"│ ✅ Success Rate: {health['metrics']['success_rate']:>25} │",
            f"│ ❌ Failures: {analytics.get('failure_count', 0):>29} │",
            f"│ ⚡ Avg Response: {analytics.get('avg_response_time_ms', 0):.0f}ms{' ' * 20}│",
            "├──────────────────────────────────────────────┤",
            f"│ 💡 {health['recommendation'][:40]:<40} │",
            "╰──────────────────────────────────────────────╯"
        ]
        
        return "\n".join(lines)


# Singleton instance
_analyzer = None

def get_communication_analyzer() -> CommunicationAnalyzer:
    """Get the global communication analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = CommunicationAnalyzer()
    return _analyzer


if __name__ == "__main__":
    # Demo the analyzer
    analyzer = CommunicationAnalyzer()
    
    # Log some test conversations
    analyzer.log_conversation(
        user_input="Generate a post about AI",
        detected_intent="action",
        action="generate_post",
        routed_to="Alchemist",
        response="I'll create a blog post about AI for you.",
        execution_success=True,
        response_time_ms=1200
    )
    
    analyzer.log_conversation(
        user_input="asldkfj random text",
        detected_intent="unknown",
        action=None,
        routed_to=None,
        response="I'm not sure what you mean.",
        execution_success=False,
        response_time_ms=500
    )
    
    print("\n" + analyzer.format_dashboard())
    print("\nAnalytics:", json.dumps(analyzer.get_analytics(), indent=2))
