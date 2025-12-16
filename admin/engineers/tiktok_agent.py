import logging
import requests
import sys
import os

# Ensure we can import from admin
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from admin.engineers.n8n_agent import N8nAgent

logger = logging.getLogger("TikTokAgent")
logging.basicConfig(level=logging.INFO)

class TikTokAgent:
    """
    The TikTokAgent handles marketing tasks on TikTok by coordinating with
    the n8n automation infrastructure.
    """
    
    def __init__(self):
        self.n8n_agent = N8nAgent()
        self.webhook_url = "http://localhost:5678/webhook/publish-tiktok"

    def market_site(self):
        """
        Triggers the TikTok publication workflow.
        """
        logger.info("Initializing TikTok marketing sequence...")
        
        # 1. Ensure Infrastructure is Ready
        if not self.n8n_agent.start_server():
            logger.error("Failed to start n8n server. Aborting marketing sequence.")
            return False
            
        # 2. Trigger Workflow
        logger.info(f"Triggering workflow at {self.webhook_url}...")
        try:
            response = requests.post(
                self.webhook_url, 
                json={"trigger": "agent_invocation"}, 
                timeout=120
            )
            
            if response.status_code == 200:
                logger.info("✅ marketing workflow triggered successfully!")
                logger.debug(f"Response: {response.text}")
                return True
            else:
                logger.error(f"❌ Workflow failed with status {response.status_code}")
                logger.error(response.text)
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Connection failed: {e}")
            return False

if __name__ == "__main__":
    agent = TikTokAgent()
    agent.market_site()
