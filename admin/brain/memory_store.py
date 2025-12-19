"""
Memory Store - Persistent Memory System for Studio OS

This module provides a SQLite-backed memory store that enables:
- Conversation history persistence
- Feedback loop learning (liked/disliked content)
- Generation history tracking
- Cross-session learning
"""

import os
import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
import logging
import math

logger = logging.getLogger("MemoryStore")


class MemoryStore:
    """
    Persistent memory store using SQLite.
    Enables the AI to remember past interactions and learn from feedback.
    """
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = os.path.join(os.path.dirname(__file__), "studio_memory.db")
        self.db_path = db_path
        self._init_db()
        
    def _init_db(self):
        """Initialize the database schema."""
        conn = sqlite3.connect(self.db_path, timeout=30)
        cursor = conn.cursor()
        
        # Enable WAL mode for better concurrency
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        
        # Conversations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                agent TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Feedback table (for learning)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_id TEXT NOT NULL,
                content_type TEXT NOT NULL,
                rating INTEGER NOT NULL,
                notes TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Generation history
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS generations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic TEXT NOT NULL,
                provider TEXT,
                content TEXT,
                filename TEXT,
                success BOOLEAN,
                duration_seconds REAL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Agent actions (for learning patterns)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_name TEXT NOT NULL,
                action_type TEXT NOT NULL,
                input_data TEXT,
                output_data TEXT,
                success BOOLEAN,
                duration_seconds REAL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insights table (learned patterns)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS insights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                insight_type TEXT NOT NULL,
                insight_data TEXT NOT NULL,
                confidence REAL,
                source TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Lessons table (specific actionable learnings)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lessons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_name TEXT NOT NULL,
                lesson TEXT NOT NULL,
                context TEXT,
                outcome TEXT,
                tags TEXT, -- JSON list of tags
                learned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_used DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Vector Store (for Semantic Search)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vector_store (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id TEXT NOT NULL,
                text_chunk TEXT NOT NULL,
                vector JSON NOT NULL,
                metadata JSON,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Decisions Table ("Does this feel right?" Ledger)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS decisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic TEXT NOT NULL,
                context TEXT,
                decision TEXT NOT NULL, -- 'yes', 'no', 'defer'
                agent_id TEXT,
                metadata JSON,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Raw Intake Table (The OS Intake Pipeline)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS raw_intake (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_type TEXT NOT NULL, -- 'file', 'url', 'text', 'repo'
                source_path TEXT,
                content TEXT,
                metadata JSON,
                status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
                processed_at DATETIME,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Agent Subscriptions Tracker (Who has seen what)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                intake_id INTEGER NOT NULL,
                agent_id TEXT NOT NULL,
                status TEXT DEFAULT 'pending', -- 'pending', 'indexing', 'summarizing', 'completed', 'failed'
                result_metadata JSON,
                processed_at DATETIME,
                FOREIGN KEY (intake_id) REFERENCES raw_intake (id)
            )
        """)
        
        conn.commit()
        conn.close()
        logger.info(f"Memory store initialized at {self.db_path}")
    
    # ==================== Conversation Memory ====================
    
    def save_conversation(self, session_id: str, role: str, content: str, agent: str = None):
        """Save a conversation message."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO conversations (session_id, role, content, agent) VALUES (?, ?, ?, ?)",
            (session_id, role, content, agent)
        )
        conn.commit()
        conn.close()
        
    def get_conversation_history(self, session_id: str, limit: int = 50) -> List[Dict]:
        """Retrieve conversation history for a session."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT role, content, agent, timestamp FROM conversations WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?",
            (session_id, limit)
        )
        rows = cursor.fetchall()
        conn.close()
        return [{"role": r[0], "content": r[1], "agent": r[2], "timestamp": r[3]} for r in reversed(rows)]
    
    def get_recent_context(self, limit: int = 10) -> List[Dict]:
        """Get recent conversations across all sessions for context."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT role, content, agent, timestamp FROM conversations ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [{"role": r[0], "content": r[1], "agent": r[2], "timestamp": r[3]} for r in reversed(rows)]
    
    # ==================== Feedback Learning ====================
    
    def save_feedback(self, content_id: str, content_type: str, rating: int, notes: str = None):
        """
        Save feedback on generated content.
        Rating: 1-5 (1=poor, 5=excellent)
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO feedback (content_id, content_type, rating, notes) VALUES (?, ?, ?, ?)",
            (content_id, content_type, rating, notes)
        )
        conn.commit()
        conn.close()
        logger.info(f"Feedback saved: {content_id} rated {rating}/5")
        
    def get_feedback_patterns(self, content_type: str = None) -> Dict:
        """Analyze feedback to find patterns."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if content_type:
            cursor.execute(
                "SELECT AVG(rating), COUNT(*) FROM feedback WHERE content_type = ?",
                (content_type,)
            )
        else:
            cursor.execute("SELECT AVG(rating), COUNT(*) FROM feedback")
            
        row = cursor.fetchone()
        avg_rating = row[0] if row[0] else 0
        total = row[1]
        
        # Get highly rated content patterns
        cursor.execute(
            "SELECT content_id, rating, notes FROM feedback WHERE rating >= 4 ORDER BY timestamp DESC LIMIT 10"
        )
        high_rated = cursor.fetchall()
        
        # Get poorly rated content patterns
        cursor.execute(
            "SELECT content_id, rating, notes FROM feedback WHERE rating <= 2 ORDER BY timestamp DESC LIMIT 10"
        )
        low_rated = cursor.fetchall()
        
        conn.close()
        
        return {
            "average_rating": round(avg_rating, 2),
            "total_feedback": total,
            "high_rated": [{"id": r[0], "rating": r[1], "notes": r[2]} for r in high_rated],
            "low_rated": [{"id": r[0], "rating": r[1], "notes": r[2]} for r in low_rated]
        }
    
    # ==================== Generation History ====================
    
    def log_generation(self, topic: str, provider: str, content: str, filename: str, 
                       success: bool, duration_seconds: float):
        """Log a content generation attempt."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO generations 
               (topic, provider, content, filename, success, duration_seconds) 
               VALUES (?, ?, ?, ?, ?, ?)""",
            (topic, provider, content[:1000] if content else None, filename, success, duration_seconds)
        )
        conn.commit()
        conn.close()
        
    def get_generation_stats(self) -> Dict:
        """Get statistics about content generation."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Success rate
        cursor.execute("SELECT COUNT(*) FROM generations WHERE success = 1")
        successful = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM generations")
        total = cursor.fetchone()[0]
        
        # Average duration
        cursor.execute("SELECT AVG(duration_seconds) FROM generations WHERE success = 1")
        avg_duration = cursor.fetchone()[0] or 0
        
        # By provider
        cursor.execute(
            """SELECT provider, COUNT(*), AVG(duration_seconds) 
               FROM generations GROUP BY provider"""
        )
        by_provider = {r[0]: {"count": r[1], "avg_duration": round(r[2] or 0, 2)} 
                       for r in cursor.fetchall()}
        
        conn.close()
        
        return {
            "total_generations": total,
            "successful": successful,
            "success_rate": round(successful / total * 100, 1) if total > 0 else 0,
            "avg_duration_seconds": round(avg_duration, 2),
            "by_provider": by_provider
        }
    
    # ==================== Agent Actions ====================
    
    def log_agent_action(self, agent_name: str, action_type: str, 
                         input_data: Any = None, output_data: Any = None,
                         success: bool = True, duration_seconds: float = 0):
        """Log an action taken by an agent."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO agent_actions 
               (agent_name, action_type, input_data, output_data, success, duration_seconds) 
               VALUES (?, ?, ?, ?, ?, ?)""",
            (agent_name, action_type, 
             json.dumps(input_data) if input_data else None,
             json.dumps(output_data) if output_data else None,
             success, duration_seconds)
        )
        conn.commit()
        conn.close()
        
    def get_agent_performance(self, agent_name: str = None) -> Dict:
        """Get performance metrics for agents."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if agent_name:
            cursor.execute(
                """SELECT action_type, COUNT(*), 
                   SUM(CASE WHEN success THEN 1 ELSE 0 END),
                   AVG(duration_seconds)
                   FROM agent_actions WHERE agent_name = ? GROUP BY action_type""",
                (agent_name,)
            )
        else:
            cursor.execute(
                """SELECT agent_name, COUNT(*), 
                   SUM(CASE WHEN success THEN 1 ELSE 0 END),
                   AVG(duration_seconds)
                   FROM agent_actions GROUP BY agent_name"""
            )
            
        rows = cursor.fetchall()
        conn.close()
        
        return {
            r[0]: {
                "total_actions": r[1],
                "successful": r[2],
                "success_rate": round(r[2] / r[1] * 100, 1) if r[1] > 0 else 0,
                "avg_duration": round(r[3] or 0, 2)
            }
            for r in rows
        }
    
    # ==================== Insights ====================
    
    def save_insight(self, insight_type: str, insight_data: Dict, 
                     confidence: float = 0.5, source: str = None):
        """Save a learned insight."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO insights (insight_type, insight_data, confidence, source) VALUES (?, ?, ?, ?)",
            (insight_type, json.dumps(insight_data), confidence, source)
        )
        conn.commit()
        conn.close()
        logger.info(f"Insight saved: {insight_type} (confidence: {confidence})")
        
    def get_insights(self, insight_type: str = None, min_confidence: float = 0) -> List[Dict]:
        """Retrieve learned insights."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if insight_type:
            cursor.execute(
                """SELECT insight_type, insight_data, confidence, source, timestamp 
                   FROM insights WHERE insight_type = ? AND confidence >= ? 
                   ORDER BY timestamp DESC""",
                (insight_type, min_confidence)
            )
        else:
            cursor.execute(
                """SELECT insight_type, insight_data, confidence, source, timestamp 
                   FROM insights WHERE confidence >= ? ORDER BY timestamp DESC""",
                (min_confidence,)
            )
            
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                "type": r[0],
                "data": json.loads(r[1]),
                "confidence": r[2],
                "source": r[3],
                "timestamp": r[4]
            }
            for r in rows
        ]
    
    # ==================== Lessons ====================

    def save_lesson(self, agent_name: str, lesson: str, context: str, 
                   outcome: str, tags: List[str] = None):
        """Save a specific lesson learned."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Check if similar lesson exists to update frequency
        cursor.execute(
            "SELECT id, frequency FROM lessons WHERE lesson = ? AND agent_name = ?",
            (lesson, agent_name)
        )
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute(
                """UPDATE lessons 
                   SET frequency = frequency + 1, last_used = CURRENT_TIMESTAMP 
                   WHERE id = ?""",
                (existing[0],)
            )
            logger.info(f"Updated lesson frequency: {lesson[:30]}...")
        else:
            cursor.execute(
                """INSERT INTO lessons 
                   (agent_name, lesson, context, outcome, tags) 
                   VALUES (?, ?, ?, ?, ?)""",
                (agent_name, lesson, context, outcome, json.dumps(tags or []))
            )
            logger.info(f"New lesson saved: {lesson[:30]}...")
            
        conn.commit()
        conn.close()

    def search_lessons(self, query: str = None, tags: List[str] = None, 
                      limit: int = 5) -> List[Dict]:
        """Search for lessons relevant to a query or tags."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        sql = "SELECT * FROM lessons"
        params = []
        conditions = []
        
        if tags:
            # This is a simple text match for tags, ideal would be JSON operators but SQLite is limited
            tag_conditions = []
            for tag in tags:
                tag_conditions.append("tags LIKE ?")
                params.append(f"%{tag}%")
            if tag_conditions:
                conditions.append(f"({' OR '.join(tag_conditions)})")
                
        if query:
            # Simple keyword search on lesson and context
            conditions.append("(lesson LIKE ? OR context LIKE ?)")
            params.append(f"%{query}%")
            params.append(f"%{query}%")
            
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
            
        sql += " ORDER BY frequency DESC, learned_at DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            results.append({
                "agent_name": row["agent_name"],
                "lesson": row["lesson"],
                "context": row["context"],
                "outcome": row["outcome"],
                "tags": json.loads(row["tags"]) if row["tags"] else [],
                "frequency": row["frequency"]
            })
            
        conn.close()
        return results
    
    # ==================== Vector Search ====================

    def save_embedding(self, doc_id: str, text: str, vector: List[float], metadata: Dict = None):
        """Save a text chunk and its embedding vector."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Check if exists to update (simple upsert logic equivalent)
        cursor.execute("SELECT id FROM vector_store WHERE doc_id = ? AND text_chunk = ?", (doc_id, text))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute(
                "UPDATE vector_store SET vector = ?, metadata = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?",
                (json.dumps(vector), json.dumps(metadata or {}), existing[0])
            )
        else:
            cursor.execute(
                "INSERT INTO vector_store (doc_id, text_chunk, vector, metadata) VALUES (?, ?, ?, ?)",
                (doc_id, text, json.dumps(vector), json.dumps(metadata or {}))
            )
            
        conn.commit()
        conn.close()

    def search_vectors(self, query_vector: List[float], limit: int = 5) -> List[Dict]:
        """
        Search for most similar vectors using cosine similarity.
        Note: Performed in-memory. For <100k items, this is fast enough.
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Fetch all vectors (optimization: could filter by metadata if needed)
        cursor.execute("SELECT doc_id, text_chunk, vector, metadata FROM vector_store")
        rows = cursor.fetchall()
        conn.close()
        
        results = []
        
        # Calculate Cosine Similarity
        # Dot product / (Magnitude A * Magnitude B)
        # Assuming query_vector is already normalized can allow optimization, but we'll do full calc
        
        def cosine_similarity(v1, v2):
            dot_product = sum(a * b for a, b in zip(v1, v2))
            magnitude1 = math.sqrt(sum(a * a for a in v1))
            magnitude2 = math.sqrt(sum(b * b for b in v2))
            if magnitude1 == 0 or magnitude2 == 0:
                return 0
            return dot_product / (magnitude1 * magnitude2)

        for row in rows:
            try:
                vec = json.loads(row["vector"])
                score = cosine_similarity(query_vector, vec)
                if score > 0.3: # Threshold
                    results.append({
                        "doc_id": row["doc_id"],
                        "text": row["text_chunk"],
                        "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                        "score": score
                    })
            except Exception as e:
                continue
                
        # Sort by score DESC
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    # ==================== Decisions Ledger ====================

    def save_decision(self, topic: str, decision: str, context: str = None, 
                      agent_id: str = None, metadata: Dict = None):
        """Save a 'Does this feel right?' decision."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO decisions (topic, decision, context, agent_id, metadata) 
               VALUES (?, ?, ?, ?, ?)""",
            (topic, decision, context, agent_id, json.dumps(metadata or {}))
        )
        conn.commit()
        conn.close()
        logger.info(f"Decision logged: {topic} -> {decision}")

    def get_decision_history(self, limit: int = 20) -> List[Dict]:
        """Retrieve recent decisions."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM decisions ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        )
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                "id": r["id"],
                "topic": r["topic"],
                "decision": r["decision"],
                "context": r["context"],
                "agent_id": r["agent_id"],
                "metadata": json.loads(r["metadata"]) if r["metadata"] else {},
                "timestamp": r["timestamp"]
            }
            for r in rows
        ]

    # ==================== Summary ====================
    
    def get_memory_summary(self) -> Dict:
        """Get a summary of all stored memories."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        summary = {}
        for table in ["conversations", "feedback", "generations", "agent_actions", "insights"]:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            summary[table] = cursor.fetchone()[0]
            
        conn.close()
        return summary


# Singleton instance for global access
_memory_store = None

def get_memory_store() -> MemoryStore:
    """Get the global memory store instance."""
    global _memory_store
    if _memory_store is None:
        _memory_store = MemoryStore()
    return _memory_store


if __name__ == "__main__":
    # Test the memory store
    store = MemoryStore()
    
    # Test conversation
    store.save_conversation("test-session", "user", "Hello!")
    store.save_conversation("test-session", "assistant", "Hi there!", "Alchemist")
    
    # Test feedback
    store.save_feedback("post-001", "blog_post", 5, "Great content!")
    
    # Test generation logging
    store.log_generation("AI Ethics", "gemini", "Test content...", "ai-ethics.md", True, 5.2)
    
    # Test agent action
    store.log_agent_action("Guardian", "audit", {"content": "test"}, {"issues": []}, True, 0.5)
    
    # Print summary
    print("Memory Summary:", store.get_memory_summary())
    print("Generation Stats:", store.get_generation_stats())
    print("Feedback Patterns:", store.get_feedback_patterns())
