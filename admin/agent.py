import time
import os
import logging
from datetime import datetime
import core

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("agent.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("SiteAgent")

class AutonomousAgent:
    def __init__(self):
        self.server_manager = core.ServerManager()
        self.running = False
        self.last_content_check = time.time()
        self.content_dir = core.CONTENT_DIR
        
    def start(self):
        """Starts the autonomous agent loop."""
        self.running = True
        logger.info("Agent started. Monitoring system...")
        
        try:
            while self.running:
                self.run_checks()
                time.sleep(5) # Check every 5 seconds
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        """Stops the agent."""
        self.running = False
        logger.info("Agent stopped.")

    def run_checks(self):
        """Runs all autonomous checks."""
        self.check_server_health()
        self.check_scheduled_tasks()
        # self.check_content_changes() # Uncomment to enable auto-publish

    def check_server_health(self):
        """Ensures the server is always running."""
        status = self.server_manager.get_status()
        if status == "Stopped":
            logger.warning("Server found stopped. Attempting to restart...")
            msg = self.server_manager.start_server()
            logger.info(f"Server restart attempt: {msg}")
        else:
            # logger.debug("Server is healthy.")
            pass

    def check_scheduled_tasks(self):
        """Checks for time-based tasks."""
        now = datetime.now()
        # Example: Daily backup or status report at 9 AM
        if now.hour == 9 and now.minute == 0 and now.second < 5:
            logger.info("Performing daily scheduled checks...")
            # Add daily tasks here
            pass

    def check_content_changes(self):
        """Checks if content has changed and auto-publishes."""
        # Simple modification time check
        try:
            current_mtime = os.path.getmtime(self.content_dir)
            if current_mtime > self.last_content_check:
                logger.info("Content change detected. Waiting for stability...")
                time.sleep(10) # Wait for writes to finish
                
                logger.info("Auto-publishing changes to Git...")
                try:
                    msg = core.publish_git()
                    logger.info(f"Auto-publish result: {msg}")
                except Exception as e:
                    logger.error(f"Auto-publish failed: {e}")
                
                self.last_content_check = time.time()
        except Exception as e:
            logger.error(f"Error checking content: {e}")

if __name__ == "__main__":
    agent = AutonomousAgent()
    agent.start()
