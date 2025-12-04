"""
Metrics Collector - Self-Improvement Analytics for Studio OS

This module enables the Visionary to make data-driven decisions by:
- Tracking performance metrics across all agents
- Analyzing trends over time
- Generating actionable insights
- Identifying areas for improvement
"""

import os
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging
from collections import defaultdict

logger = logging.getLogger("MetricsCollector")


class MetricsCollector:
    """
    Collects and analyzes metrics for the Studio OS self-improvement loop.
    """
    
    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = os.path.dirname(__file__)
        self.data_dir = data_dir
        self.metrics_file = os.path.join(data_dir, "metrics.json")
        self.metrics = self._load_metrics()
        
    def _load_metrics(self) -> Dict:
        """Load existing metrics from disk."""
        if os.path.exists(self.metrics_file):
            try:
                with open(self.metrics_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {
            "daily_stats": {},
            "agent_metrics": {},
            "content_metrics": {},
            "system_events": []
        }
    
    def _save_metrics(self):
        """Persist metrics to disk."""
        with open(self.metrics_file, 'w') as f:
            json.dump(self.metrics, f, indent=2)
            
    def _today(self) -> str:
        """Get today's date as string."""
        return datetime.now().strftime("%Y-%m-%d")
    
    # ==================== Tracking Methods ====================
    
    def track_generation(self, success: bool, provider: str, duration: float, topic: str):
        """Track a content generation event."""
        today = self._today()
        if today not in self.metrics["daily_stats"]:
            self.metrics["daily_stats"][today] = {
                "generations": 0, "successes": 0, "failures": 0,
                "total_duration": 0, "providers": {}
            }
        
        stats = self.metrics["daily_stats"][today]
        stats["generations"] += 1
        stats["successes" if success else "failures"] += 1
        stats["total_duration"] += duration
        
        if provider not in stats["providers"]:
            stats["providers"][provider] = {"count": 0, "successes": 0}
        stats["providers"][provider]["count"] += 1
        if success:
            stats["providers"][provider]["successes"] += 1
            
        self._save_metrics()
        
    def track_agent_action(self, agent: str, action: str, success: bool, duration: float = 0):
        """Track an agent performing an action."""
        if agent not in self.metrics["agent_metrics"]:
            self.metrics["agent_metrics"][agent] = {
                "total_actions": 0, "successes": 0, "failures": 0,
                "actions": {}, "avg_duration": 0
            }
        
        metrics = self.metrics["agent_metrics"][agent]
        metrics["total_actions"] += 1
        metrics["successes" if success else "failures"] += 1
        
        # Update rolling average duration
        n = metrics["total_actions"]
        old_avg = metrics["avg_duration"]
        metrics["avg_duration"] = ((old_avg * (n - 1)) + duration) / n
        
        if action not in metrics["actions"]:
            metrics["actions"][action] = {"count": 0, "successes": 0}
        metrics["actions"][action]["count"] += 1
        if success:
            metrics["actions"][action]["successes"] += 1
            
        self._save_metrics()
        
    def track_content_metric(self, slug: str, metric: str, value: float):
        """Track a metric for specific content (e.g., engagement, views)."""
        if slug not in self.metrics["content_metrics"]:
            self.metrics["content_metrics"][slug] = {}
        
        self.metrics["content_metrics"][slug][metric] = {
            "value": value,
            "timestamp": datetime.now().isoformat()
        }
        self._save_metrics()
        
    def log_event(self, event_type: str, data: Dict):
        """Log a system event."""
        self.metrics["system_events"].append({
            "type": event_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        })
        # Keep only last 100 events
        self.metrics["system_events"] = self.metrics["system_events"][-100:]
        self._save_metrics()
        
    # ==================== Analysis Methods ====================
    
    def get_daily_summary(self, date: str = None) -> Dict:
        """Get summary for a specific day."""
        if date is None:
            date = self._today()
        return self.metrics["daily_stats"].get(date, {})
    
    def get_trend_analysis(self, days: int = 7) -> Dict:
        """Analyze trends over the past N days."""
        today = datetime.now()
        dates = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
        
        trends = {
            "generation_trend": [],
            "success_rate_trend": [],
            "duration_trend": []
        }
        
        for date in reversed(dates):
            stats = self.metrics["daily_stats"].get(date, {})
            if stats:
                gens = stats.get("generations", 0)
                successes = stats.get("successes", 0)
                trends["generation_trend"].append(gens)
                trends["success_rate_trend"].append(
                    round(successes / gens * 100, 1) if gens > 0 else 0
                )
                trends["duration_trend"].append(
                    round(stats.get("total_duration", 0) / gens, 2) if gens > 0 else 0
                )
            else:
                trends["generation_trend"].append(0)
                trends["success_rate_trend"].append(0)
                trends["duration_trend"].append(0)
                
        # Calculate direction - iterate over a copy of the keys
        for key in list(trends.keys()):
            if len(trends[key]) >= 2:
                recent_avg = sum(trends[key][-3:]) / 3 if len(trends[key]) >= 3 else trends[key][-1]
                older_avg = sum(trends[key][:3]) / 3 if len(trends[key]) >= 3 else trends[key][0]
                trends[f"{key}_direction"] = "up" if recent_avg > older_avg else "down" if recent_avg < older_avg else "stable"
                
        return trends
    
    def get_agent_rankings(self) -> List[Dict]:
        """Rank agents by performance."""
        rankings = []
        for agent, metrics in self.metrics["agent_metrics"].items():
            total = metrics.get("total_actions", 0)
            successes = metrics.get("successes", 0)
            rankings.append({
                "agent": agent,
                "total_actions": total,
                "success_rate": round(successes / total * 100, 1) if total > 0 else 0,
                "avg_duration": round(metrics.get("avg_duration", 0), 2)
            })
        return sorted(rankings, key=lambda x: x["success_rate"], reverse=True)
    
    def get_improvement_opportunities(self) -> List[Dict]:
        """Identify areas that need improvement."""
        opportunities = []
        
        # Check agent success rates
        for agent, metrics in self.metrics["agent_metrics"].items():
            total = metrics.get("total_actions", 0)
            if total >= 5:  # Only analyze agents with enough data
                success_rate = metrics.get("successes", 0) / total * 100
                if success_rate < 80:
                    opportunities.append({
                        "area": f"Agent: {agent}",
                        "issue": f"Low success rate ({success_rate:.1f}%)",
                        "priority": "high" if success_rate < 50 else "medium",
                        "suggestion": f"Review {agent}'s error handling and input validation"
                    })
        
        # Check generation trends
        trends = self.get_trend_analysis(7)
        if trends.get("success_rate_trend_direction") == "down":
            opportunities.append({
                "area": "Content Generation",
                "issue": "Success rate declining over past week",
                "priority": "high",
                "suggestion": "Review provider configuration and content prompts"
            })
            
        # Check for stale content
        today = datetime.now()
        daily_stats = self.metrics.get("daily_stats", {})
        recent_dates = [
            (today - timedelta(days=i)).strftime("%Y-%m-%d") 
            for i in range(3)
        ]
        recent_gens = sum(
            daily_stats.get(d, {}).get("generations", 0) 
            for d in recent_dates
        )
        if recent_gens == 0:
            opportunities.append({
                "area": "Content Pipeline",
                "issue": "No content generated in 3+ days",
                "priority": "medium",
                "suggestion": "Commission The Alchemist through The Operator"
            })
            
        return opportunities
    
    def generate_daily_report(self) -> str:
        """Generate a human-readable daily report."""
        today = self._today()
        stats = self.get_daily_summary(today)
        trends = self.get_trend_analysis(7)
        opportunities = self.get_improvement_opportunities()
        
        report = [
            f"📊 Studio OS Daily Report - {today}",
            "=" * 40,
            "",
            "📝 Content Generation:"
        ]
        
        if stats:
            report.extend([
                f"  • Generations: {stats.get('generations', 0)}",
                f"  • Success Rate: {stats.get('successes', 0) / stats.get('generations', 1) * 100:.1f}%",
                f"  • Avg Duration: {stats.get('total_duration', 0) / max(stats.get('generations', 1), 1):.1f}s"
            ])
        else:
            report.append("  • No activity today")
            
        # Trends
        report.extend([
            "",
            "📈 Trends (7-day):",
            f"  • Generation Trend: {trends.get('generation_trend_direction', 'N/A')}",
            f"  • Success Rate Trend: {trends.get('success_rate_trend_direction', 'N/A')}"
        ])
        
        # Opportunities
        if opportunities:
            report.extend([
                "",
                "🎯 Improvement Opportunities:"
            ])
            for opp in opportunities[:3]:  # Top 3
                report.append(f"  • [{opp['priority'].upper()}] {opp['area']}: {opp['issue']}")
                
        return "\n".join(report)


# Singleton instance
_collector = None

def get_metrics_collector() -> MetricsCollector:
    """Get the global metrics collector instance."""
    global _collector
    if _collector is None:
        _collector = MetricsCollector()
    return _collector


if __name__ == "__main__":
    # Test the collector
    collector = MetricsCollector()
    
    # Track some test data
    collector.track_generation(True, "gemini", 5.2, "AI Ethics")
    collector.track_generation(True, "ollama", 8.1, "Machine Learning")
    collector.track_agent_action("Alchemist", "generate", True, 5.5)
    collector.track_agent_action("Guardian", "audit", True, 0.3)
    collector.track_agent_action("Guardian", "audit", False, 0.1)
    
    # Generate report
    print(collector.generate_daily_report())
    print("\n" + "=" * 40 + "\n")
    print("Agent Rankings:", collector.get_agent_rankings())
    print("\nImprovement Opportunities:", collector.get_improvement_opportunities())
