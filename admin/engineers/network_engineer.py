import requests
import logging
from config import config

logger = logging.getLogger("NetworkEngineer")

class NetworkEngineer:
    """
    The Network Engineer (Infrastructure Specialist)
    
    Mission: Ensure connectivity and health of remote nodes.
    """
    def __init__(self):
        self.name = "The Network Engineer"
        self.node_url = config.STUDIO_NODE_URL
        
    def check_node_status(self):
        """
        Checks if the Studio Node is reachable and responding.
        """
        if not self.node_url:
            return {"status": "error", "message": "STUDIO_NODE_URL not configured."}
            
        try:
            # Try a lightweight endpoint
            response = requests.get(f"{self.node_url}/", timeout=2)
            if response.status_code == 200:
                return {"status": "online", "message": "Node is reachable."}
            else:
                return {"status": "warning", "message": f"Node responded with {response.status_code}."}
        except requests.exceptions.ConnectTimeout:
            return {"status": "offline", "message": "Connection timed out. Check if the Windows machine is on and the server is running."}
        except requests.exceptions.ConnectionError:
            return {"status": "offline", "message": "Connection refused. Check network settings."}
        except Exception as e:
            return {"status": "error", "message": f"Unexpected error: {str(e)}"}

if __name__ == "__main__":
    eng = NetworkEngineer()
    print(eng.check_node_status())
