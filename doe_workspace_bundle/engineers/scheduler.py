"""
The Scheduler - Calendar Manager Agent

Manages editorial calendar and suggests optimal posting schedules.
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from config import config

logger = logging.getLogger("Scheduler")


class Scheduler:
    """
    The Scheduler (Calendar Manager)
    
    Mission: Optimize content timing and maintain consistent publishing.
    
    Responsibilities:
    - Manage editorial calendar
    - Suggest optimal posting schedules
    - Track publishing consistency
    - Send reminders for content deadlines
    """
    
    def __init__(self):
        self.name = "The Scheduler"
        self.role = "Calendar Manager"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.content_dir = config.CONTENT_DIR
        self.calendar_file = os.path.join(
            os.path.dirname(__file__), '..', 'brain', 'calendar.json'
        )
        self.calendar = self._load_calendar()
        
    def _load_calendar(self) -> Dict:
        """Load editorial calendar."""
        if os.path.exists(self.calendar_file):
            try:
                with open(self.calendar_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {"events": [], "recurring": [], "reminders": []}
    
    def _save_calendar(self):
        """Save calendar to disk."""
        with open(self.calendar_file, 'w') as f:
            json.dump(self.calendar, f, indent=2)
    
    def schedule_post(self, title: str, date: str, category: str = None) -> Dict:
        """
        Schedule a new post for a specific date.
        """
        event = {
            "id": f"post-{int(datetime.now().timestamp())}",
            "type": "post",
            "title": title,
            "date": date,
            "category": category,
            "status": "scheduled",
            "created_at": datetime.now().isoformat()
        }
        
        self.calendar["events"].append(event)
        self._save_calendar()
        
        logger.info(f"[{self.name}] Scheduled: {title} for {date}")
        self.metrics.track_agent_action(self.name, 'schedule_post', True, 0)
        
        return event
    
    def get_upcoming(self, days: int = 7) -> List[Dict]:
        """
        Get upcoming scheduled content.
        """
        today = datetime.now()
        upcoming = []
        
        for event in self.calendar["events"]:
            try:
                event_date = datetime.fromisoformat(event["date"])
                if today <= event_date <= today + timedelta(days=days):
                    upcoming.append(event)
            except:
                continue
        
        return sorted(upcoming, key=lambda x: x["date"])
    
    def get_publishing_gaps(self) -> List[Dict]:
        """
        Analyzes publishing history to find gaps.
        """
        import frontmatter
        
        # Get all published dates
        published_dates = []
        if os.path.exists(self.content_dir):
            for filename in os.listdir(self.content_dir):
                if filename.endswith('.md'):
                    try:
                        with open(os.path.join(self.content_dir, filename), 'r') as f:
                            post = frontmatter.load(f)
                        date = post.get('date')
                        if date:
                            published_dates.append(datetime.fromisoformat(str(date)[:10]))
                    except:
                        continue
        
        published_dates.sort()
        
        # Find gaps > 7 days
        gaps = []
        for i in range(1, len(published_dates)):
            diff = (published_dates[i] - published_dates[i-1]).days
            if diff > 7:
                gaps.append({
                    "start": published_dates[i-1].isoformat(),
                    "end": published_dates[i].isoformat(),
                    "days": diff
                })
        
        return gaps
    
    def suggest_schedule(self, posts_per_week: int = 2) -> List[Dict]:
        """
        Suggests optimal publishing schedule.
        """
        # Best days based on general content engagement patterns
        best_days = ["Tuesday", "Wednesday", "Thursday"]
        best_times = ["10:00 AM", "2:00 PM"]
        
        suggestions = []
        today = datetime.now()
        
        for week in range(4):  # Next 4 weeks
            week_start = today + timedelta(weeks=week)
            for i in range(posts_per_week):
                day_offset = i * 2 + 1  # Spread across week
                post_date = week_start + timedelta(days=day_offset)
                
                suggestions.append({
                    "date": post_date.strftime("%Y-%m-%d"),
                    "day": post_date.strftime("%A"),
                    "time": best_times[i % len(best_times)],
                    "week": week + 1
                })
        
        return suggestions
    
    def set_reminder(self, event_id: str, days_before: int = 1):
        """
        Set a reminder for an event.
        """
        reminder = {
            "event_id": event_id,
            "days_before": days_before,
            "created_at": datetime.now().isoformat()
        }
        
        self.calendar["reminders"].append(reminder)
        self._save_calendar()
        
    def get_due_reminders(self) -> List[Dict]:
        """
        Get reminders that are due today.
        """
        today = datetime.now().date()
        due = []
        
        for reminder in self.calendar["reminders"]:
            # Find the associated event
            for event in self.calendar["events"]:
                if event["id"] == reminder["event_id"]:
                    try:
                        event_date = datetime.fromisoformat(event["date"]).date()
                        reminder_date = event_date - timedelta(days=reminder["days_before"])
                        if reminder_date == today:
                            due.append({
                                "event": event,
                                "message": f"Reminder: '{event['title']}' is due in {reminder['days_before']} day(s)"
                            })
                    except:
                        continue
        
        return due
    
    def get_calendar_summary(self) -> str:
        """
        Generate a summary of the editorial calendar.
        """
        upcoming = self.get_upcoming(14)
        gaps = self.get_publishing_gaps()
        
        summary = [
            "📅 EDITORIAL CALENDAR",
            "=" * 30,
            "",
            "📌 Upcoming (Next 2 Weeks):"
        ]
        
        if upcoming:
            for event in upcoming[:5]:
                summary.append(f"  • {event['date']}: {event['title']}")
        else:
            summary.append("  • No posts scheduled")
        
        summary.append("")
        summary.append(f"📊 Total Scheduled: {len(self.calendar['events'])} posts")
        
        if gaps:
            summary.append("")
            summary.append("⚠️ Recent Gaps:")
            for gap in gaps[-3:]:
                summary.append(f"  • {gap['days']} days ({gap['start']} to {gap['end']})")
        
        return "\n".join(summary)


if __name__ == "__main__":
    scheduler = Scheduler()
    print(scheduler.get_calendar_summary())
    print("\nSuggested Schedule:")
    for s in scheduler.suggest_schedule()[:4]:
        print(f"  {s['date']} ({s['day']}) at {s['time']}")
