"""
Brain Module - Persistent Memory and Learning System for Studio OS

This module contains the AI's persistent memory and analytics infrastructure:
- memory_store: SQLite-backed conversation, feedback, and learning storage
- metrics_collector: Performance analytics and trend identification
- collective_intelligence: Shared knowledge and team coordination
"""

from .memory_store import MemoryStore, get_memory_store
from .metrics_collector import MetricsCollector, get_metrics_collector
from .collective_intelligence import CollectiveIntelligence, get_collective_intelligence

__all__ = [
    'MemoryStore',
    'get_memory_store',
    'MetricsCollector', 
    'get_metrics_collector',
    'CollectiveIntelligence',
    'get_collective_intelligence'
]
