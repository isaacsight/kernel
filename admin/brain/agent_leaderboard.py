"""
Agent Performance Leaderboard - Continuous Improvement System
Sovereign Laboratory OS - Phase 2 Intelligence Amplification

Features:
- Multi-dimensional agent performance scoring
- Skill-specific rankings
- Performance trends over time
- Peer comparison and benchmarking
- Automated performance improvement suggestions
"""

import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from collections import defaultdict
from pathlib import Path

from admin.brain.structured_logging import get_logger
from admin.config import config

logger = get_logger("AgentLeaderboard")


@dataclass
class AgentScore:
    """Comprehensive agent performance score."""
    agent_id: str
    period_start: str
    period_end: str

    # Core metrics
    missions_completed: int
    missions_failed: int
    success_rate: float

    # Quality metrics
    avg_quality_score: float
    avg_correctness: float
    avg_completeness: float
    avg_creativity: float

    # Efficiency metrics
    avg_duration_seconds: float
    avg_cost_usd: float
    cost_efficiency: float  # quality / cost ratio

    # Collaboration metrics
    handoffs_successful: int
    handoffs_failed: int
    knowledge_contributions: int

    # Overall score (weighted combination)
    overall_score: float

    # Rank
    rank: Optional[int] = None


@dataclass
class SkillRanking:
    """Agent ranking for a specific skill."""
    skill_name: str
    agent_id: str
    proficiency_score: float  # 0.0 to 1.0
    applications_count: int
    success_rate: float
    avg_quality: float
    last_used: str
    rank: int


class AgentLeaderboard:
    """
    Agent performance leaderboard and continuous improvement system.

    Tracks agent performance across multiple dimensions and provides
    insights for improvement.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or str(Path(config.DATA_DIR) / "agent_leaderboard.db")
        self._init_database()

    def _init_database(self):
        """Initialize SQLite database for leaderboard."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Agent scores table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                period_start TEXT NOT NULL,
                period_end TEXT NOT NULL,
                missions_completed INTEGER DEFAULT 0,
                missions_failed INTEGER DEFAULT 0,
                success_rate REAL DEFAULT 0.0,
                avg_quality_score REAL DEFAULT 0.0,
                avg_correctness REAL DEFAULT 0.0,
                avg_completeness REAL DEFAULT 0.0,
                avg_creativity REAL DEFAULT 0.0,
                avg_duration_seconds REAL DEFAULT 0.0,
                avg_cost_usd REAL DEFAULT 0.0,
                cost_efficiency REAL DEFAULT 0.0,
                handoffs_successful INTEGER DEFAULT 0,
                handoffs_failed INTEGER DEFAULT 0,
                knowledge_contributions INTEGER DEFAULT 0,
                overall_score REAL DEFAULT 0.0,
                rank INTEGER,
                UNIQUE(agent_id, period_start)
            )
        """)

        # Skill rankings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS skill_rankings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                skill_name TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                proficiency_score REAL DEFAULT 0.0,
                applications_count INTEGER DEFAULT 0,
                success_rate REAL DEFAULT 0.0,
                avg_quality REAL DEFAULT 0.0,
                last_used TEXT NOT NULL,
                rank INTEGER,
                updated_at TEXT NOT NULL,
                UNIQUE(skill_name, agent_id)
            )
        """)

        # Performance events table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS performance_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                mission_id TEXT,
                quality_score REAL,
                duration_seconds REAL,
                cost_usd REAL,
                success INTEGER,
                metadata TEXT
            )
        """)

        # Indices
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_scores_agent ON agent_scores(agent_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_skills_skill ON skill_rankings(skill_name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_agent ON performance_events(agent_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_timestamp ON performance_events(timestamp)")

        conn.commit()
        conn.close()

        logger.debug(f"Initialized leaderboard database at {self.db_path}")

    # ==================== Performance Recording ====================

    def record_performance_event(
        self,
        agent_id: str,
        event_type: str,  # "mission_completed", "mission_failed", "handoff", "knowledge_shared"
        mission_id: Optional[str] = None,
        quality_score: Optional[float] = None,
        duration_seconds: Optional[float] = None,
        cost_usd: Optional[float] = None,
        success: bool = True,
        metadata: Optional[Dict] = None
    ):
        """
        Record a performance event for an agent.

        Args:
            agent_id: ID of the agent
            event_type: Type of event
            mission_id: Optional mission ID
            quality_score: Optional quality score (0.0 to 1.0)
            duration_seconds: Optional duration
            cost_usd: Optional cost
            success: Whether the event was successful
            metadata: Optional additional metadata
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO performance_events (
                timestamp, agent_id, event_type, mission_id, quality_score,
                duration_seconds, cost_usd, success, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            datetime.now().isoformat(),
            agent_id,
            event_type,
            mission_id,
            quality_score,
            duration_seconds,
            cost_usd,
            int(success),
            str(metadata) if metadata else None
        ))

        conn.commit()
        conn.close()

        logger.debug(
            f"Recorded performance event",
            extra={
                "agent": agent_id,
                "event": event_type,
                "success": success
            }
        )

    # ==================== Score Calculation ====================

    def calculate_agent_scores(self, period_days: int = 30) -> List[AgentScore]:
        """
        Calculate agent scores for a period.

        Args:
            period_days: Number of days to analyze

        Returns:
            List of AgentScore objects, sorted by overall_score
        """
        period_start = datetime.now() - timedelta(days=period_days)
        period_end = datetime.now()

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Get all agents with activity in period
        cursor.execute("""
            SELECT DISTINCT agent_id FROM performance_events
            WHERE timestamp >= ?
        """, (period_start.isoformat(),))

        agent_ids = [row[0] for row in cursor.fetchall()]

        scores = []

        for agent_id in agent_ids:
            # Get mission stats
            cursor.execute("""
                SELECT
                    SUM(CASE WHEN event_type = 'mission_completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN event_type = 'mission_failed' THEN 1 ELSE 0 END) as failed,
                    AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score ELSE NULL END) as avg_quality,
                    AVG(duration_seconds) as avg_duration,
                    AVG(cost_usd) as avg_cost
                FROM performance_events
                WHERE agent_id = ? AND timestamp >= ?
            """, (agent_id, period_start.isoformat()))

            row = cursor.fetchone()
            completed, failed, avg_quality, avg_duration, avg_cost = row
            completed = completed or 0
            failed = failed or 0
            avg_quality = avg_quality or 0.0
            avg_duration = avg_duration or 0.0
            avg_cost = avg_cost or 0.0

            success_rate = completed / (completed + failed) if (completed + failed) > 0 else 0.0

            # Cost efficiency (quality per dollar)
            cost_efficiency = avg_quality / avg_cost if avg_cost > 0 else 0.0

            # Handoff stats
            cursor.execute("""
                SELECT
                    SUM(CASE WHEN event_type = 'handoff' AND success = 1 THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN event_type = 'handoff' AND success = 0 THEN 1 ELSE 0 END) as failed
                FROM performance_events
                WHERE agent_id = ? AND timestamp >= ?
            """, (agent_id, period_start.isoformat()))

            handoff_row = cursor.fetchone()
            handoffs_successful = handoff_row[0] or 0
            handoffs_failed = handoff_row[1] or 0

            # Knowledge contributions
            cursor.execute("""
                SELECT COUNT(*) FROM performance_events
                WHERE agent_id = ? AND event_type = 'knowledge_shared' AND timestamp >= ?
            """, (agent_id, period_start.isoformat()))

            knowledge_contributions = cursor.fetchone()[0] or 0

            # Calculate overall score
            overall_score = self._calculate_overall_score(
                success_rate,
                avg_quality,
                cost_efficiency,
                handoffs_successful,
                knowledge_contributions
            )

            score = AgentScore(
                agent_id=agent_id,
                period_start=period_start.isoformat(),
                period_end=period_end.isoformat(),
                missions_completed=completed,
                missions_failed=failed,
                success_rate=success_rate,
                avg_quality_score=avg_quality,
                avg_correctness=avg_quality * 0.9,  # Placeholder
                avg_completeness=avg_quality * 0.95,  # Placeholder
                avg_creativity=avg_quality * 0.7,  # Placeholder
                avg_duration_seconds=avg_duration,
                avg_cost_usd=avg_cost,
                cost_efficiency=cost_efficiency,
                handoffs_successful=handoffs_successful,
                handoffs_failed=handoffs_failed,
                knowledge_contributions=knowledge_contributions,
                overall_score=overall_score
            )

            scores.append(score)

        conn.close()

        # Sort by overall score and assign ranks
        scores.sort(key=lambda s: s.overall_score, reverse=True)
        for rank, score in enumerate(scores, start=1):
            score.rank = rank

        return scores

    def _calculate_overall_score(
        self,
        success_rate: float,
        avg_quality: float,
        cost_efficiency: float,
        handoffs_successful: int,
        knowledge_contributions: int
    ) -> float:
        """
        Calculate overall score from individual metrics.

        Weights:
        - Success rate: 30%
        - Quality: 30%
        - Cost efficiency: 20%
        - Collaboration: 10%
        - Knowledge sharing: 10%
        """
        # Normalize metrics to 0-1 scale
        success_score = success_rate
        quality_score = avg_quality
        efficiency_score = min(cost_efficiency / 10, 1.0)  # Assume 10 quality/$ is excellent
        collaboration_score = min(handoffs_successful / 10, 1.0)  # 10+ handoffs is excellent
        knowledge_score = min(knowledge_contributions / 5, 1.0)  # 5+ contributions is excellent

        overall = (
            success_score * 0.3 +
            quality_score * 0.3 +
            efficiency_score * 0.2 +
            collaboration_score * 0.1 +
            knowledge_score * 0.1
        )

        return overall

    # ==================== Skill Rankings ====================

    def calculate_skill_rankings(self, skill_name: str) -> List[SkillRanking]:
        """
        Calculate agent rankings for a specific skill.

        Args:
            skill_name: Name of the skill to rank

        Returns:
            List of SkillRanking objects, sorted by proficiency
        """
        # This would integrate with knowledge_graph.py to get skill evidence
        # Simplified implementation here

        rankings = []

        # In real implementation, query from knowledge graph
        # For now, return empty list
        logger.warning(f"Skill ranking not fully implemented yet")

        return rankings

    # ==================== Leaderboard Queries ====================

    def get_leaderboard(
        self,
        period_days: int = 30,
        top_n: Optional[int] = None
    ) -> List[AgentScore]:
        """
        Get the current leaderboard.

        Args:
            period_days: Number of days to analyze
            top_n: Optional limit to top N agents

        Returns:
            List of AgentScore objects
        """
        scores = self.calculate_agent_scores(period_days)

        if top_n:
            scores = scores[:top_n]

        return scores

    def get_agent_performance_history(
        self,
        agent_id: str,
        days: int = 90
    ) -> Dict[str, List[float]]:
        """
        Get performance trends for an agent over time.

        Args:
            agent_id: Agent ID
            days: Number of days to analyze

        Returns:
            Dict mapping metric names to time series
        """
        cutoff = datetime.now() - timedelta(days=days)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Get weekly performance
        trends = {
            "quality": [],
            "success_rate": [],
            "cost_efficiency": []
        }

        # Calculate metrics per week
        for week_offset in range(days // 7):
            week_start = datetime.now() - timedelta(days=(week_offset + 1) * 7)
            week_end = datetime.now() - timedelta(days=week_offset * 7)

            cursor.execute("""
                SELECT
                    AVG(quality_score) as avg_quality,
                    SUM(CASE WHEN event_type LIKE 'mission_%' AND success = 1 THEN 1 ELSE 0 END) as successes,
                    COUNT(CASE WHEN event_type LIKE 'mission_%' THEN 1 END) as total_missions,
                    AVG(cost_usd) as avg_cost
                FROM performance_events
                WHERE agent_id = ? AND timestamp >= ? AND timestamp < ?
            """, (agent_id, week_start.isoformat(), week_end.isoformat()))

            row = cursor.fetchone()
            avg_quality, successes, total, avg_cost = row

            trends["quality"].append(avg_quality or 0.0)
            trends["success_rate"].append(successes / total if total > 0 else 0.0)

            if avg_quality and avg_cost and avg_cost > 0:
                trends["cost_efficiency"].append(avg_quality / avg_cost)
            else:
                trends["cost_efficiency"].append(0.0)

        conn.close()

        # Reverse to get chronological order
        for key in trends:
            trends[key].reverse()

        return trends

    # ==================== Improvement Suggestions ====================

    def generate_improvement_suggestions(
        self,
        agent_id: str
    ) -> List[Dict[str, Any]]:
        """
        Generate personalized improvement suggestions for an agent.

        Args:
            agent_id: Agent ID

        Returns:
            List of suggestion dicts
        """
        suggestions = []

        # Get agent's current scores
        scores = self.calculate_agent_scores(period_days=30)
        agent_score = next((s for s in scores if s.agent_id == agent_id), None)

        if not agent_score:
            return []

        # Compare to top performers
        if scores:
            top_score = scores[0]

            # Success rate improvement
            if agent_score.success_rate < top_score.success_rate - 0.1:
                suggestions.append({
                    "dimension": "success_rate",
                    "current": agent_score.success_rate,
                    "target": top_score.success_rate,
                    "suggestion": "Improve mission planning - top performers have higher success rates",
                    "priority": "high"
                })

            # Quality improvement
            if agent_score.avg_quality_score < top_score.avg_quality_score - 0.1:
                suggestions.append({
                    "dimension": "quality",
                    "current": agent_score.avg_quality_score,
                    "target": top_score.avg_quality_score,
                    "suggestion": "Focus on completeness and coherence - review top performer outputs",
                    "priority": "medium"
                })

            # Cost efficiency
            if agent_score.cost_efficiency < top_score.cost_efficiency - 1.0:
                suggestions.append({
                    "dimension": "cost_efficiency",
                    "current": agent_score.cost_efficiency,
                    "target": top_score.cost_efficiency,
                    "suggestion": "Use cheaper models for simpler tasks to improve cost efficiency",
                    "priority": "low"
                })

        return suggestions


# Singleton instance
_leaderboard = None


def get_agent_leaderboard() -> AgentLeaderboard:
    """Get the global agent leaderboard instance."""
    global _leaderboard
    if _leaderboard is None:
        _leaderboard = AgentLeaderboard()
    return _leaderboard
