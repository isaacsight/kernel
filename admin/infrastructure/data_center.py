import requests
import logging

logger = logging.getLogger("DataCenter")

class DataCenter:
    """
    Represents the physical and virtual infrastructure of the Studio OS.
    Manages a registry of nodes and their status.
    """
    def __init__(self, config):
        self.config = config
        self.nodes = {
            "primary": {
                "name": "Primary Node (Mac)",
                "url": "localhost", # Conceptual
                "type": "local",
                "status": "online"
            },
            "studio_node": {
                "name": "Studio Node (Windows)",
                "url": config.STUDIO_NODE_URL,
                "type": "remote",
                "status": "unknown"
            }
        }

    def check_node_health(self, node_key):
        """
        Checks the health of a specific node.
        """
        node = self.nodes.get(node_key)
        if not node:
            return {"status": "error", "message": f"Node '{node_key}' not found."}

        if node["type"] == "local":
            return {"status": "online", "message": "Local node is active."}

        if node["type"] == "remote":
            if not node["url"]:
                 return {"status": "error", "message": "URL not configured."}
            
            try:
                response = requests.get(f"{node['url']}/", timeout=2)
                if response.status_code == 200:
                    node["status"] = "online"
                    return {"status": "online", "message": f"{node['name']} is reachable."}
                else:
                    node["status"] = "warning"
                    return {"status": "warning", "message": f"{node['name']} responded with {response.status_code}."}
            except requests.exceptions.ConnectTimeout:
                node["status"] = "offline"
                return {"status": "offline", "message": f"{node['name']} connection timed out."}
            except requests.exceptions.ConnectionError:
                node["status"] = "offline"
                return {"status": "offline", "message": f"{node['name']} connection refused."}
            except Exception as e:
                node["status"] = "error"
                return {"status": "error", "message": f"Unexpected error for {node['name']}: {str(e)}"}

    def get_status_report(self):
        """
        Returns a summary of all nodes.
        """
        report = {}
        for key in self.nodes:
            report[key] = self.check_node_health(key)
        return report
