"""
Model Cost Tracker - Usage Analytics & Budget Optimization
Sovereign Laboratory OS - Phase 2 Intelligence Amplification

Features:
- Real-time cost tracking per model
- Budget alerts and spending limits
- Cost optimization recommendations
- Usage analytics and forecasting
- Per-agent cost attribution
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

logger = get_logger("CostTracker")


@dataclass
class UsageRecord:
    """Single model usage record."""
    id: Optional[int] = None
    timestamp: str = ""
    model_name: str = ""
    provider: str = ""
    task_type: str = ""
    agent_id: str = ""
    mission_id: Optional[str] = None
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: float = 0.0
    success: bool = True


@dataclass
class BudgetAlert:
    """Budget threshold alert."""
    alert_id: str
    budget_name: str
    threshold_pct: float  # e.g., 0.8 for 80%
    current_spend: float
    budget_limit: float
    triggered_at: str
    severity: str  # "warning", "critical"


class CostTracker:
    """
    Model cost tracking and budget management system.

    Integrates with ModelRouter to track all LLM API usage.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or str(Path(config.DATA_DIR) / "cost_tracking.db")
        self._init_database()

        # Cost rates per million tokens (as of Jan 2026)
        self.cost_rates = {
            "models/gemini-2.5-flash-latest": {"input": 0.15, "output": 0.60},
            "models/gemini-1.5-pro": {"input": 3.50, "output": 10.50},
            "models/gemini-1.5-flash": {"input": 0.35, "output": 1.05},
            "claude-3.5-sonnet": {"input": 3.00, "output": 15.00},
            "claude-haiku-4.5": {"input": 0.25, "output": 1.25},
            "claude-sonnet-4": {"input": 3.00, "output": 15.00},
            "claude-opus-4.5": {"input": 15.00, "output": 75.00},
            "gpt-4o": {"input": 5.00, "output": 15.00},
            "gpt-4o-mini": {"input": 0.15, "output": 0.60},
            "gpt-5.2-instant": {"input": 0.50, "output": 1.50},
            "gpt-5.2-thinking": {"input": 10.00, "output": 30.00},
            "gpt-5.2-pro": {"input": 10.00, "output": 30.00},
        }

        # Default budgets (monthly)
        self.budgets = {
            "development": 100.0,  # $100/month for dev
            "production": 500.0,   # $500/month for prod
            "research": 50.0       # $50/month for research tasks
        }

    def _init_database(self):
        """Initialize SQLite database for cost tracking."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Usage records table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usage_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                model_name TEXT NOT NULL,
                provider TEXT NOT NULL,
                task_type TEXT,
                agent_id TEXT,
                mission_id TEXT,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                cost_usd REAL DEFAULT 0.0,
                latency_ms REAL DEFAULT 0.0,
                success INTEGER DEFAULT 1
            )
        """)

        # Budget tracking table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                budget_name TEXT PRIMARY KEY,
                limit_usd REAL NOT NULL,
                period TEXT DEFAULT 'monthly',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # Budget alerts table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS budget_alerts (
                alert_id TEXT PRIMARY KEY,
                budget_name TEXT NOT NULL,
                threshold_pct REAL NOT NULL,
                current_spend REAL NOT NULL,
                budget_limit REAL NOT NULL,
                triggered_at TEXT NOT NULL,
                severity TEXT NOT NULL,
                acknowledged INTEGER DEFAULT 0
            )
        """)

        # Indices for fast queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_usage_timestamp
            ON usage_records(timestamp)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_usage_model
            ON usage_records(model_name)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_usage_agent
            ON usage_records(agent_id)
        """)

        conn.commit()
        conn.close()

        logger.debug(f"Initialized cost tracking database at {self.db_path}")

    # ==================== Usage Recording ====================

    def record_usage(
        self,
        model_name: str,
        provider: str,
        input_tokens: int,
        output_tokens: int,
        task_type: Optional[str] = None,
        agent_id: Optional[str] = None,
        mission_id: Optional[str] = None,
        latency_ms: float = 0.0,
        success: bool = True
    ) -> UsageRecord:
        """
        Record a single model usage event.

        Args:
            model_name: Name of the model used
            provider: Provider (google, anthropic, openai, etc.)
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            task_type: Optional task type
            agent_id: Optional agent ID
            mission_id: Optional mission ID
            latency_ms: Request latency in milliseconds
            success: Whether the request succeeded

        Returns:
            UsageRecord object
        """
        # Calculate cost
        cost = self._calculate_cost(model_name, input_tokens, output_tokens)

        record = UsageRecord(
            timestamp=datetime.now().isoformat(),
            model_name=model_name,
            provider=provider,
            task_type=task_type or "unknown",
            agent_id=agent_id or "unknown",
            mission_id=mission_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            cost_usd=cost,
            latency_ms=latency_ms,
            success=success
        )

        # Save to database
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO usage_records (
                timestamp, model_name, provider, task_type, agent_id, mission_id,
                input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, success
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record.timestamp, record.model_name, record.provider, record.task_type,
            record.agent_id, record.mission_id, record.input_tokens, record.output_tokens,
            record.total_tokens, record.cost_usd, record.latency_ms, int(record.success)
        ))

        record.id = cursor.lastrowid

        conn.commit()
        conn.close()

        logger.info(
            f"Recorded model usage",
            extra={
                "model": model_name,
                "tokens": record.total_tokens,
                "cost_usd": f"${cost:.4f}",
                "agent": agent_id
            }
        )

        # Check budgets
        self._check_budgets()

        return record

    def _calculate_cost(self, model_name: str, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost for a model usage."""
        rates = self.cost_rates.get(model_name, {"input": 0.0, "output": 0.0})

        input_cost = (input_tokens / 1_000_000) * rates["input"]
        output_cost = (output_tokens / 1_000_000) * rates["output"]

        return input_cost + output_cost

    # ==================== Budget Management ====================

    def set_budget(self, budget_name: str, limit_usd: float, period: str = "monthly"):
        """
        Set or update a budget limit.

        Args:
            budget_name: Name of the budget (e.g., "development", "production")
            limit_usd: Budget limit in USD
            period: Budget period ("monthly", "weekly", "daily")
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        now = datetime.now().isoformat()

        cursor.execute("""
            INSERT OR REPLACE INTO budgets (budget_name, limit_usd, period, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, (budget_name, limit_usd, period, now, now))

        conn.commit()
        conn.close()

        self.budgets[budget_name] = limit_usd

        logger.info(f"Set budget '{budget_name}' to ${limit_usd:.2f}/{period}")

    def get_current_spend(
        self,
        budget_name: Optional[str] = None,
        period: str = "monthly"
    ) -> float:
        """
        Get current spend for a budget period.

        Args:
            budget_name: Optional budget name filter
            period: "monthly", "weekly", or "daily"

        Returns:
            Total spend in USD
        """
        # Calculate time range
        now = datetime.now()
        if period == "monthly":
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif period == "weekly":
            start = now - timedelta(days=now.weekday())
            start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        else:  # daily
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT SUM(cost_usd) FROM usage_records
            WHERE timestamp >= ?
        """, (start.isoformat(),))

        result = cursor.fetchone()
        conn.close()

        return result[0] or 0.0

    def _check_budgets(self):
        """Check all budgets and trigger alerts if thresholds exceeded."""
        for budget_name, limit in self.budgets.items():
            current_spend = self.get_current_spend(budget_name)

            # Check thresholds
            thresholds = {
                0.8: "warning",   # 80% = warning
                0.95: "critical"  # 95% = critical
            }

            for threshold_pct, severity in thresholds.items():
                if current_spend >= limit * threshold_pct:
                    self._trigger_alert(
                        budget_name,
                        threshold_pct,
                        current_spend,
                        limit,
                        severity
                    )

    def _trigger_alert(
        self,
        budget_name: str,
        threshold_pct: float,
        current_spend: float,
        budget_limit: float,
        severity: str
    ):
        """Trigger a budget alert."""
        alert_id = f"{budget_name}_{threshold_pct}_{datetime.now().strftime('%Y%m')}"

        # Check if already triggered this month
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT alert_id FROM budget_alerts
            WHERE alert_id = ?
        """, (alert_id,))

        if cursor.fetchone():
            conn.close()
            return  # Already triggered

        # Create new alert
        alert = BudgetAlert(
            alert_id=alert_id,
            budget_name=budget_name,
            threshold_pct=threshold_pct,
            current_spend=current_spend,
            budget_limit=budget_limit,
            triggered_at=datetime.now().isoformat(),
            severity=severity
        )

        cursor.execute("""
            INSERT INTO budget_alerts (
                alert_id, budget_name, threshold_pct, current_spend, budget_limit,
                triggered_at, severity, acknowledged
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            alert.alert_id, alert.budget_name, alert.threshold_pct, alert.current_spend,
            alert.budget_limit, alert.triggered_at, alert.severity, 0
        ))

        conn.commit()
        conn.close()

        logger.warning(
            f"Budget alert triggered",
            extra={
                "budget": budget_name,
                "severity": severity,
                "current_spend": f"${current_spend:.2f}",
                "limit": f"${budget_limit:.2f}",
                "utilization": f"{(current_spend / budget_limit) * 100:.1f}%"
            }
        )

    # ==================== Analytics ====================

    def get_usage_by_model(self, days: int = 30) -> Dict[str, Dict[str, Any]]:
        """
        Get usage statistics grouped by model.

        Args:
            days: Number of days to analyze

        Returns:
            Dict mapping model names to usage stats
        """
        cutoff = datetime.now() - timedelta(days=days)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                model_name,
                COUNT(*) as request_count,
                SUM(total_tokens) as total_tokens,
                SUM(cost_usd) as total_cost,
                AVG(latency_ms) as avg_latency,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count
            FROM usage_records
            WHERE timestamp >= ?
            GROUP BY model_name
        """, (cutoff.isoformat(),))

        results = {}
        for row in cursor.fetchall():
            model, req_count, tokens, cost, latency, success_count = row
            results[model] = {
                "request_count": req_count,
                "total_tokens": tokens,
                "total_cost_usd": cost,
                "avg_latency_ms": latency,
                "success_rate": success_count / req_count if req_count > 0 else 0,
                "cost_per_request": cost / req_count if req_count > 0 else 0
            }

        conn.close()

        return results

    def get_usage_by_agent(self, days: int = 30) -> Dict[str, Dict[str, Any]]:
        """Get usage statistics grouped by agent."""
        cutoff = datetime.now() - timedelta(days=days)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                agent_id,
                COUNT(*) as request_count,
                SUM(total_tokens) as total_tokens,
                SUM(cost_usd) as total_cost
            FROM usage_records
            WHERE timestamp >= ?
            GROUP BY agent_id
        """, (cutoff.isoformat(),))

        results = {}
        for row in cursor.fetchall():
            agent, req_count, tokens, cost = row
            results[agent] = {
                "request_count": req_count,
                "total_tokens": tokens,
                "total_cost_usd": cost,
                "avg_cost_per_request": cost / req_count if req_count > 0 else 0
            }

        conn.close()

        return results

    def get_cost_forecast(self, days_ahead: int = 30) -> Dict[str, float]:
        """
        Forecast future costs based on recent trends.

        Args:
            days_ahead: Number of days to forecast

        Returns:
            Dict with forecast data
        """
        # Get spend for last 30 days
        last_30_days = self.get_current_spend(period="monthly")

        # Simple linear extrapolation
        daily_avg = last_30_days / 30
        forecast = daily_avg * days_ahead

        return {
            "forecast_period_days": days_ahead,
            "historical_daily_avg": daily_avg,
            "forecasted_total": forecast,
            "confidence": "low"  # Simple linear model has low confidence
        }

    def recommend_cost_optimizations(self) -> List[Dict[str, Any]]:
        """
        Generate cost optimization recommendations.

        Returns:
            List of recommendation dicts
        """
        recommendations = []

        # Get usage by model
        model_usage = self.get_usage_by_model(days=30)

        # Recommend cheaper alternatives
        expensive_models = [
            (model, stats) for model, stats in model_usage.items()
            if stats["cost_per_request"] > 0.01  # More than $0.01 per request
        ]

        for model, stats in expensive_models:
            if "opus" in model.lower() or "gpt-5" in model.lower():
                recommendations.append({
                    "type": "model_substitution",
                    "current_model": model,
                    "suggested_alternative": "claude-sonnet-4" if "claude" in model else "gpt-4o",
                    "potential_savings_usd": stats["total_cost_usd"] * 0.5,  # Estimate 50% savings
                    "rationale": "Use cheaper model for non-critical tasks"
                })

        # Recommend caching for repeated queries
        # (Would need to analyze query patterns - simplified here)
        if len(model_usage) > 0:
            total_requests = sum(s["request_count"] for s in model_usage.values())
            if total_requests > 1000:
                recommendations.append({
                    "type": "caching",
                    "rationale": "High request volume detected - implement response caching",
                    "potential_savings_usd": sum(s["total_cost_usd"] for s in model_usage.values()) * 0.2
                })

        return recommendations


# Singleton instance
_cost_tracker = None


def get_cost_tracker() -> CostTracker:
    """Get the global cost tracker instance."""
    global _cost_tracker
    if _cost_tracker is None:
        _cost_tracker = CostTracker()
    return _cost_tracker
