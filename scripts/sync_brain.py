"""
Sync Brain Script
Runs the NodeSyncManager to synchronize knowledge between this machine (Controller)
and the Studio Node (Windows).
"""

import os
import sys
import logging
import time

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.brain.node_sync import get_sync_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("SyncBrain")

def run_sync_loop(interval_seconds: int = 300):
    """Run sync periodically."""
    manager = get_sync_manager()
    logger.info(f"Starting Brain Sync (Interval: {interval_seconds}s)")
    
    try:
        while True:
            logger.info("Syncing...")
            result = manager.sync()
            logger.info(f"Sync Result: {result}")
            
            time.sleep(interval_seconds)
    except KeyboardInterrupt:
        logger.info("Sync stopped by user.")

def run_sync_once():
    """Run sync once."""
    manager = get_sync_manager()
    logger.info("Syncing Brain...")
    result = manager.sync()
    logger.info(f"Sync Result: {result}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Sync Brain with Studio Node")
    parser.add_argument("--loop", action="store_true", help="Run in a loop")
    parser.add_argument("--interval", type=int, default=300, help="Interval in seconds")
    args = parser.parse_args()
    
    if args.loop:
        run_sync_loop(args.interval)
    else:
        run_sync_once()
