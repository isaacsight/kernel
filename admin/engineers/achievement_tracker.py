"""
Achievement Tracker - Gamification and Milestones

Inspired by Steam's Achievement system.
Tracks accomplishments and provides gamified motivation.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict

logger = logging.getLogger("AchievementTracker")


# Achievement definitions
ACHIEVEMENTS = {
    # Content Creation
    "first_words": {
        "name": "First Words",
        "description": "Publish your first blog post",
        "icon": "📝",
        "category": "content",
        "secret": False,
        "points": 10
    },
    "prolific_writer": {
        "name": "Prolific Writer",
        "description": "Publish 50 blog posts",
        "icon": "✍️",
        "category": "content",
        "secret": False,
        "points": 100
    },
    "century_club": {
        "name": "Century Club",
        "description": "Publish 100 blog posts",
        "icon": "💯",
        "category": "content",
        "secret": False,
        "points": 200
    },
    
    # Consistency
    "streak_7": {
        "name": "Week Warrior",
        "description": "Post 7 days in a row",
        "icon": "🔥",
        "category": "consistency",
        "secret": False,
        "points": 50
    },
    "streak_30": {
        "name": "Monthly Master",
        "description": "Post 30 days in a row",
        "icon": "🌟",
        "category": "consistency",
        "secret": False,
        "points": 150
    },
    
    # Time-based
    "night_owl": {
        "name": "Night Owl",
        "description": "Publish a post after midnight",
        "icon": "🦉",
        "category": "time",
        "secret": False,
        "points": 15
    },
    "early_bird": {
        "name": "Early Bird",
        "description": "Publish a post before 6 AM",
        "icon": "🐦",
        "category": "time",
        "secret": False,
        "points": 15
    },
    "weekend_warrior": {
        "name": "Weekend Warrior",
        "description": "Publish posts on 10 weekends",
        "icon": "🎉",
        "category": "time",
        "secret": False,
        "points": 30
    },
    
    # AI Collaboration
    "ai_whisperer": {
        "name": "AI Whisperer",
        "description": "Generate 100 posts with AI",
        "icon": "🤖",
        "category": "ai",
        "secret": False,
        "points": 100
    },
    "model_master": {
        "name": "Model Master",
        "description": "Use 5 different AI models",
        "icon": "🎛️",
        "category": "ai",
        "secret": False,
        "points": 50
    },
    "alchemist_friend": {
        "name": "Alchemist's Friend",
        "description": "Generate 10 posts in one day",
        "icon": "⚗️",
        "category": "ai",
        "secret": False,
        "points": 40
    },
    
    # Quality
    "guardian_approved": {
        "name": "Squeaky Clean",
        "description": "Pass 50 Guardian audits with no issues",
        "icon": "✨",
        "category": "quality",
        "secret": False,
        "points": 75
    },
    "editor_favorite": {
        "name": "Editor's Favorite",
        "description": "Get perfect scores from the Editor 10 times",
        "icon": "💎",
        "category": "quality",
        "secret": False,
        "points": 60
    },
    
    # System
    "evolution_master": {
        "name": "Evolution Master",
        "description": "Complete 10 evolution cycles",
        "icon": "🧬",
        "category": "system",
        "secret": False,
        "points": 100
    },
    "deployment_pro": {
        "name": "Deployment Pro",
        "description": "Successfully deploy 25 times",
        "icon": "🚀",
        "category": "system",
        "secret": False,
        "points": 50
    },
    "time_traveler": {
        "name": "Time Traveler",
        "description": "Use rollback feature successfully",
        "icon": "⏪",
        "category": "system",
        "secret": False,
        "points": 25
    },
    
    # Secret Achievements
    "midnight_marathon": {
        "name": "Midnight Marathon",
        "description": "Generate 5 posts between midnight and 4 AM",
        "icon": "🌙",
        "category": "secret",
        "secret": True,
        "points": 100
    },
    "comeback_kid": {
        "name": "Comeback Kid",
        "description": "Break a 7+ day gap with a new post",
        "icon": "🔄",
        "category": "secret",
        "secret": True,
        "points": 30
    },
    "pioneer": {
        "name": "Pioneer",
        "description": "Be among the first 100 users",
        "icon": "🏆",
        "category": "secret",
        "secret": True,
        "points": 200
    }
}


class AchievementTracker:
    """
    The Achievement Tracker (Gamification Engine)
    
    Mission: Gamify the content creation process with achievements,
    milestones, and motivation.
    
    Inspired by Steam's Achievement system.
    
    Responsibilities:
    - Track progress toward achievements
    - Unlock achievements when criteria are met
    - Provide motivation through gamification
    - Display achievement progress
    """
    
    def __init__(self):
        self.name = "The Achievement Tracker"
        self.role = "Gamification Engine"
        self.emoji = "🏆"
        
        # Storage path
        self.data_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'brain', 'achievements.json'
        )
        
        # Load data
        self.data = self._load_data()
        
        logger.info(f"[{self.name}] Initialized with {len(self.data['unlocked'])} achievements unlocked")
    
    def _load_data(self) -> Dict:
        """Load achievement data from disk."""
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {
            "unlocked": {},
            "progress": {},
            "stats": {
                "posts_created": 0,
                "ai_generations": 0,
                "deployments": 0,
                "evolution_cycles": 0,
                "guardian_clean_audits": 0,
                "editor_perfect_scores": 0,
                "current_streak": 0,
                "best_streak": 0,
                "last_post_date": None,
                "models_used": [],
                "weekend_posts": 0
            },
            "total_points": 0
        }
    
    def _save_data(self):
        """Save achievement data to disk."""
        os.makedirs(os.path.dirname(self.data_file), exist_ok=True)
        with open(self.data_file, 'w') as f:
            json.dump(self.data, f, indent=2)
    
    def _unlock(self, achievement_id: str) -> Optional[Dict]:
        """Unlock an achievement and return its data."""
        if achievement_id in self.data["unlocked"]:
            return None  # Already unlocked
        
        if achievement_id not in ACHIEVEMENTS:
            return None  # Unknown achievement
        
        achievement = ACHIEVEMENTS[achievement_id]
        
        self.data["unlocked"][achievement_id] = {
            "unlocked_at": datetime.now().isoformat(),
            "points": achievement["points"]
        }
        self.data["total_points"] += achievement["points"]
        self._save_data()
        
        logger.info(f"[{self.name}] 🎉 Achievement unlocked: {achievement['name']}")
        return achievement
    
    def record_post_created(self, is_ai_generated: bool = False, model_used: str = None):
        """Record that a post was created."""
        stats = self.data["stats"]
        stats["posts_created"] += 1
        
        if is_ai_generated:
            stats["ai_generations"] += 1
        
        if model_used and model_used not in stats["models_used"]:
            stats["models_used"].append(model_used)
        
        # Check time-based achievements
        now = datetime.now()
        hour = now.hour
        
        if hour >= 0 and hour < 6:
            self._unlock("night_owl")
            if hour < 4:
                # Track for midnight_marathon
                if "midnight_posts" not in stats:
                    stats["midnight_posts"] = 0
                stats["midnight_posts"] += 1
                if stats["midnight_posts"] >= 5:
                    self._unlock("midnight_marathon")
        
        if hour >= 5 and hour < 6:
            self._unlock("early_bird")
        
        if now.weekday() >= 5:  # Saturday or Sunday
            stats["weekend_posts"] += 1
            if stats["weekend_posts"] >= 10:
                self._unlock("weekend_warrior")
        
        # Streak tracking
        today = now.date().isoformat()
        last_post = stats.get("last_post_date")
        
        if last_post:
            last_date = datetime.fromisoformat(last_post).date()
            days_diff = (now.date() - last_date).days
            
            if days_diff == 1:
                stats["current_streak"] += 1
            elif days_diff > 1:
                if days_diff > 7 and stats["current_streak"] == 0:
                    self._unlock("comeback_kid")
                stats["current_streak"] = 1
            # Same day doesn't break streak
        else:
            stats["current_streak"] = 1
        
        stats["best_streak"] = max(stats["best_streak"], stats["current_streak"])
        stats["last_post_date"] = today
        
        # Check achievements
        newly_unlocked = []
        
        if stats["posts_created"] == 1:
            if self._unlock("first_words"):
                newly_unlocked.append("first_words")
        
        if stats["posts_created"] >= 50:
            if self._unlock("prolific_writer"):
                newly_unlocked.append("prolific_writer")
        
        if stats["posts_created"] >= 100:
            if self._unlock("century_club"):
                newly_unlocked.append("century_club")
        
        if stats["current_streak"] >= 7:
            if self._unlock("streak_7"):
                newly_unlocked.append("streak_7")
        
        if stats["current_streak"] >= 30:
            if self._unlock("streak_30"):
                newly_unlocked.append("streak_30")
        
        if stats["ai_generations"] >= 100:
            if self._unlock("ai_whisperer"):
                newly_unlocked.append("ai_whisperer")
        
        if len(stats["models_used"]) >= 5:
            if self._unlock("model_master"):
                newly_unlocked.append("model_master")
        
        self._save_data()
        return newly_unlocked
    
    def record_deployment(self):
        """Record a successful deployment."""
        self.data["stats"]["deployments"] += 1
        
        if self.data["stats"]["deployments"] >= 25:
            self._unlock("deployment_pro")
        
        self._save_data()
    
    def record_evolution_cycle(self):
        """Record a completed evolution cycle."""
        self.data["stats"]["evolution_cycles"] += 1
        
        if self.data["stats"]["evolution_cycles"] >= 10:
            self._unlock("evolution_master")
        
        self._save_data()
    
    def record_clean_audit(self):
        """Record a clean Guardian audit."""
        self.data["stats"]["guardian_clean_audits"] += 1
        
        if self.data["stats"]["guardian_clean_audits"] >= 50:
            self._unlock("guardian_approved")
        
        self._save_data()
    
    def record_rollback(self):
        """Record use of rollback feature."""
        self._unlock("time_traveler")
        self._save_data()
    
    def get_unlocked(self) -> List[Dict]:
        """Get list of unlocked achievements."""
        unlocked = []
        for achievement_id, data in self.data["unlocked"].items():
            if achievement_id in ACHIEVEMENTS:
                achievement = ACHIEVEMENTS[achievement_id].copy()
                achievement["id"] = achievement_id
                achievement["unlocked_at"] = data["unlocked_at"]
                unlocked.append(achievement)
        
        return sorted(unlocked, key=lambda x: x["unlocked_at"], reverse=True)
    
    def get_locked(self, include_secret: bool = False) -> List[Dict]:
        """Get list of locked achievements."""
        locked = []
        for achievement_id, achievement in ACHIEVEMENTS.items():
            if achievement_id not in self.data["unlocked"]:
                if achievement["secret"] and not include_secret:
                    continue
                ach = achievement.copy()
                ach["id"] = achievement_id
                locked.append(ach)
        
        return locked
    
    def get_progress(self, achievement_id: str) -> Optional[Dict]:
        """Get progress toward a specific achievement."""
        if achievement_id not in ACHIEVEMENTS:
            return None
        
        achievement = ACHIEVEMENTS[achievement_id]
        stats = self.data["stats"]
        
        progress = {
            "achievement": achievement,
            "unlocked": achievement_id in self.data["unlocked"]
        }
        
        # Calculate progress based on achievement type
        if achievement_id == "prolific_writer":
            progress["current"] = stats["posts_created"]
            progress["target"] = 50
        elif achievement_id == "century_club":
            progress["current"] = stats["posts_created"]
            progress["target"] = 100
        elif achievement_id == "streak_7":
            progress["current"] = stats["current_streak"]
            progress["target"] = 7
        elif achievement_id == "streak_30":
            progress["current"] = stats["current_streak"]
            progress["target"] = 30
        elif achievement_id == "ai_whisperer":
            progress["current"] = stats["ai_generations"]
            progress["target"] = 100
        elif achievement_id == "model_master":
            progress["current"] = len(stats["models_used"])
            progress["target"] = 5
        elif achievement_id == "deployment_pro":
            progress["current"] = stats["deployments"]
            progress["target"] = 25
        elif achievement_id == "evolution_master":
            progress["current"] = stats["evolution_cycles"]
            progress["target"] = 10
        elif achievement_id == "guardian_approved":
            progress["current"] = stats["guardian_clean_audits"]
            progress["target"] = 50
        else:
            progress["current"] = 0
            progress["target"] = 1
        
        progress["percentage"] = min(100, int((progress["current"] / progress["target"]) * 100))
        
        return progress
    
    def get_summary(self) -> Dict:
        """Get achievement summary."""
        total = len(ACHIEVEMENTS)
        unlocked = len(self.data["unlocked"])
        secret_count = sum(1 for a in ACHIEVEMENTS.values() if a["secret"])
        
        return {
            "total_achievements": total,
            "unlocked": unlocked,
            "locked": total - unlocked,
            "completion_percentage": int((unlocked / total) * 100),
            "total_points": self.data["total_points"],
            "stats": self.data["stats"],
            "secret_achievements": secret_count
        }
    
    def format_for_display(self) -> str:
        """Format achievements for terminal display."""
        lines = ["╭─── Achievements ───╮"]
        
        summary = self.get_summary()
        lines.append(f"│ 🏆 {summary['unlocked']}/{summary['total_achievements']} Unlocked ({summary['completion_percentage']}%)")
        lines.append(f"│ ⭐ {summary['total_points']} Points")
        lines.append("├────────────────────┤")
        
        for ach in self.get_unlocked()[:5]:
            lines.append(f"│ {ach['icon']} {ach['name']}")
        
        lines.append("╰────────────────────╯")
        return "\n".join(lines)

    # ============================================================
    # Steam-Inspired Engagement Features
    # ============================================================
    
    def get_close_achievements(self, threshold: float = 0.8) -> List[Dict]:
        """
        Get achievements that are close to being unlocked.
        
        Inspired by Steam's "Almost There" notifications.
        """
        close = []
        
        for achievement_id in ACHIEVEMENTS.keys():
            if achievement_id in self.data["unlocked"]:
                continue
            
            progress = self.get_progress(achievement_id)
            if progress and progress["percentage"] >= threshold * 100:
                close.append({
                    "id": achievement_id,
                    "name": progress["achievement"]["name"],
                    "icon": progress["achievement"]["icon"],
                    "current": progress["current"],
                    "target": progress["target"],
                    "percentage": progress["percentage"],
                    "remaining": progress["target"] - progress["current"]
                })
        
        return sorted(close, key=lambda x: x["percentage"], reverse=True)
    
    def generate_motivation_message(self) -> str:
        """
        Generate a motivational message about nearby achievements.
        
        Inspired by Steam's "You're close to..." notifications.
        """
        close = self.get_close_achievements(threshold=0.6)
        
        if not close:
            return "🎯 Keep going! New achievements await on your journey."
        
        # Pick the closest one
        nearest = close[0]
        remaining = nearest["remaining"]
        
        messages = [
            f"🔥 You're just **{remaining}** away from '{nearest['name']}'!",
            f"⭐ Almost there! Only **{remaining}** more to unlock '{nearest['name']}'.",
            f"🎮 {nearest['icon']} '{nearest['name']}' is within reach — just **{remaining}** to go!",
        ]
        
        import random
        return random.choice(messages)
    
    def streak_reminder(self) -> Optional[Dict]:
        """
        Check streak status and generate reminder if at risk.
        
        Inspired by Steam's daily login/activity streaks.
        """
        stats = self.data["stats"]
        last_post = stats.get("last_post_date")
        
        if not last_post:
            return {
                "status": "no_streak",
                "message": "🚀 Start your streak today! Post your first content."
            }
        
        last_date = datetime.fromisoformat(last_post).date()
        today = datetime.now().date()
        days_since = (today - last_date).days
        
        current_streak = stats.get("current_streak", 0)
        
        if days_since == 0:
            return {
                "status": "active",
                "streak": current_streak,
                "message": f"🔥 Streak active! Day {current_streak} — keep it going!"
            }
        elif days_since == 1:
            return {
                "status": "at_risk",
                "streak": current_streak,
                "message": f"⚠️ Post today to maintain your {current_streak}-day streak!"
            }
        else:
            return {
                "status": "broken",
                "previous_streak": current_streak,
                "gap_days": days_since,
                "message": f"💔 Streak broken after {current_streak} days. Start fresh today!"
            }
    
    def get_daily_quests(self) -> List[Dict]:
        """
        Generate daily quests for short-term engagement.
        
        Inspired by Steam's daily challenges and quests.
        """
        stats = self.data["stats"]
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Initialize daily quest tracking if needed
        if "daily_quests" not in self.data:
            self.data["daily_quests"] = {}
        
        # Generate new quests for today if needed
        if self.data["daily_quests"].get("date") != today:
            self.data["daily_quests"] = {
                "date": today,
                "quests": [
                    {
                        "id": "daily_post",
                        "name": "Daily Writer",
                        "description": "Create 1 post today",
                        "icon": "✍️",
                        "target": 1,
                        "current": 0,
                        "points": 5,
                        "completed": False
                    },
                    {
                        "id": "daily_review",
                        "name": "Quality Check",
                        "description": "Run 1 Guardian audit",
                        "icon": "🔍",
                        "target": 1,
                        "current": 0,
                        "points": 3,
                        "completed": False
                    },
                    {
                        "id": "daily_evolution",
                        "name": "Evolve",
                        "description": "Complete 1 evolution cycle",
                        "icon": "🧬",
                        "target": 1,
                        "current": 0,
                        "points": 5,
                        "completed": False
                    }
                ]
            }
            self._save_data()
        
        return self.data["daily_quests"]["quests"]
    
    def update_daily_quest(self, quest_id: str, increment: int = 1) -> Optional[Dict]:
        """Update progress on a daily quest."""
        quests = self.get_daily_quests()
        
        for quest in quests:
            if quest["id"] == quest_id and not quest["completed"]:
                quest["current"] = min(quest["current"] + increment, quest["target"])
                
                if quest["current"] >= quest["target"]:
                    quest["completed"] = True
                    self.data["total_points"] += quest["points"]
                    logger.info(f"[{self.name}] ✅ Daily quest completed: {quest['name']} (+{quest['points']} pts)")
                
                self._save_data()
                return quest
        
        return None
    
    def get_engagement_dashboard(self) -> Dict:
        """
        Get a full engagement dashboard for the user.
        
        Combines achievements, streaks, quests, and motivation.
        """
        return {
            "streak": self.streak_reminder(),
            "close_achievements": self.get_close_achievements()[:3],
            "daily_quests": self.get_daily_quests(),
            "motivation": self.generate_motivation_message(),
            "summary": self.get_summary()
        }


# Singleton
_tracker = None

def get_achievement_tracker() -> AchievementTracker:
    """Get the global achievement tracker instance."""
    global _tracker
    if _tracker is None:
        _tracker = AchievementTracker()
    return _tracker


if __name__ == "__main__":
    tracker = AchievementTracker()
    
    # Simulate some activity
    print("Recording posts...")
    for i in range(3):
        newly_unlocked = tracker.record_post_created(is_ai_generated=True, model_used="gemini")
        if newly_unlocked:
            print(f"  Unlocked: {newly_unlocked}")
    
    print("\n" + tracker.format_for_display())
    print("\nSummary:", tracker.get_summary())
