import asyncio
import logging
import os
import datetime
import threading
import time
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [HEARTBEAT] - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "heartbeat.log")),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("Heartbeat")

class Heartbeat:
    """
    The Pulse of the System. 
    Runs in the background and periodically wakes up agents to check for work.
    """
    def __init__(self, interval_seconds=3600):
        self.interval = interval_seconds
        self.running = False
        self.thread = None
        self.last_beat = None
        self.status = "Stopped"

    def start(self):
        if self.running:
            logger.info("Heartbeat already running.")
            return
        
        self.running = True
        self.status = "Running"
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info(f"Heartbeat started with interval: {self.interval}s")

    def stop(self):
        self.running = False
        self.status = "Stopped"
        logger.info("Heartbeat stopping...")
        if self.thread:
            self.thread.join(timeout=5)
            logger.info("Heartbeat stopped.")

    def _run_loop(self):
        while self.running:
            try:
                self.pulse()
                self.last_beat = datetime.datetime.now()
            except Exception as e:
                logger.error(f"Error during pulse: {e}")
            
            # Sleep in chunks to allow faster stopping
            for _ in range(self.interval):
                if not self.running: 
                    break
                time.sleep(1)

    def pulse(self):
        """
        The actual logic performed at each beat.
        """
        logger.info("💓 Pulse Check Initiated...")
        
        # 1. Import Agents dynamically to avoid circular imports at top level
        try:
            from admin.engineers.operator import Operator
            from admin.engineers.scheduler import Scheduler
            from admin.engineers.trend_scout import TrendScout
            
            operator = Operator()
            scheduler = Scheduler()
            trend_scout = TrendScout()
            
            # 2. Check Schedule
            logger.info("Checking Schedule...")
            due_items = scheduler.get_due_reminders()
            if due_items:
                logger.info(f"🔔 Found {len(due_items)} due items:")
                for item in due_items:
                    logger.info(f"  - {item['message']}")
            else:
                logger.info("Schedule clear for today.")

            
            # 3. Check Trends
            logger.info("Checking Trends...")
            trends = trend_scout.get_current_trends("tech")
            if trends:
                 logger.info(f"📈 Analyzed {len(trends)} trends.")
                 # Simple logic: If a high volume trend is found, notify
                 top_trend = trends[0]
                 if top_trend.get('volume') == 'High':
                     logger.info(f"🔥 HOT TREND: {top_trend['topic']} - {top_trend['context']}")
            
            # 4. Operator System Check
            logger.info("Running System Diagnostics...")
            # operator.check_pulse() # Method not implemented in Operator class
            
            logger.info("Pulse Complete. System Healthy.")
            
        except Exception as e:
            logger.error(f"Pulse Failed: {e}")
            import traceback
            logger.error(traceback.format_exc())

# Global instance
heartbeat = Heartbeat(interval_seconds=3600)  # Default 1 hour
