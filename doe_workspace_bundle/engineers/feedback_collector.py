"""
The Feedback Collector - Centralized Feedback Aggregation

Inspired by Steam's community feedback mechanisms.
Collects, categorizes, and analyzes feedback from multiple sources.
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logger = logging.getLogger("FeedbackCollector")


class FeedbackCollector:
    """
    The Feedback Collector (Voice of the Community)
    
    Mission: Listen to the community and surface actionable insights.
    
    Inspired by Steam's feedback systems:
    - User reviews and comments
    - Discussion forums
    - Community hub
    
    Capabilities:
    - Collect feedback from multiple platforms
    - AI-powered categorization
    - Trending issue detection
    - Weekly digest generation
    """
    
    def __init__(self):
        self.name = "The Feedback Collector"
        self.role = "Community Voice"
        self.emoji = "📢"
        
        # Storage
        self.brain_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'brain'
        )
        self.feedback_file = os.path.join(self.brain_dir, "community_feedback.json")
        self.data = self._load_data()
        
        # Categories
        self.categories = [
            "bug", "feature_request", "usability", 
            "praise", "question", "complaint", "other"
        ]
        
        logger.info(f"[{self.name}] Initialized with {len(self.data['feedback'])} feedback entries")
    
    def _load_data(self) -> Dict:
        """Load feedback data."""
        if os.path.exists(self.feedback_file):
            try:
                with open(self.feedback_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {
            "feedback": [],
            "sources": {},
            "digest_history": []
        }
    
    def _save_data(self):
        """Persist feedback data."""
        os.makedirs(self.brain_dir, exist_ok=True)
        with open(self.feedback_file, 'w') as f:
            json.dump(self.data, f, indent=2)
    
    def collect_feedback(
        self,
        source: str,
        content: str,
        author: str = "anonymous",
        metadata: Dict = None
    ) -> Dict:
        """
        Collect feedback from any source.
        
        Args:
            source: Platform/source (e.g., "twitter", "discord", "email", "blog_comment")
            content: The feedback text
            author: Who submitted it
            metadata: Additional context
        """
        # Auto-categorize based on keywords
        category = self._auto_categorize(content)
        sentiment = self._analyze_sentiment(content)
        
        entry = {
            "id": f"cfb_{len(self.data['feedback']) + 1:05d}",
            "source": source,
            "author": author,
            "content": content,
            "category": category,
            "sentiment": sentiment,
            "metadata": metadata or {},
            "collected_at": datetime.now().isoformat(),
            "status": "new",
            "priority": self._calculate_priority(category, sentiment)
        }
        
        self.data["feedback"].append(entry)
        
        # Track source stats
        if source not in self.data["sources"]:
            self.data["sources"][source] = {"count": 0, "last_collected": None}
        self.data["sources"][source]["count"] += 1
        self.data["sources"][source]["last_collected"] = datetime.now().isoformat()
        
        self._save_data()
        
        logger.info(f"[{self.name}] Collected {category} feedback from {source}: {content[:50]}...")
        return {"success": True, "entry": entry}
    
    def _auto_categorize(self, content: str) -> str:
        """Simple keyword-based categorization."""
        content_lower = content.lower()
        
        if any(word in content_lower for word in ["bug", "error", "broken", "crash", "fix"]):
            return "bug"
        elif any(word in content_lower for word in ["feature", "add", "would be nice", "please add", "wish"]):
            return "feature_request"
        elif any(word in content_lower for word in ["confusing", "hard to", "difficult", "ux", "ui"]):
            return "usability"
        elif any(word in content_lower for word in ["love", "great", "amazing", "awesome", "thanks"]):
            return "praise"
        elif any(word in content_lower for word in ["how", "what", "why", "where", "?"]):
            return "question"
        elif any(word in content_lower for word in ["hate", "terrible", "worst", "disappointed"]):
            return "complaint"
        
        return "other"
    
    def _analyze_sentiment(self, content: str) -> str:
        """Simple sentiment analysis."""
        content_lower = content.lower()
        
        positive_words = ["love", "great", "amazing", "awesome", "thanks", "helpful", "excellent"]
        negative_words = ["hate", "terrible", "worst", "broken", "disappointed", "awful", "frustrating"]
        
        pos_count = sum(1 for word in positive_words if word in content_lower)
        neg_count = sum(1 for word in negative_words if word in content_lower)
        
        if pos_count > neg_count:
            return "positive"
        elif neg_count > pos_count:
            return "negative"
        return "neutral"
    
    def _calculate_priority(self, category: str, sentiment: str) -> str:
        """Calculate priority based on category and sentiment."""
        if category == "bug" and sentiment == "negative":
            return "high"
        elif category in ["bug", "complaint"]:
            return "medium"
        elif category == "feature_request":
            return "medium"
        return "low"
    
    def categorize_feedback(self, feedback_id: str, category: str) -> Dict:
        """Manually recategorize feedback."""
        for fb in self.data["feedback"]:
            if fb["id"] == feedback_id:
                fb["category"] = category
                fb["manually_categorized"] = True
                self._save_data()
                return {"success": True, "feedback": fb}
        return {"success": False, "error": "Feedback not found"}
    
    def get_trending_issues(self, days: int = 7, limit: int = 5) -> List[Dict]:
        """
        Get trending/most mentioned issues.
        
        Inspired by Steam's trending discussions.
        """
        cutoff = datetime.now() - timedelta(days=days)
        recent = [
            fb for fb in self.data["feedback"]
            if datetime.fromisoformat(fb["collected_at"]) > cutoff
        ]
        
        # Count by category
        category_counts = defaultdict(list)
        for fb in recent:
            if fb["category"] in ["bug", "feature_request", "complaint", "usability"]:
                category_counts[fb["category"]].append(fb)
        
        # Get top issues
        trending = []
        for category, items in sorted(category_counts.items(), key=lambda x: len(x[1]), reverse=True):
            if items:
                trending.append({
                    "category": category,
                    "count": len(items),
                    "sample": items[0]["content"][:100],
                    "priority": max(fb["priority"] for fb in items)
                })
        
        return trending[:limit]
    
    def generate_feedback_digest(self) -> Dict:
        """
        Generate a weekly feedback digest for the team.
        
        Inspired by Steam's developer analytics dashboard.
        """
        week_ago = datetime.now() - timedelta(days=7)
        week_feedback = [
            fb for fb in self.data["feedback"]
            if datetime.fromisoformat(fb["collected_at"]) > week_ago
        ]
        
        # Compile stats
        by_category = defaultdict(int)
        by_sentiment = defaultdict(int)
        by_source = defaultdict(int)
        
        for fb in week_feedback:
            by_category[fb["category"]] += 1
            by_sentiment[fb["sentiment"]] += 1
            by_source[fb["source"]] += 1
        
        # High priority items
        action_items = [
            fb for fb in week_feedback
            if fb["priority"] == "high" and fb["status"] == "new"
        ]
        
        digest = {
            "generated_at": datetime.now().isoformat(),
            "period": "last_7_days",
            "total_feedback": len(week_feedback),
            "by_category": dict(by_category),
            "by_sentiment": dict(by_sentiment),
            "by_source": dict(by_source),
            "trending_issues": self.get_trending_issues(days=7),
            "action_items": action_items[:10],
            "highlights": {
                "most_active_source": max(by_source.items(), key=lambda x: x[1])[0] if by_source else None,
                "sentiment_ratio": round(
                    by_sentiment.get("positive", 0) / max(len(week_feedback), 1), 2
                )
            }
        }
        
        # Save to history
        self.data["digest_history"].append({
            "generated_at": digest["generated_at"],
            "total_feedback": digest["total_feedback"]
        })
        self._save_data()
        
        logger.info(f"[{self.name}] 📊 Weekly digest generated: {digest['total_feedback']} items analyzed")
        return digest
    
    def get_feedback(
        self,
        category: str = None,
        source: str = None,
        status: str = None,
        limit: int = 50
    ) -> List[Dict]:
        """Get filtered feedback entries."""
        results = self.data["feedback"]
        
        if category:
            results = [fb for fb in results if fb["category"] == category]
        if source:
            results = [fb for fb in results if fb["source"] == source]
        if status:
            results = [fb for fb in results if fb["status"] == status]
        
        return sorted(results, key=lambda x: x["collected_at"], reverse=True)[:limit]
    
    def mark_addressed(self, feedback_id: str, notes: str = "") -> Dict:
        """Mark feedback as addressed."""
        for fb in self.data["feedback"]:
            if fb["id"] == feedback_id:
                fb["status"] = "addressed"
                fb["addressed_at"] = datetime.now().isoformat()
                fb["resolution_notes"] = notes
                self._save_data()
                return {"success": True}
        return {"success": False, "error": "Feedback not found"}
    
    def get_summary(self) -> Dict:
        """Get overall feedback summary."""
        return {
            "total_feedback": len(self.data["feedback"]),
            "sources_tracked": len(self.data["sources"]),
            "digests_generated": len(self.data["digest_history"]),
            "new_items": len([fb for fb in self.data["feedback"] if fb["status"] == "new"]),
            "high_priority": len([fb for fb in self.data["feedback"] if fb["priority"] == "high"])
        }


# Singleton
_collector = None

def get_feedback_collector() -> FeedbackCollector:
    """Get the global feedback collector instance."""
    global _collector
    if _collector is None:
        _collector = FeedbackCollector()
    return _collector


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    collector = FeedbackCollector()
    
    # Demo
    print(f"\n=== {collector.name} {collector.emoji} ===\n")
    
    # Collect some sample feedback
    collector.collect_feedback(
        source="twitter",
        content="Love the new design! Amazing work on the animations.",
        author="@happy_user"
    )
    
    collector.collect_feedback(
        source="discord",
        content="Found a bug: the navigation breaks on mobile when rotating the screen.",
        author="bug_hunter"
    )
    
    collector.collect_feedback(
        source="email",
        content="Would be nice to have dark mode support for the blog.",
        author="night_reader@email.com"
    )
    
    print(f"Summary: {collector.get_summary()}")
    print(f"\nTrending Issues: {collector.get_trending_issues()}")
