import os
import shutil
import time
import logging
import random
from typing import Dict, List, Optional
from datetime import datetime

# Add root directory to sys.path for imports
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from admin.brain.metrics_collector import get_metrics_collector

logger = logging.getLogger("Publisher")

class Publisher:
    """
    The Publisher Agent (Distribution Manager)
    
    Mission: Ensure content reaches the world.
    
    Responsibilities:
    - Validate media assets before publishing.
    - Upload content to platforms (Simulated for V1).
    - Archive published content to keep the workspace clean.
    - Update metrics on publication success.
    """
    
    def __init__(self):
        self.name = "The Publisher"
        self.role = "Distribution Manager"
        self.metrics = get_metrics_collector()
        
        # Paths
        self.project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.published_dir = os.path.join(self.project_root, "static", "videos", "published")
        os.makedirs(self.published_dir, exist_ok=True)
        
    def publish(self, media_path: str, platforms: List[str] = None) -> Dict:
        """
        Publishes the given media file to specified platforms.
        
        Args:
            media_path: Absolute path to the media file.
            platforms: List of platforms (e.g., ['tiktok', 'youtube']).
            
        Returns:
            Dict containing publication results for each platform.
        """
        if platforms is None:
            platforms = ["tiktok", "youtube_shorts", "instagram_reels"]
            
        if not os.path.exists(media_path):
            return {"success": False, "error": f"File not found: {media_path}"}
            
        logger.info(f"📢 Publishing {os.path.basename(media_path)} to {platforms}...")
        
        results = {}
        all_success = True
        
        for platform in platforms:
            try:
                # Simulate network delay and API call
                time.sleep(random.uniform(1.0, 2.5)) 
                
                # Mock Probability of failure (very low)
                if random.random() < 0.05:
                    raise Exception("Network Timeout")
                    
                # Success Logic
                post_id = f"{platform}_{int(time.time())}"
                logger.info(f"✅ Published to {platform} (ID: {post_id})")
                
                results[platform] = {
                    "success": True,
                    "post_id": post_id,
                    "timestamp": datetime.now().isoformat()
                }
                
                self.metrics.log_event("publisher", {
                    "action": "published",
                    "platform": platform,
                    "file": os.path.basename(media_path)
                })
                
            except Exception as e:
                logger.error(f"❌ Failed to publish to {platform}: {e}")
                results[platform] = {"success": False, "error": str(e)}
                all_success = False
        
        # Archive if at least one success (or if we want to move it anyway)
        # Strategy: Move to 'published' so we don't process it again.
        archived_path = self._archive_media(media_path)
        
        summary = {
            "success": all_success,
            "results": results,
            "archived_at": archived_path
        }
        
        return summary
    
    def _archive_media(self, file_path: str) -> str:
        """Moves the file to the published archive folder."""
        try:
            filename = os.path.basename(file_path)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            new_name = f"{timestamp}_{filename}"
            destination = os.path.join(self.published_dir, new_name)
            
            shutil.move(file_path, destination)
            logger.info(f"📦 Archived {filename} to {destination}")
            return destination
        except Exception as e:
            logger.error(f"Failed to archive file: {e}")
            return file_path

# Factory
def get_publisher():
    return Publisher()

if __name__ == "__main__":
    # Test Run
    pub = Publisher()
    print("Publisher initialized. Ready to ship.")
