import time
import logging
import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path to import core
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin import core

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("janitor.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("Janitor")

class Janitor:
    def __init__(self):
        self.server_manager = core.ServerManager()
        self.check_interval = 60 # seconds
        self.autonomy_enabled = True

    def check_server(self):
        """Ensures the local server is running."""
        status = self.server_manager.get_status()
        logger.info(f"Server status: {status}")
        
        if status == "Stopped":
            logger.warning("Server is down. Attempting to restart...")
            msg = self.server_manager.start_server()
            logger.info(f"Restart result: {msg}")

    def check_content_schedule(self):
        """Checks if it's time to generate a new post."""
        if not self.autonomy_enabled:
            return

        latest_date = core.get_latest_post_date()
        if not latest_date:
            logger.info("No posts found. Skipping schedule check.")
            return

        days_since_last = (datetime.now().date() - latest_date).days
        logger.info(f"Days since last post: {days_since_last}")

        # If it's been more than 3 days, generate a draft
        if days_since_last > 3:
            logger.info("Content gap detected. Initiating auto-generation...")
            try:
                topic = core.auto_generate_idea()
                logger.info(f"Generated idea: {topic}")
                # filename = core.generate_ai_post(topic) # Uncomment to enable actual generation
                # logger.info(f"Created draft: {filename}")
            except Exception as e:
                logger.error(f"Auto-generation failed: {e}")

    def run(self):
        logger.info("Janitor service started.")
        while True:
            try:
                self.check_server()
                self.check_content_schedule()
            except Exception as e:
                logger.error(f"Error in janitor loop: {e}")
            
            time.sleep(self.check_interval)

if __name__ == "__main__":
    janitor = Janitor()
    janitor.run()
