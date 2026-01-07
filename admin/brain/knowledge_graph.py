"""
Knowledge Graph - Enhanced Collective Intelligence
Sovereign Laboratory OS - Phase 2 Intelligence Amplification

Features:
- Graph-based knowledge representation
- Agent expertise mapping with confidence scores
- Decision history analysis and pattern extraction
- Cross-agent learning with attribution
- Knowledge relevance scoring
- Temporal knowledge decay
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, asdict
from collections import defaultdict
import hashlib

from admin.brain.memory_store import get_memory_store
from admin.brain.structured_logging import get_logger

logger = get_logger("KnowledgeGraph")


@dataclass
class KnowledgeNode:
    """A single piece of knowledge in the graph."""
    id: str
    type: str  # "insight", "lesson", "decision", "pattern"
    content: Dict[str, Any]
    source_agent: str
    confidence: float  # 0.0 to 1.0
    created_at: str
    accessed_count: int = 0
    last_accessed: Optional[str] = None
    tags: List[str] = None
    related_nodes: List[str] = None  # IDs of related knowledge

    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.related_nodes is None:
            self.related_nodes = []


@dataclass
class AgentExpertise:
    """Tracks an agent's expertise with evidence."""
    agent_id: str
    skill: str
    confidence: float  # 0.0 to 1.0
    evidence_count: int  # Number of successful applications
    last_demonstrated: str
    success_rate: float  # Percentage of successful uses


class KnowledgeGraph:
    """
    Enhanced knowledge graph for cross-agent learning.

    Improvements over basic collective_intelligence.py:
    - Graph structure for knowledge relationships
    - Confidence scoring with temporal decay
    - Pattern extraction from decision history
    - Agent expertise with evidence tracking
    - Knowledge relevance ranking
    """

    def __init__(self):
        self.memory = get_memory_store()
        self.nodes: Dict[str, KnowledgeNode] = {}
        self.agent_expertise: Dict[Tuple[str, str], AgentExpertise] = {}
        self.decision_patterns: Dict[str, List[Dict]] = defaultdict(list)

    # ==================== Core Knowledge Operations ====================

    def add_knowledge(
        self,
        knowledge_type: str,
        content: Dict[str, Any],
        source_agent: str,
        confidence: float = 0.7,
        tags: List[str] = None,
        related_to: List[str] = None
    ) -> str:
        """
        Add a new knowledge node to the graph.

        Args:
            knowledge_type: Type of knowledge (insight, lesson, decision, pattern)
            content: The actual knowledge data
            source_agent: Agent that contributed this knowledge
            confidence: Initial confidence score (0.0 to 1.0)
            tags: Optional tags for categorization
            related_to: IDs of related knowledge nodes

        Returns:
            The unique ID of the created knowledge node
        """
        # Generate stable ID based on content
        node_id = self._generate_node_id(knowledge_type, content, source_agent)

        # Check if already exists
        if node_id in self.nodes:
            logger.debug(f"Knowledge node {node_id[:8]} already exists, updating confidence")
            self._update_confidence(node_id, confidence)
            return node_id

        # Create new node
        node = KnowledgeNode(
            id=node_id,
            type=knowledge_type,
            content=content,
            source_agent=source_agent,
            confidence=confidence,
            created_at=datetime.now().isoformat(),
            tags=tags or [],
            related_nodes=related_to or []
        )

        self.nodes[node_id] = node

        # Update expertise tracking if this is evidence of skill
        if knowledge_type in ["lesson", "decision"] and "skill_used" in content:
            self._record_expertise_evidence(
                source_agent,
                content["skill_used"],
                content.get("success", True)
            )

        logger.info(
            f"Added knowledge node",
            extra={
                "node_id": node_id[:8],
                "type": knowledge_type,
                "source": source_agent,
                "confidence": confidence
            }
        )

        return node_id

    def get_knowledge(
        self,
        knowledge_type: Optional[str] = None,
        min_confidence: float = 0.5,
        tags: Optional[List[str]] = None,
        max_age_days: Optional[int] = None,
        limit: int = 100
    ) -> List[KnowledgeNode]:
        """
        Retrieve knowledge nodes with filtering and ranking.

        Args:
            knowledge_type: Filter by type (None = all types)
            min_confidence: Minimum confidence threshold
            tags: Filter by tags (must have at least one matching tag)
            max_age_days: Only return knowledge newer than this
            limit: Maximum number of results

        Returns:
            List of knowledge nodes, ranked by relevance
        """
        results = []

        for node in self.nodes.values():
            # Type filter
            if knowledge_type and node.type != knowledge_type:
                continue

            # Confidence filter (with temporal decay)
            current_confidence = self._get_current_confidence(node)
            if current_confidence < min_confidence:
                continue

            # Tag filter
            if tags and not any(tag in node.tags for tag in tags):
                continue

            # Age filter
            if max_age_days:
                created = datetime.fromisoformat(node.created_at)
                age = datetime.now() - created
                if age.days > max_age_days:
                    continue

            results.append(node)

        # Rank by relevance score
        results = self._rank_by_relevance(results)

        return results[:limit]

    def link_knowledge(self, node_id1: str, node_id2: str, relationship: str = "related"):
        """
        Create a bidirectional link between knowledge nodes.

        Args:
            node_id1: First node ID
            node_id2: Second node ID
            relationship: Type of relationship (e.g., "related", "contradicts", "supports")
        """
        if node_id1 not in self.nodes or node_id2 not in self.nodes:
            logger.warning(f"Cannot link: one or both nodes not found")
            return

        # Add bidirectional links
        if node_id2 not in self.nodes[node_id1].related_nodes:
            self.nodes[node_id1].related_nodes.append(node_id2)

        if node_id1 not in self.nodes[node_id2].related_nodes:
            self.nodes[node_id2].related_nodes.append(node_id1)

        logger.debug(f"Linked knowledge nodes: {node_id1[:8]} ↔ {node_id2[:8]}")

    # ==================== Decision History Analysis ====================

    def analyze_decision_history(
        self,
        agent_id: Optional[str] = None,
        min_occurrences: int = 3
    ) -> Dict[str, List[Dict]]:
        """
        Extract patterns from decision history.

        Args:
            agent_id: Filter by specific agent (None = all agents)
            min_occurrences: Minimum times a pattern must occur

        Returns:
            Dictionary of pattern types to pattern instances
        """
        # Get all decision nodes
        decisions = [n for n in self.nodes.values() if n.type == "decision"]

        if agent_id:
            decisions = [d for d in decisions if d.source_agent == agent_id]

        patterns = {
            "successful_approaches": [],
            "common_failures": [],
            "context_specific_strategies": []
        }

        # Group by outcome
        successes = [d for d in decisions if d.content.get("outcome") == "success"]
        failures = [d for d in decisions if d.content.get("outcome") == "failure"]

        # Find successful patterns
        success_contexts = defaultdict(int)
        for decision in successes:
            context = decision.content.get("context_type", "unknown")
            success_contexts[context] += 1

        for context, count in success_contexts.items():
            if count >= min_occurrences:
                patterns["successful_approaches"].append({
                    "context": context,
                    "occurrences": count,
                    "confidence": count / len(successes) if successes else 0
                })

        # Find failure patterns
        failure_reasons = defaultdict(int)
        for decision in failures:
            reason = decision.content.get("failure_reason", "unknown")
            failure_reasons[reason] += 1

        for reason, count in failure_reasons.items():
            if count >= min_occurrences:
                patterns["common_failures"].append({
                    "reason": reason,
                    "occurrences": count,
                    "impact": count / len(failures) if failures else 0
                })

        # Context-specific strategies
        context_strategies = defaultdict(lambda: defaultdict(int))
        for decision in decisions:
            context = decision.content.get("context_type", "unknown")
            strategy = decision.content.get("strategy_used", "unknown")
            outcome = decision.content.get("outcome", "unknown")

            if outcome == "success":
                context_strategies[context][strategy] += 1

        for context, strategies in context_strategies.items():
            for strategy, count in strategies.items():
                if count >= min_occurrences:
                    patterns["context_specific_strategies"].append({
                        "context": context,
                        "strategy": strategy,
                        "success_count": count
                    })

        logger.info(
            f"Analyzed decision history",
            extra={
                "total_decisions": len(decisions),
                "successful_approaches": len(patterns["successful_approaches"]),
                "common_failures": len(patterns["common_failures"])
            }
        )

        return patterns

    # ==================== Agent Expertise Tracking ====================

    def get_agent_expertise(
        self,
        agent_id: Optional[str] = None,
        skill: Optional[str] = None,
        min_confidence: float = 0.6
    ) -> List[AgentExpertise]:
        """
        Get agent expertise with evidence-based confidence.

        Args:
            agent_id: Filter by specific agent
            skill: Filter by specific skill
            min_confidence: Minimum confidence threshold

        Returns:
            List of AgentExpertise records
        """
        results = []

        for (a_id, s), expertise in self.agent_expertise.items():
            # Filters
            if agent_id and a_id != agent_id:
                continue
            if skill and s != skill:
                continue
            if expertise.confidence < min_confidence:
                continue

            results.append(expertise)

        # Sort by confidence
        results.sort(key=lambda x: x.confidence, reverse=True)

        return results

    def recommend_agent_for_task(
        self,
        required_skills: List[str],
        context: Optional[str] = None
    ) -> List[Tuple[str, float]]:
        """
        Recommend agents for a task based on required skills.

        Args:
            required_skills: List of skills needed
            context: Optional context for context-specific recommendations

        Returns:
            List of (agent_id, confidence_score) tuples, sorted by score
        """
        agent_scores = defaultdict(float)

        for skill in required_skills:
            experts = self.get_agent_expertise(skill=skill, min_confidence=0.5)

            for expert in experts:
                # Base score from confidence
                score = expert.confidence

                # Boost for high success rate
                score *= expert.success_rate

                # Recency bonus (expertise demonstrated in last 7 days gets +10%)
                last_demo = datetime.fromisoformat(expert.last_demonstrated)
                days_since = (datetime.now() - last_demo).days
                if days_since <= 7:
                    score *= 1.1
                elif days_since > 30:
                    score *= 0.9  # Slight penalty for stale expertise

                agent_scores[expert.agent_id] += score

        # Normalize by number of required skills
        for agent in agent_scores:
            agent_scores[agent] /= len(required_skills)

        # Sort by score
        recommendations = sorted(agent_scores.items(), key=lambda x: x[1], reverse=True)

        return recommendations

    # ==================== Private Helper Methods ====================

    def _generate_node_id(self, knowledge_type: str, content: Dict, source: str) -> str:
        """Generate a stable ID for a knowledge node."""
        # Create a stable hash from content
        content_str = json.dumps(content, sort_keys=True)
        hash_input = f"{knowledge_type}:{source}:{content_str}"
        return hashlib.sha256(hash_input.encode()).hexdigest()

    def _get_current_confidence(self, node: KnowledgeNode) -> float:
        """
        Calculate current confidence with temporal decay.

        Knowledge decays over time unless it's accessed frequently.
        """
        base_confidence = node.confidence

        # Calculate age in days
        created = datetime.fromisoformat(node.created_at)
        age_days = (datetime.now() - created).days

        # Decay factor: 1% per week for unaccessed knowledge
        decay_rate = 0.01
        decay_factor = 1.0 - (decay_rate * (age_days / 7))
        decay_factor = max(0.5, decay_factor)  # Minimum 50% retention

        # Access bonus: recent access reduces decay
        access_bonus = 1.0
        if node.last_accessed:
            last_access = datetime.fromisoformat(node.last_accessed)
            days_since_access = (datetime.now() - last_access).days
            if days_since_access <= 7:
                access_bonus = 1.1  # 10% boost for recent access

        return base_confidence * decay_factor * access_bonus

    def _update_confidence(self, node_id: str, new_evidence_confidence: float):
        """Update node confidence with new evidence (Bayesian update)."""
        node = self.nodes[node_id]

        # Simple weighted average (could use more sophisticated Bayesian update)
        node.confidence = (node.confidence + new_evidence_confidence) / 2

    def _rank_by_relevance(self, nodes: List[KnowledgeNode]) -> List[KnowledgeNode]:
        """
        Rank nodes by relevance score.

        Factors:
        - Confidence (with temporal decay)
        - Access frequency
        - Number of related nodes (centrality)
        """
        def relevance_score(node: KnowledgeNode) -> float:
            confidence = self._get_current_confidence(node)
            access_factor = min(node.accessed_count / 10, 1.0)  # Cap at 1.0
            centrality = min(len(node.related_nodes) / 5, 1.0)  # Cap at 1.0

            return confidence * 0.6 + access_factor * 0.2 + centrality * 0.2

        return sorted(nodes, key=relevance_score, reverse=True)

    def _record_expertise_evidence(
        self,
        agent_id: str,
        skill: str,
        success: bool
    ):
        """Record evidence of an agent demonstrating a skill."""
        key = (agent_id, skill)

        if key not in self.agent_expertise:
            # New expertise
            self.agent_expertise[key] = AgentExpertise(
                agent_id=agent_id,
                skill=skill,
                confidence=0.5,  # Start neutral
                evidence_count=1,
                last_demonstrated=datetime.now().isoformat(),
                success_rate=1.0 if success else 0.0
            )
        else:
            # Update existing
            expertise = self.agent_expertise[key]
            expertise.evidence_count += 1
            expertise.last_demonstrated = datetime.now().isoformat()

            # Update success rate (exponential moving average)
            alpha = 0.3  # Weight for new evidence
            new_success = 1.0 if success else 0.0
            expertise.success_rate = (
                alpha * new_success + (1 - alpha) * expertise.success_rate
            )

            # Update confidence based on evidence and success rate
            # More evidence + high success rate = higher confidence
            evidence_factor = min(expertise.evidence_count / 10, 1.0)
            expertise.confidence = 0.5 * evidence_factor + 0.5 * expertise.success_rate

    # ==================== Persistence ====================

    def export_graph(self) -> Dict:
        """Export the knowledge graph to a dict for serialization."""
        return {
            "nodes": {
                node_id: asdict(node)
                for node_id, node in self.nodes.items()
            },
            "agent_expertise": {
                f"{agent_id}:{skill}": asdict(expertise)
                for (agent_id, skill), expertise in self.agent_expertise.items()
            },
            "exported_at": datetime.now().isoformat()
        }

    def import_graph(self, data: Dict):
        """Import a knowledge graph from serialized data."""
        # Import nodes
        for node_id, node_data in data.get("nodes", {}).items():
            self.nodes[node_id] = KnowledgeNode(**node_data)

        # Import expertise
        for key, expertise_data in data.get("agent_expertise", {}).items():
            agent_id, skill = key.split(":", 1)
            self.agent_expertise[(agent_id, skill)] = AgentExpertise(**expertise_data)

        logger.info(
            f"Imported knowledge graph",
            extra={
                "nodes": len(self.nodes),
                "expertise_records": len(self.agent_expertise)
            }
        )


# Singleton instance
_knowledge_graph = None


def get_knowledge_graph() -> KnowledgeGraph:
    """Get the global knowledge graph instance."""
    global _knowledge_graph
    if _knowledge_graph is None:
        _knowledge_graph = KnowledgeGraph()
    return _knowledge_graph
