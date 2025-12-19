import os
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from admin.brain.memory_store import get_memory_store

logger = logging.getLogger("IntakeManager")

class IntakeManager:
    """
    The Central Intake Pipeline for Studio OS.
    Standardizes how every piece of work enters the system.
    """
    def __init__(self):
        self.memory = get_memory_store()

    def ingest(self, source_type: str, content: str = None, source_path: str = None, metadata: Dict = None) -> int:
        """
        Ingests a piece of work, chunks it, and emits a DOCUMENT_INGESTED event.
        """
        import sqlite3
        import hashlib
        
        doc_hash = hashlib.md5((content or "").encode()).hexdigest()
        
        logger.info(f"Ingesting {source_type} [{doc_hash}]: {source_path or 'direct text'}")
        
        # 1. Store Raw Intake
        conn = sqlite3.connect(self.memory.db_path, timeout=30)
        cursor = conn.cursor()
        
        cursor.execute(
            """INSERT INTO raw_intake (source_type, source_path, content, metadata) 
               VALUES (?, ?, ?, ?)""",
            (source_type, source_path, content, json.dumps(metadata or {}))
        )
        intake_id = cursor.lastrowid
        
        # 2. Chunking (Normalization)
        chunks = self.chunk_text(content or "")
        for i, chunk in enumerate(chunks):
            cursor.execute(
                "INSERT INTO vector_store (doc_id, text_chunk, vector, metadata) VALUES (?, ?, ?, ?)",
                (f"intake:{intake_id}:{i}", chunk, json.dumps([]), json.dumps({"source_id": intake_id, "type": source_type}))
            )
        
        # 3. Emit Event (Log-based for subscriptions)
        event = {
            "type": "DOCUMENT_INGESTED",
            "payload": {
                "intake_id": intake_id,
                "source_type": source_type,
                "chunk_count": len(chunks),
                "hash": doc_hash
            },
            "timestamp": datetime.now().isoformat()
        }
        
        cursor.execute(
            "INSERT INTO agent_actions (agent_name, action_type, input_data, success) VALUES (?, ?, ?, ?)",
            ("OS", "EVENT_EMIT", json.dumps(event), True)
        )
        
        # 4. Create initial subscriptions for core agents
        for agent in ["librarian", "editor", "visionary"]:
            cursor.execute(
                "INSERT INTO agent_subscriptions (intake_id, agent_id, status) VALUES (?, ?, ?)",
                (intake_id, agent, "pending")
            )
            
        conn.commit()
        conn.close()
        
        logger.info(f"Intake {intake_id} complete. {len(chunks)} chunks created. Events published.")
        return intake_id

    def chunk_text(self, text: str, chunk_size: int = 1000) -> List[str]:
        """Simple paragraph-aware chunker."""
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for p in paragraphs:
            if len(current_chunk) + len(p) < chunk_size:
                current_chunk += p + "\n\n"
            else:
                if current_chunk: chunks.append(current_chunk.strip())
                current_chunk = p + "\n\n"
        
        if current_chunk: chunks.append(current_chunk.strip())
        return chunks

    def get_subscriptions(self, agent_id: str, status: str = 'pending') -> List[Dict]:
        """
        Retrieves pending work for a specific agent.
        """
        import sqlite3
        conn = sqlite3.connect(self.memory.db_path, timeout=30)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(
            """SELECT s.id as sub_id, r.* FROM agent_subscriptions s 
               JOIN raw_intake r ON s.intake_id = r.id 
               WHERE s.agent_id = ? AND s.status = ?""",
            (agent_id, status)
        )
        rows = cursor.fetchall()
        conn.close()
        
        results = []
        for r in rows:
            d = dict(r)
            if 'metadata' in d and d['metadata']:
                try:
                    d['metadata'] = json.loads(d['metadata'])
                except:
                    pass
            results.append(d)
            
        return results

    def update_subscription_status(self, sub_id: int, status: str, result_metadata: Dict = None):
        """
        Updates the status of an agent's processing for a specific intake.
        """
        import sqlite3
        conn = sqlite3.connect(self.memory.db_path, timeout=30)
        cursor = conn.cursor()
        
        cursor.execute(
            "UPDATE agent_subscriptions SET status = ?, result_metadata = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?",
            (status, json.dumps(result_metadata or {}), sub_id)
        )
        conn.commit()
        conn.close()

# Singleton
_intake_manager = None

def get_intake_manager() -> IntakeManager:
    global _intake_manager
    if _intake_manager is None:
        _intake_manager = IntakeManager()
    return _intake_manager
