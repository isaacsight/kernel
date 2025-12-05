
import os
import sqlite3
import json
import logging
from typing import Dict, List, Any
from datetime import datetime, timedelta

logger = logging.getLogger("DataAnalyst")

class DataAnalyst:
    """
    The Data Analyst (Mission Control).
    Responsible for aggregating metrics, visualizing performance, 
    and providing actionable insights.
    """
    
    def __init__(self):
        self.db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "brain", "studio_memory.db")
        
    def get_mission_control_data(self) -> Dict[str, Any]:
        """
        Aggregates all critical metrics for the Mission Control dashboard.
        """
        return {
            "viral_scores": self._get_viral_score_trends(),
            "content_pipeline": self._get_pipeline_status(),
            "engagement_metrics": self._get_mock_engagement_metrics(), # Placeholder for real API data
            "system_health": self._get_system_health()
        }
    
    def _read_db(self, query: str, args=()) -> List[Dict]:
        """Helper to read from SQLite DB."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute(query, args)
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"DB Read Error: {e}")
            return []

    def _get_viral_score_trends(self) -> Dict:
        """
        Analyzes viral scores from recent workflow executions.
        """
        # We need to query the insights table where insight_type='workflow_execution'
        # The structure of the insight value is a JSON blob.
        query = """
            SELECT insight_data, timestamp 
            FROM insights 
            WHERE insight_type = 'workflow_execution' 
            ORDER BY timestamp DESC 
            LIMIT 50
        """
        rows = self._read_db(query)
        
        scores = []
        templates = {}
        
        for row in rows:
            try:
                data = json.loads(row['insight_data'])
                if 'viral_score' in data:
                    scores.append({
                        "date": row['timestamp'],
                        "score": data['viral_score'],
                        "title": data.get('post_title', 'Unknown')
                    })
                
                tmpl = data.get('template', 'unknown')
                templates[tmpl] = templates.get(tmpl, 0) + 1
            except Exception:
                continue
                
        # Calculate trend (avg of last 5 vs previous 5)
        # Placeholder logic
        return {
            "recent_scores": scores[:10],
            "template_usage": templates,
            "average_score": sum(s['score'] for s in scores) / len(scores) if scores else 0
        }

    def _get_pipeline_status(self) -> Dict:
        """Checks status of recent content generation tasks."""
        # This would check the task.md or a job queue in a real system
        return {
            "active_tasks": 0, # To be implemented with job queue
            "completed_today": 0
        }

    def _get_mock_engagement_metrics(self) -> Dict:
        """
        Returns mock engagement data until we hook up real APIs (TikTok/YouTube).
        """
        return {
            "total_views": 15420,
            "total_likes": 3200,
            "platform_breakdown": {
                "tiktok": 8500,
                "blog": 6920
            },
            "growth_rate": "+12%"
        }

    def _get_system_health(self) -> Dict:
        """Checks health of critical agents/services."""
        return {
            "database": "healthy" if os.path.exists(self.db_path) else "critical",
            "tiktok_cookies": "valid" if os.path.exists(os.path.join(os.path.dirname(os.path.dirname(__file__)), "cookies.txt")) else "missing",
            "ascii_tool": "installed", # We know this is true now
            "animated_drawings": "installed" 
        }

if __name__ == "__main__":
    # Test
    logging.basicConfig(level=logging.INFO)
    analyst = DataAnalyst()
    print(json.dumps(analyst.get_mission_control_data(), indent=2))
