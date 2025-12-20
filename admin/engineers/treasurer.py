import logging
import sqlite3
import os
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional

# Add root to path so we can import admin
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.config import config
from admin.brain.agent_base import BaseAgent

logger = logging.getLogger("Treasurer")

class Treasurer(BaseAgent):
    """
    The Treasurer (CFO)
    
    Responsible for tracking the financial health of the Studio OS.
    Uses a local SQLite database for privacy and speed.
    """
    
    def __init__(self):
        super().__init__(agent_id="treasurer")
        self.db_path = os.path.join(os.getcwd(), "sql", "finance.db")
        self._init_db()
        logger.info(f"[{self.name}] Initialized. Connected to {self.db_path}")

    def _init_db(self):
        """Ensures the database exists."""
        if not os.path.exists(self.db_path):
            logger.warning(f"[{self.name}] Database not found at {self.db_path}. schema should be run.")

    def _get_connection(self):
        return sqlite3.connect(self.db_path)

    def execute(self, action: str, **params) -> Dict[str, Any]:
        """
        Executes financial actions.
        """
        if action == "log_transaction":
            return self.log_transaction(
                amount=params.get("amount"),
                description=params.get("description"),
                category=params.get("category", "Uncategorized"),
                source=params.get("source", "manual")
            )
        elif action == "get_balance" or action == "report":
            return self.get_financial_report()
        else:
            raise NotImplementedError(f"Action {action} not supported by Treasurer.")

    def log_transaction(self, amount: float, description: str, category: str = "General", source: str = "manual") -> Dict[str, Any]:
        """
        Records a transaction in the ledger. 
        Negative amount = Expense. Positive amount = Income.
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            cursor.execute("""
                INSERT INTO transactions (date, amount, category, description, source)
                VALUES (?, ?, ?, ?, ?)
            """, (date_str, amount, category, description, source))
            
            conn.commit()
            tx_id = cursor.lastrowid
            conn.close()
            
            return {
                "status": "success",
                "message": f"Logged transaction: {description} (${amount})",
                "transaction_id": tx_id
            }
        except Exception as e:
            logger.error(f"Failed to log transaction: {e}")
            return {"status": "error", "message": str(e)}

    def get_financial_report(self, days: int = 30) -> Dict[str, Any]:
        """
        Generates a basic financial health report.
        """
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get total balance (all time)
            cursor.execute("SELECT SUM(amount) as balance FROM transactions")
            row = cursor.fetchone()
            balance = row['balance'] if row and row['balance'] else 0.0
            
            # Get burn rate (last 30 days expenses)
            cursor.execute("""
                SELECT SUM(amount) as burn 
                FROM transactions 
                WHERE amount < 0 AND date >= date('now', ?)
            """, (f'-{days} days',))
            row = cursor.fetchone()
            burn_rate = abs(row['burn']) if row and row['burn'] else 0.0
            
            conn.close()
            
            status = "Healthy"
            if burn_rate > 0 and balance < (burn_rate * 3):
                status = "Warning: Low Runway"
            
            return {
                "status": "success",
                "current_balance": balance,
                "burn_rate_30d": burn_rate,
                "health_status": status,
                "generated_at": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to generate report: {e}")
            return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    # Test the Treasurer
    cfo = Treasurer()
    
    # 1. Log some mock data
    print("Logging mock transactions...")
    cfo.log_transaction(-50.00, "Server Hosting", "Infrastructure")
    cfo.log_transaction(2000.00, "Consulting Invoice #101", "Revenue")
    
    # 2. Get Report
    print("\nGenerating Report...")
    report = cfo.get_financial_report()
    print(report)
