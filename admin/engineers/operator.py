import time
import logging
import sys
import os
import subprocess
from datetime import datetime, timedelta

# Add parent directory to path to import core
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin import core

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [The Operator] - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("operator.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("Operator")

class Operator:
    """
    The Operator (AI Product Manager)
    
    Mission: Achieve true "Site Autonomy" where the system manages its own lifecycle.
    
    Responsibilities:
    - Autonomous Workflows (Deploy, Rollback)
    - Roadmap Planning
    - Goal Alignment
    """
    def __init__(self):
        self.name = "The Operator"
        self.role = "AI Product Manager"
        self.server_manager = core.ServerManager()
        self.check_interval = 60 # seconds
        self.autonomy_enabled = True

    def check_health(self):
        """
        Monitors system health and restarts services if needed.
        """
        status = self.server_manager.get_status()
        logger.info(f"System Health Check: Server is {status}")
        
        if status == "Stopped":
            logger.warning("Server is down. Initiating recovery protocol...")
            msg = self.server_manager.start_server()
            logger.info(f"Recovery result: {msg}")

    def check_pulse(self):
        """
        Called by the Heartbeat service to perform periodic checks.
        """
        logger.info("Pulse received. Performing quick health scan...")
        self.check_health()
        
        # In the future, this can be expanded to check more complex states
        # without blocking the main heartbeat loop.
        return "Pulse Check OK"

    def manage_content(self):
        """
        Checks the editorial calendar and commissions new content if needed.
        """
        if not self.autonomy_enabled:
            return

        latest_date = core.get_latest_post_date()
        if not latest_date:
            logger.info("No posts found. Skipping schedule check.")
            return

        days_since_last = (datetime.now().date() - latest_date).days
        logger.info(f"Days since last post: {days_since_last}")

        # If it's been more than 3 days, commission a draft
        if days_since_last > 3:
            logger.info("Content gap detected. Commissioning The Alchemist...")
            try:
                topic = core.auto_generate_idea()
                logger.info(f"Selected Topic: {topic}")
                
                # Call The Alchemist via core (which now triggers the full loop)
                filename = core.generate_ai_post(topic)
                logger.info(f"Draft received and processed: {filename}")
                logger.info("Guardian and Editor have audited the content.")
                logger.info("Librarian has updated the Knowledge Graph.")
                
                # Auto-deploy if confident
                self.deploy()
                
            except Exception as e:
                logger.error(f"Commission failed: {e}")

    def deploy(self):
        """
        Executes the deployment workflow (Git Push).
        """
        logger.info("Initiating deployment workflow...")
        try:
            result = core.publish_git()
            logger.info(f"Deployment successful: {result}")
        except Exception as e:
            logger.error(f"Deployment failed: {e}")

    def evolve(self):
        """
        Triggers a full evolution cycle:
        1. Visionary: Dream (Propose Mission)
        2. Architect: Create Blueprint (Plan)
        3. Guardian: Verify Blueprint (Safety Check)
        4. Architect: Implement Blueprint (Execute)
        5. Guardian: Validate System (Integrity Check)
        """
        logger.info("INITIATING EVOLUTION CYCLE...")
        report = []
        
        try:
            # 1. Visionary: Dream
            logger.info("[Step 1] Consulting The Visionary...")
            from engineers.visionary import Visionary
            visionary = Visionary()
            mission = visionary.dream()
            report.append(f"Mission: {mission}")
            
            # 2. Architect: Create Blueprint
            logger.info("[Step 2] Tasking The Architect...")
            from engineers.architect import Architect
            architect = Architect()
            blueprint = architect.create_blueprint(mission)
            report.append(f"Blueprint Created: {len(blueprint.get('changes', []))} changes proposed.")
            
            # 3. Guardian: Verify Blueprint
            logger.info("[Step 3] Summoning The Guardian for Pre-Check...")
            from engineers.guardian import Guardian
            guardian = Guardian()
            approved, reason = guardian.verify_evolution(blueprint)
            
            if not approved:
                logger.warning(f"Evolution aborted by Guardian: {reason}")
                return f"Evolution Aborted: {reason}"
            
            report.append(f"Guardian Approval: {reason}")
            
            # 4. Architect: Implement Blueprint
            logger.info("[Step 4] Executing Blueprint...")
            result = architect.implement_blueprint(blueprint)
            report.append(f"Execution Result: {result}")
            
            # 5. Guardian: Validate System
            logger.info("[Step 5] Validating System Integrity...")
            valid, status = guardian.validate_system()
            
            if not valid:
                logger.error(f"System validation failed: {status}")
                # In a real system, we would rollback here.
                report.append(f"CRITICAL: System Validation Failed: {status}")
            else:
                report.append(f"System Validation: {status}")
            
            logger.info("EVOLUTION CYCLE COMPLETE.")
            return "\n".join(report)
            
        except Exception as e:
            logger.error(f"Evolution failed: {e}")
            return f"Evolution Failed: {e}"

    def run_daemon(self):
        """
        Main autonomous loop.
        """
        logger.info("The Operator is online. Taking control of site operations.")
        while True:
            try:
                self.check_health()
                self.manage_content()
            except Exception as e:
                logger.error(f"Critical error in main loop: {e}")
            
            time.sleep(self.check_interval)

if __name__ == "__main__":
    operator = Operator()
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        logger.info("Running diagnostic test...")
        operator.check_health()
        sys.exit(0)
    
    operator.run_daemon()