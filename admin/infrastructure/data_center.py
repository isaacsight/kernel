import requests
import logging
import time
import socket
from urllib.parse import urlparse

logger = logging.getLogger("DataCenter")

# Cache for node status to avoid repeated slow checks
_node_status_cache = {}
_cache_ttl_seconds = 60  # Cache for 60 seconds


class DataCenter:
    """
    Represents the physical and virtual infrastructure of the Studio OS.
    Manages a registry of nodes and their status.
    
    Performance optimizations:
    - Fast socket ping (1 sec) before full HTTP check
    - Caches status for 60 seconds to avoid repeated slow operations
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

    def _fast_ping(self, url: str, timeout: float = 1.0) -> bool:
        """
        Fast socket-level connectivity check (1 second).
        Much faster than waiting for HTTP timeout.
        """
        try:
            parsed = urlparse(url)
            host = parsed.hostname
            port = parsed.port or 8000
            
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()
            return result == 0
        except Exception:
            return False

    def check_node_health(self, node_key: str, use_cache: bool = True) -> dict:
        """
        Checks the health of a specific node.
        
        Args:
            node_key: The node identifier
            use_cache: If True, returns cached result if available (default: True)
        """
        global _node_status_cache
        
        node = self.nodes.get(node_key)
        if not node:
            return {"status": "error", "message": f"Node '{node_key}' not found."}

        if node["type"] == "local":
            return {"status": "online", "message": "Local node is active."}

        if node["type"] == "remote":
            if not node["url"]:
                 return {"status": "error", "message": "URL not configured."}
            
            # Check cache first
            cache_key = f"{node_key}_{node['url']}"
            if use_cache and cache_key in _node_status_cache:
                cached = _node_status_cache[cache_key]
                if time.time() - cached["timestamp"] < _cache_ttl_seconds:
                    return cached["result"]
            
            # Fast ping first (1 second max)
            if not self._fast_ping(node["url"]):
                result = {"status": "offline", "message": f"{node['name']} not reachable (fast check)."}
                node["status"] = "offline"
                _node_status_cache[cache_key] = {"result": result, "timestamp": time.time()}
                return result
            
            # Full HTTP check only if ping succeeds
            try:
                response = requests.get(f"{node['url']}/", timeout=2)
                if response.status_code == 200:
                    node["status"] = "online"
                    result = {"status": "online", "message": f"{node['name']} is reachable."}
                else:
                    node["status"] = "warning"
                    result = {"status": "warning", "message": f"{node['name']} responded with {response.status_code}."}
                
                _node_status_cache[cache_key] = {"result": result, "timestamp": time.time()}
                return result
                
            except requests.exceptions.ConnectTimeout:
                node["status"] = "offline"
                result = {"status": "offline", "message": f"{node['name']} connection timed out."}
            except requests.exceptions.ConnectionError:
                node["status"] = "offline"
                result = {"status": "offline", "message": f"{node['name']} connection refused."}
            except Exception as e:
                node["status"] = "error"
                result = {"status": "error", "message": f"Unexpected error for {node['name']}: {str(e)}"}
            
            _node_status_cache[cache_key] = {"result": result, "timestamp": time.time()}
            return result

    def get_status_report(self):
        """
        Returns a summary of all nodes.
        """
        report = {}
        for key in self.nodes:
            report[key] = self.check_node_health(key)
        return report
    
    def is_node_online(self, node_key: str) -> bool:
        """
        Quick check if a node is online (uses cache).
        """
        result = self.check_node_health(node_key)
        return result.get("status") == "online"
    
    def clear_cache(self):
        """Clear the status cache to force fresh checks."""
        global _node_status_cache
        _node_status_cache = {}

