"""
Structured Logging System with Trace IDs
Sovereign Laboratory OS - Observability Infrastructure

Features:
- Trace ID propagation across agent calls
- Structured JSON logging for production
- Context managers for automatic trace injection
- Integration with mission state tracking
- Correlation IDs for multi-agent coordination
"""

import logging
import json
import uuid
import contextvars
from datetime import datetime
from typing import Dict, Any, Optional
from enum import Enum


# Context variables for trace propagation
trace_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    'trace_id', default=None
)
mission_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    'mission_id', default=None
)
agent_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    'agent_id', default=None
)


class LogLevel(Enum):
    """Log severity levels."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class StructuredLogger:
    """
    Enhanced logger with trace ID support and structured output.

    Usage:
        logger = StructuredLogger("AgentName")

        with logger.trace_context(mission_id="m123"):
            logger.info("Processing task", extra={"task_id": "t456"})
            # Output: {"timestamp": "...", "level": "INFO", "trace_id": "...",
            #          "mission_id": "m123", "message": "Processing task", "task_id": "t456"}
    """

    def __init__(self, name: str, enable_json: bool = False):
        """
        Initialize structured logger.

        Args:
            name: Logger name (typically agent ID or module name)
            enable_json: If True, output JSON instead of human-readable format
        """
        self.name = name
        self.enable_json = enable_json
        self.logger = logging.getLogger(name)

        # Configure formatter
        if enable_json:
            handler = logging.StreamHandler()
            handler.setFormatter(JSONFormatter())
            self.logger.addHandler(handler)
            self.logger.propagate = False

    def _build_context(self, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Build logging context with trace IDs and metadata."""
        context = {
            "timestamp": datetime.now().isoformat(),
            "logger": self.name,
            "trace_id": trace_id_var.get(),
            "mission_id": mission_id_var.get(),
            "agent_id": agent_id_var.get(),
        }

        # Remove None values
        context = {k: v for k, v in context.items() if v is not None}

        # Merge with extra fields
        if extra:
            context.update(extra)

        return context

    def debug(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log debug message with context."""
        context = self._build_context(extra)
        if self.enable_json:
            context["level"] = "DEBUG"
            context["message"] = message
            self.logger.debug(json.dumps(context))
        else:
            trace = context.get("trace_id", "")[:8]
            self.logger.debug(f"[{trace}] {message}", extra=context)

    def info(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log info message with context."""
        context = self._build_context(extra)
        if self.enable_json:
            context["level"] = "INFO"
            context["message"] = message
            self.logger.info(json.dumps(context))
        else:
            trace = context.get("trace_id", "")[:8]
            self.logger.info(f"[{trace}] {message}", extra=context)

    def warning(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log warning message with context."""
        context = self._build_context(extra)
        if self.enable_json:
            context["level"] = "WARNING"
            context["message"] = message
            self.logger.warning(json.dumps(context))
        else:
            trace = context.get("trace_id", "")[:8]
            self.logger.warning(f"[{trace}] {message}", extra=context)

    def error(self, message: str, extra: Optional[Dict[str, Any]] = None, exc_info: bool = False):
        """Log error message with context."""
        context = self._build_context(extra)
        if self.enable_json:
            context["level"] = "ERROR"
            context["message"] = message
            self.logger.error(json.dumps(context), exc_info=exc_info)
        else:
            trace = context.get("trace_id", "")[:8]
            self.logger.error(f"[{trace}] {message}", extra=context, exc_info=exc_info)

    def critical(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log critical message with context."""
        context = self._build_context(extra)
        if self.enable_json:
            context["level"] = "CRITICAL"
            context["message"] = message
            self.logger.critical(json.dumps(context))
        else:
            trace = context.get("trace_id", "")[:8]
            self.logger.critical(f"[{trace}] {message}", extra=context)

    def trace_context(
        self,
        trace_id: Optional[str] = None,
        mission_id: Optional[str] = None,
        agent_id: Optional[str] = None
    ):
        """
        Context manager for trace ID propagation.

        Usage:
            with logger.trace_context(mission_id="m123"):
                logger.info("Task started")
                # All logs within this context will have mission_id="m123"
        """
        return TraceContext(trace_id, mission_id, agent_id)


class TraceContext:
    """Context manager for trace ID propagation."""

    def __init__(
        self,
        trace_id: Optional[str] = None,
        mission_id: Optional[str] = None,
        agent_id: Optional[str] = None
    ):
        self.trace_id = trace_id or str(uuid.uuid4())
        self.mission_id = mission_id
        self.agent_id = agent_id

        self.trace_token = None
        self.mission_token = None
        self.agent_token = None

    def __enter__(self):
        """Set context variables."""
        self.trace_token = trace_id_var.set(self.trace_id)
        if self.mission_id:
            self.mission_token = mission_id_var.set(self.mission_id)
        if self.agent_id:
            self.agent_token = agent_id_var.set(self.agent_id)
        return self

    def __exit__(self, *args):
        """Reset context variables."""
        if self.trace_token:
            trace_id_var.reset(self.trace_token)
        if self.mission_token:
            mission_id_var.reset(self.mission_token)
        if self.agent_token:
            agent_id_var.reset(self.agent_token)


class JSONFormatter(logging.Formatter):
    """Formatter for structured JSON logs."""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add trace context if available
        if hasattr(record, 'trace_id'):
            log_data["trace_id"] = record.trace_id
        if hasattr(record, 'mission_id'):
            log_data["mission_id"] = record.mission_id
        if hasattr(record, 'agent_id'):
            log_data["agent_id"] = record.agent_id

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


def get_logger(name: str, json_mode: bool = False) -> StructuredLogger:
    """
    Factory function for creating structured loggers.

    Args:
        name: Logger name (typically agent ID or module name)
        json_mode: If True, enable JSON output

    Returns:
        StructuredLogger instance
    """
    return StructuredLogger(name, enable_json=json_mode)


def get_current_trace_id() -> Optional[str]:
    """Get the current trace ID from context."""
    return trace_id_var.get()


def get_current_mission_id() -> Optional[str]:
    """Get the current mission ID from context."""
    return mission_id_var.get()


def get_current_agent_id() -> Optional[str]:
    """Get the current agent ID from context."""
    return agent_id_var.get()


# Example usage and integration patterns
if __name__ == "__main__":
    # Example 1: Basic usage
    logger = get_logger("TestAgent")

    with logger.trace_context(mission_id="mission_123", agent_id="alchemist"):
        logger.info("Starting content transformation")
        logger.debug("Loading source material", extra={"source": "blog_post.md"})
        logger.info("Transformation complete", extra={"output_formats": ["tweet", "linkedin"]})

    # Example 2: JSON mode (for production)
    json_logger = get_logger("ProductionAgent", json_mode=True)

    with json_logger.trace_context(mission_id="m456"):
        json_logger.info("Processing task")
        try:
            raise ValueError("Simulated error")
        except Exception as e:
            json_logger.error("Task failed", exc_info=True)

    # Example 3: Nested contexts (trace ID propagates)
    outer_logger = get_logger("OuterAgent")
    inner_logger = get_logger("InnerAgent")

    with outer_logger.trace_context(mission_id="parent_mission"):
        outer_logger.info("Parent task started")

        # Inner context inherits trace_id from outer
        with inner_logger.trace_context(agent_id="child_agent"):
            inner_logger.info("Child task started")
            # Both logs will have the same trace_id for correlation
