import sqlite3
import os
from datetime import datetime

# Path to the database
db_path = os.path.join(os.path.dirname(__file__), "studio_memory.db")

def check_decisions():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get today's date in YYYY-MM-DD format
    today = datetime.now().strftime("%Y-%m-%d")
    
    print(f"Checking decisions for today ({today})...")

    try:
        cursor.execute(
            "SELECT * FROM decisions WHERE date(timestamp) = ? ORDER BY timestamp DESC",
            (today,)
        )
        rows = cursor.fetchall()
        
        if not rows:
            print("No decisions recorded for today.")
        else:
            print(f"Found {len(rows)} decisions today:")
            for row in rows:
                print(f"- [{row['timestamp']}] {row['topic']}: {row['decision']} (Agent: {row['agent_id']})")
                
    except Exception as e:
        print(f"Error querying database: {e}")
        
    conn.close()

if __name__ == "__main__":
    check_decisions()
