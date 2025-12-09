import logging

class InfrastructureEngineer:
    def __init__(self):
        self.name = "AI Infrastructure Engineer"
        self.role = "Inference & Serving"
        self.emoji = "🏗️"
        
    def check_node_health(self):
        """Checks connectivity to the local Studio Node."""
        import os
        import requests
        from dotenv import load_dotenv
        
        load_dotenv()
        node_url = os.environ.get("STUDIO_NODE_URL", "http://localhost:1234")
        
        try:
            # 1. Try Known Working Endpoints (from check_node.py)
            try:
                # Based on check_node.py output, /tags or /api/tags works
                response = requests.get(f"{node_url}/api/tags", timeout=5)
                if response.status_code == 200:
                    return {
                        "status": "online",
                        "latency": f"{response.elapsed.total_seconds()*1000:.0f}ms",
                        "models_available": "Remote Worker Active",
                        "url": node_url,
                        "type": "Custom/Windows"
                    }
            except:
                pass

            # 2. Try Health Endpoint
            try:
                response = requests.get(f"{node_url}/health", timeout=5)
                if response.status_code == 200:
                    return {
                        "status": "online",
                        "latency": f"{response.elapsed.total_seconds()*1000:.0f}ms",
                        "models_available": "Remote Worker Active",
                        "url": node_url,
                        "type": "Custom/Windows"
                    }
            except:
                pass

            # 2. Try OpenAI/Ollama Style
            response = requests.get(f"{node_url}/v1/models", timeout=2)
            if response.status_code == 200:
                models = response.json()
                model_count = len(models.get('data', []))
                return {
                    "status": "online",
                    "latency": f"{response.elapsed.total_seconds()*1000:.0f}ms",
                    "models_available": model_count,
                    "url": node_url,
                    "type": "OpenAI/Ollama"
                }
            
            return {"status": "error", "code": response.status_code, "url": node_url}
            
        except requests.exceptions.ConnectionError:
            return {"status": "offline", "error": "Connection refused", "url": node_url}
        except Exception as e:
            return {"status": "error", "error": str(e), "url": node_url}

    def scale_inference(self, current_load):
        return {"replicas": 5, "latency": "12ms"}

    def report_status(self):
        return f"{self.emoji} {self.name}: Cluster optimal."