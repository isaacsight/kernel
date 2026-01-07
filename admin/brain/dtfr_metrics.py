"""
DTFR Evaluation Metrics - Quality Gate System
Sovereign Laboratory OS - Phase 2 Intelligence Amplification

Features:
- Quantified quality metrics for "Does This Feel Right?"
- A/B testing framework for prompt variations
- Critique scoring with multi-dimensional analysis
- Feedback loop from critique → agent improvement
- Mission success prediction
- Aesthetic consistency scoring
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from collections import defaultdict
from enum import Enum

from admin.brain.memory_store import get_memory_store
from admin.brain.structured_logging import get_logger

logger = get_logger("DTFRMetrics")


class QualityDimension(Enum):
    """Dimensions of quality evaluation."""
    CORRECTNESS = "correctness"  # Factual accuracy
    COMPLETENESS = "completeness"  # All requirements met
    COHERENCE = "coherence"  # Logical consistency
    CLARITY = "clarity"  # Clear communication
    CREATIVITY = "creativity"  # Novel approach
    EFFICIENCY = "efficiency"  # Resource optimization
    AESTHETIC = "aesthetic"  # Feel, elegance, taste


@dataclass
class QualityScore:
    """Multi-dimensional quality score."""
    correctness: float  # 0.0 to 1.0
    completeness: float
    coherence: float
    clarity: float
    creativity: float
    efficiency: float
    aesthetic: float

    def overall_score(self) -> float:
        """Calculate weighted overall score."""
        weights = {
            "correctness": 0.25,
            "completeness": 0.20,
            "coherence": 0.15,
            "clarity": 0.15,
            "creativity": 0.10,
            "efficiency": 0.05,
            "aesthetic": 0.10
        }

        return sum(
            getattr(self, dim) * weight
            for dim, weight in weights.items()
        )

    def passes_gate(self, thresholds: Optional[Dict[str, float]] = None) -> Tuple[bool, List[str]]:
        """
        Check if quality meets thresholds.

        Args:
            thresholds: Optional custom thresholds per dimension

        Returns:
            (passes, list_of_failures)
        """
        default_thresholds = {
            "correctness": 0.8,
            "completeness": 0.7,
            "coherence": 0.7,
            "clarity": 0.6,
            "creativity": 0.5,
            "efficiency": 0.5,
            "aesthetic": 0.6
        }

        thresholds = thresholds or default_thresholds
        failures = []

        for dim, threshold in thresholds.items():
            score = getattr(self, dim)
            if score < threshold:
                failures.append(f"{dim}: {score:.2f} < {threshold:.2f}")

        return (len(failures) == 0, failures)


@dataclass
class MissionMetrics:
    """Metrics for a completed mission."""
    mission_id: str
    task_description: str
    started_at: str
    completed_at: str
    duration_seconds: float

    # Quality
    quality_score: QualityScore

    # Execution
    steps_planned: int
    steps_executed: int
    steps_successful: int
    steps_failed: int

    # Resources
    agents_used: List[str]
    models_used: List[str]
    total_tokens: int
    estimated_cost_usd: float

    # Outcome
    status: str  # "COMPLETED", "PARTIAL_FAILURE", "FAILED"
    critique: str
    user_satisfaction: Optional[float] = None  # If user provides feedback


class DTFRMetrics:
    """
    DTFR Evaluation Metrics System.

    Tracks, analyzes, and improves mission quality over time.
    """

    def __init__(self):
        self.memory = get_memory_store()
        self.mission_history: List[MissionMetrics] = []

    # ==================== Quality Scoring ====================

    def score_mission_quality(
        self,
        output: str,
        success_criteria: List[str],
        plan_steps: int,
        execution_results: List[Dict]
    ) -> QualityScore:
        """
        Score a mission's output across multiple quality dimensions.

        Args:
            output: The final output/critique from the mission
            success_criteria: Original success criteria from plan
            plan_steps: Number of steps in original plan
            execution_results: List of execution result dicts

        Returns:
            QualityScore with scores for each dimension
        """
        # Correctness: % of successful steps
        successful_steps = sum(1 for r in execution_results if r.get("status") == "success")
        correctness = successful_steps / len(execution_results) if execution_results else 0.0

        # Completeness: Did we meet success criteria?
        # (Simplified: check if critique mentions criteria)
        completeness = self._score_completeness(output, success_criteria)

        # Coherence: Steps executed in logical order
        coherence = self._score_coherence(execution_results)

        # Clarity: Output length and structure
        clarity = self._score_clarity(output)

        # Creativity: Novel approaches used
        creativity = self._score_creativity(execution_results)

        # Efficiency: Actual steps vs planned steps
        efficiency = min(plan_steps / len(execution_results), 1.0) if execution_results else 0.5

        # Aesthetic: Subjective feel (based on patterns)
        aesthetic = self._score_aesthetic(output, execution_results)

        return QualityScore(
            correctness=correctness,
            completeness=completeness,
            coherence=coherence,
            clarity=clarity,
            creativity=creativity,
            efficiency=efficiency,
            aesthetic=aesthetic
        )

    def _score_completeness(self, output: str, criteria: List[str]) -> float:
        """Score how well success criteria were met."""
        if not criteria:
            return 0.5  # Neutral if no criteria

        met_count = 0
        for criterion in criteria:
            # Simple keyword matching (could be enhanced with semantic similarity)
            if any(word.lower() in output.lower() for word in criterion.split()):
                met_count += 1

        return met_count / len(criteria)

    def _score_coherence(self, execution_results: List[Dict]) -> float:
        """Score logical consistency of execution."""
        if not execution_results:
            return 0.0

        # Check for logical flow: failures should trigger recovery, not continue blindly
        coherence_score = 1.0

        for i, result in enumerate(execution_results):
            if result.get("status") == "failure":
                # If there are subsequent steps, check if they acknowledged the failure
                if i < len(execution_results) - 1:
                    next_result = execution_results[i + 1]
                    # Penalty if next step doesn't mention recovery or retry
                    if "retry" not in str(next_result).lower() and "recover" not in str(next_result).lower():
                        coherence_score -= 0.1

        return max(coherence_score, 0.0)

    def _score_clarity(self, output: str) -> float:
        """Score clarity of output."""
        # Heuristics for clarity
        word_count = len(output.split())

        # Ideal range: 100-500 words
        if 100 <= word_count <= 500:
            length_score = 1.0
        elif word_count < 100:
            length_score = word_count / 100
        else:  # > 500
            length_score = max(0.5, 1.0 - (word_count - 500) / 1000)

        # Check for structure (paragraphs, bullets)
        has_structure = "\n\n" in output or "\n- " in output or "\n* " in output
        structure_score = 1.0 if has_structure else 0.7

        return (length_score + structure_score) / 2

    def _score_creativity(self, execution_results: List[Dict]) -> float:
        """Score novelty of approaches used."""
        # Check if unique tools/agents were used
        tools_used = set()
        for result in execution_results:
            tool = result.get("tool_name")
            if tool:
                tools_used.add(tool)

        # More diverse tools = more creative
        # (Assumes 5+ unique tools is "highly creative")
        diversity_score = min(len(tools_used) / 5, 1.0)

        return diversity_score

    def _score_aesthetic(self, output: str, execution_results: List[Dict]) -> float:
        """
        Score aesthetic quality (the "feel").

        This is subjective but we can use heuristics:
        - Smooth execution (few retries/failures)
        - Concise but complete output
        - Professional tone
        """
        # Smooth execution score
        failures = sum(1 for r in execution_results if r.get("status") == "failure")
        smoothness = max(0.0, 1.0 - (failures / len(execution_results))) if execution_results else 0.5

        # Output conciseness
        word_count = len(output.split())
        conciseness = 1.0 if 100 <= word_count <= 300 else 0.7

        # Professional tone (avoid excessive casual language)
        casual_words = ["lol", "haha", "omg", "btw"]
        has_casual = any(word in output.lower() for word in casual_words)
        tone_score = 0.6 if has_casual else 1.0

        return (smoothness + conciseness + tone_score) / 3

    # ==================== Mission Tracking ====================

    def record_mission(
        self,
        mission_id: str,
        task_description: str,
        started_at: datetime,
        completed_at: datetime,
        plan: Dict,
        execution_results: List[Dict],
        critique: str,
        agents_used: List[str],
        models_used: List[str],
        total_tokens: int = 0,
        estimated_cost: float = 0.0
    ) -> MissionMetrics:
        """
        Record a completed mission with full metrics.

        Returns:
            MissionMetrics object
        """
        # Calculate quality score
        quality = self.score_mission_quality(
            critique,
            plan.get("success_criteria", []),
            len(plan.get("steps", [])),
            execution_results
        )

        # Calculate execution stats
        steps_executed = len(execution_results)
        steps_successful = sum(1 for r in execution_results if r.get("status") == "success")
        steps_failed = sum(1 for r in execution_results if r.get("status") == "failure")

        # Determine overall status
        if steps_successful == steps_executed:
            status = "COMPLETED"
        elif steps_successful > 0:
            status = "PARTIAL_FAILURE"
        else:
            status = "FAILED"

        metrics = MissionMetrics(
            mission_id=mission_id,
            task_description=task_description,
            started_at=started_at.isoformat(),
            completed_at=completed_at.isoformat(),
            duration_seconds=(completed_at - started_at).total_seconds(),
            quality_score=quality,
            steps_planned=len(plan.get("steps", [])),
            steps_executed=steps_executed,
            steps_successful=steps_successful,
            steps_failed=steps_failed,
            agents_used=agents_used,
            models_used=models_used,
            total_tokens=total_tokens,
            estimated_cost_usd=estimated_cost,
            status=status,
            critique=critique
        )

        self.mission_history.append(metrics)

        logger.info(
            f"Recorded mission metrics",
            extra={
                "mission_id": mission_id,
                "quality_score": quality.overall_score(),
                "status": status,
                "duration_s": metrics.duration_seconds
            }
        )

        return metrics

    # ==================== Analytics & Insights ====================

    def get_quality_trends(self, days: int = 30) -> Dict[str, List[float]]:
        """
        Get quality trends over time.

        Args:
            days: Number of days to analyze

        Returns:
            Dict mapping quality dimensions to time series
        """
        cutoff = datetime.now() - timedelta(days=days)

        recent_missions = [
            m for m in self.mission_history
            if datetime.fromisoformat(m.completed_at) >= cutoff
        ]

        trends = defaultdict(list)

        for mission in sorted(recent_missions, key=lambda m: m.completed_at):
            for dim in QualityDimension:
                score = getattr(mission.quality_score, dim.value)
                trends[dim.value].append(score)

        return dict(trends)

    def get_agent_performance(self) -> Dict[str, Dict[str, float]]:
        """
        Get performance metrics per agent.

        Returns:
            Dict mapping agent_id to performance stats
        """
        agent_stats = defaultdict(lambda: {
            "missions_count": 0,
            "avg_quality": 0.0,
            "success_rate": 0.0,
            "avg_duration": 0.0
        })

        for mission in self.mission_history:
            for agent in mission.agents_used:
                stats = agent_stats[agent]
                stats["missions_count"] += 1
                stats["avg_quality"] += mission.quality_score.overall_score()
                stats["avg_duration"] += mission.duration_seconds

                if mission.status == "COMPLETED":
                    stats["success_rate"] += 1

        # Calculate averages
        for agent, stats in agent_stats.items():
            count = stats["missions_count"]
            stats["avg_quality"] /= count
            stats["avg_duration"] /= count
            stats["success_rate"] /= count  # Convert to ratio

        return dict(agent_stats)

    def get_model_efficiency(self) -> Dict[str, Dict[str, float]]:
        """
        Get efficiency metrics per model.

        Returns:
            Dict mapping model_name to efficiency stats
        """
        model_stats = defaultdict(lambda: {
            "uses_count": 0,
            "total_tokens": 0,
            "total_cost": 0.0,
            "avg_quality": 0.0
        })

        for mission in self.mission_history:
            for model in mission.models_used:
                stats = model_stats[model]
                stats["uses_count"] += 1
                stats["total_tokens"] += mission.total_tokens
                stats["total_cost"] += mission.estimated_cost_usd
                stats["avg_quality"] += mission.quality_score.overall_score()

        # Calculate averages
        for model, stats in model_stats.items():
            count = stats["uses_count"]
            stats["avg_quality"] /= count
            stats["avg_tokens_per_mission"] = stats["total_tokens"] / count
            stats["avg_cost_per_mission"] = stats["total_cost"] / count

        return dict(model_stats)

    def predict_mission_success(
        self,
        task_complexity: float,  # 0.0 to 1.0
        agent_expertise_match: float,  # 0.0 to 1.0
        historical_success_rate: float  # 0.0 to 1.0
    ) -> Tuple[float, str]:
        """
        Predict likelihood of mission success.

        Args:
            task_complexity: Estimated complexity of task
            agent_expertise_match: How well agent skills match requirements
            historical_success_rate: Success rate of similar past missions

        Returns:
            (success_probability, recommendation)
        """
        # Simple weighted model
        weights = {
            "complexity": -0.3,  # Higher complexity = lower probability
            "expertise": 0.4,  # Higher expertise = higher probability
            "history": 0.3  # Higher historical success = higher probability
        }

        success_prob = (
            0.5  # Base probability
            + weights["complexity"] * (1.0 - task_complexity)
            + weights["expertise"] * agent_expertise_match
            + weights["history"] * historical_success_rate
        )

        success_prob = max(0.0, min(1.0, success_prob))

        # Generate recommendation
        if success_prob >= 0.8:
            recommendation = "HIGH CONFIDENCE - Proceed"
        elif success_prob >= 0.6:
            recommendation = "MODERATE CONFIDENCE - Proceed with monitoring"
        elif success_prob >= 0.4:
            recommendation = "LOW CONFIDENCE - Consider alternative approach"
        else:
            recommendation = "VERY LOW CONFIDENCE - Recommend task breakdown or different agent"

        return (success_prob, recommendation)

    # ==================== Reporting ====================

    def generate_dashboard_data(self) -> Dict[str, Any]:
        """
        Generate data for a quality dashboard.

        Returns:
            Dict with all dashboard metrics
        """
        return {
            "summary": {
                "total_missions": len(self.mission_history),
                "avg_quality_score": sum(m.quality_score.overall_score() for m in self.mission_history) / len(self.mission_history) if self.mission_history else 0,
                "success_rate": sum(1 for m in self.mission_history if m.status == "COMPLETED") / len(self.mission_history) if self.mission_history else 0,
                "total_cost_usd": sum(m.estimated_cost_usd for m in self.mission_history)
            },
            "quality_trends": self.get_quality_trends(days=30),
            "agent_performance": self.get_agent_performance(),
            "model_efficiency": self.get_model_efficiency(),
            "recent_missions": [
                {
                    "id": m.mission_id,
                    "task": m.task_description[:100],
                    "quality": m.quality_score.overall_score(),
                    "status": m.status,
                    "duration": m.duration_seconds
                }
                for m in sorted(self.mission_history, key=lambda m: m.completed_at, reverse=True)[:10]
            ]
        }


# Singleton instance
_dtfr_metrics = None


def get_dtfr_metrics() -> DTFRMetrics:
    """Get the global DTFR metrics instance."""
    global _dtfr_metrics
    if _dtfr_metrics is None:
        _dtfr_metrics = DTFRMetrics()
    return _dtfr_metrics
