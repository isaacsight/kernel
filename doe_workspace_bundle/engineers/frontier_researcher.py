import logging

class FrontierResearcher:
    def __init__(self):
        self.name = "Frontier Research Engineer"
        self.role = "Model Training & Optimization"
        self.emoji = "🧪"
        
    def train_model(self, dataset_path, params):
        return {"status": "optimizing_gradients", "loss": 0.001}

    def brainstorm_ideas(self, topic):
        """Uses the Windows Node to generate research directions."""
        import os
        import requests
        import json
        
        node_url = os.environ.get("STUDIO_NODE_URL", "http://localhost:1234")
        
        prompt = f"As a Frontier Research Engineer, query the latent space for 3 advanced blog post ideas about: {topic}. Return them as a JSON list."
        
        try:
            # 1. Get available model
            model_to_use = "mistral" # fallback
            try:
                tags_res = requests.get(f"{node_url}/api/tags", timeout=5)
                if tags_res.status_code == 200:
                    models = tags_res.json().get("models", [])
                    # Filter out embedding models
                    gen_models = [m["name"] for m in models if "embed" not in m["name"] and "bert" not in m["name"]]
                    if gen_models:
                        model_to_use = gen_models[0]
            except:
                pass

            # 2. Generate
            payload = {
                "model": model_to_use, 
                "prompt": prompt, 
                "stream": False
            }
            
            response = requests.post(
                f"{node_url}/api/generate", 
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                # Debugging: Print keys if 'response' is missing
                ideas_text = data.get("response") or data.get("content") or data.get("output") or data.get("text")
                
                if not ideas_text:
                    return {"source": "Windows Node (GPU)", "ideas": f"Raw JSON: {json.dumps(data)}", "status": "Debug Mode"}
                    
                return {
                    "source": "Windows Node (GPU)",
                    "ideas": ideas_text,
                    "status": "Inference Complete"
                }
            else:
                return {"error": f"Node returned {response.status_code}"}
                
        except Exception as e:
            return {"error": f"Failed to reach node: {str(e)}"}

    def report_status(self):
        return f"{self.emoji} {self.name}: Connected to Lab (Windows Node)."