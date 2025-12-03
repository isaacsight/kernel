import os
import subprocess
import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("StudioNode")

app = FastAPI(title="Studio Node", description="Remote AI Worker for Studio OS")

class GenerateRequest(BaseModel):
    prompt: str
    model: str = "mistral"
    system_prompt: Optional[str] = None

class PullRequest(BaseModel):
    model: str

@app.get("/health")
def health_check():
    return {"status": "online", "worker": "Studio Node (Windows)"}

@app.post("/pull")
def pull_model(request: PullRequest):
    """
    Triggers a model pull on the local Ollama instance.
    """
    logger.info(f"Received pull request for model: {request.model}")
    try:
        import requests
        ollama_url = "http://localhost:11434/api/pull"
        payload = {"name": request.model, "stream": False}
        
        response = requests.post(ollama_url, json=payload)
        response.raise_for_status()
        
        return {"status": "success", "detail": f"Model {request.model} pulled successfully"}
    except Exception as e:
        logger.error(f"Pull failed: {e}")
        raise HTTPException(status_code=500, detail=f"Pull failed: {str(e)}")

@app.post("/generate")
def generate_text(request: GenerateRequest):
    """
    Generates text using the local Ollama instance.
    """
    logger.info(f"Received generation request for model: {request.model}")
    
    # Check if Ollama is installed/running
    try:
        # We'll use the CLI for simplicity, or we could use the requests library to hit localhost:11434
        # Using requests is more robust for a "node" that might be running ollama separately.
        import requests
        
        ollama_url = "http://localhost:11434/api/generate"
        
        payload = {
            "model": request.model,
            "prompt": request.prompt,
            "stream": False
        }
        
        if request.system_prompt:
            payload["system"] = request.system_prompt
            
        response = requests.post(ollama_url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        return {"response": result.get("response", "")}
        
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

@app.post("/embeddings")
def generate_embeddings(request: GenerateRequest):
    """
    Generates embeddings using the local Ollama instance.
    """
    logger.info(f"Received embedding request for model: {request.model}")
    try:
        import requests
        ollama_url = "http://localhost:11434/api/embeddings"
        
        payload = {
            "model": request.model,
            "prompt": request.prompt
        }
        
        response = requests.post(ollama_url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        return {"embedding": result.get("embedding", [])}
        
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

@app.post("/audit")
def audit_content(request: GenerateRequest):
    """
    Audits content for safety using a local model or Ollama.
    For now, we'll use a simple prompt-based check via Ollama if no specific safety model is loaded.
    """
    logger.info("Received audit request")
    try:
        # Simple prompt-based safety check using the default model (e.g. mistral)
        # In a real scenario, we might load a BERT model here.
        import requests
        ollama_url = "http://localhost:11434/api/generate"
        
        safety_prompt = f"""
        You are a content safety filter. Analyze the following text for hate speech, violence, self-harm, or sexual content.
        
        TEXT:
        {request.prompt}
        
        RESPONSE FORMAT:
        JSON with keys "safe" (boolean) and "issues" (list of strings).
        Only return the JSON.
        """
        
        payload = {
            "model": request.model,
            "prompt": safety_prompt,
            "stream": False,
            "format": "json"
        }
        
        response = requests.post(ollama_url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        return {"audit": result.get("response", "{}")}
        
    except Exception as e:
        logger.error(f"Audit failed: {e}")
        raise HTTPException(status_code=500, detail=f"Audit failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    print("Starting Studio Node...")
    print("Ensure Ollama is running (ollama serve)!")
    uvicorn.run(app, host="0.0.0.0", port=8000)
