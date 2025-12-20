
import os
import sys
import sqlite3
import logging

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.config import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MemoryVerifier")

def verify_recall(query_term):
    """
    Simulates a 'Recall' by querying the raw_intake table in memory.
    """
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "admin/brain/studio_memory.db")
    
    if not os.path.exists(db_path):
        logger.error(f"Database not found at {db_path}")
        return

    logger.info(f"🧠 Querying Memory Brain for: '{query_term}'...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Simple LIKE query to simulate search on 'source_path' or 'content'
    # We look for the Alchemist file specifically as requested by the user scenario
    cursor.execute(
        "SELECT source_path, substring(content, 1, 200) FROM raw_intake WHERE source_path LIKE ? OR content LIKE ? LIMIT 5",
        (f"%{query_term}%", f"%{query_term}%")
    )
    
    rows = cursor.fetchall()
    conn.close()
    
    if rows:
        logger.info(f"✅ RECALL SUCCESSFUL. Found {len(rows)} memories related to '{query_term}':")
        for row in rows:
            print(f"\n📄 File: {row[0]}")
            print(f"   Preview: {row[1]}...")
    else:
        logger.warning(f"❌ Recall Failed. No memories found for '{query_term}'.")

if __name__ == "__main__":
    # Test recall for the specific logic we added today
    verify_recall("Alchemist")
