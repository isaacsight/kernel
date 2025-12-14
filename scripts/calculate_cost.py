
import sqlite3
import os

DB_PATH = 'engine/reliability.db'

def calculate_cost():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_runs'")
        if not cursor.fetchone():
            print("Table 'workflow_runs' does not exist.")
            return

        cursor.execute("SELECT SUM(total_cost) FROM workflow_runs")
        result = cursor.fetchone()[0]
        
        total_cost = result if result else 0.0
        print(f"Total Cost of Built System: ${total_cost:.4f}")

        # Optional: Breakdown by status
        cursor.execute("SELECT status, COUNT(*), SUM(total_cost) FROM workflow_runs GROUP BY status")
        rows = cursor.fetchall()
        if rows:
            print("\nBreakdown by Status:")
            for row in rows:
                status, count, cost = row
                cost = cost if cost else 0.0
                print(f"  {status}: {count} runs, ${cost:.4f}")

    except Exception as e:
        print(f"Error querying database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    calculate_cost()
