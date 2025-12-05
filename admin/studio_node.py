import os
import sys
import logging
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set role to NODE before importing brain components
os.environ["STUDIO_NODE_ROLE"] = "node"

from admin.brain.model_router import get_model_router, TaskType
from admin.brain.collective_intelligence import get_collective_intelligence

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("StudioNode")

app = FastAPI(title="Studio Node", description="Remote AI Worker & Agent Host for Studio OS")

# Initialize Brain Components
router = get_model_router()
collective = get_collective_intelligence()

# ==================== Data Models ====================

class GenerateRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    task_type: Optional[str] = "chat"
    system_prompt: Optional[str] = None

class PullRequest(BaseModel):
    model: str

class SyncRequest(BaseModel):
    knowledge: Dict[str, Any]
    timestamp: str

class AgentRunRequest(BaseModel):
    agent_name: str
    task: str
    context: Dict[str, Any] = {}

# ==================== Core Endpoints ====================

@app.get("/health")
def health_check():
    return {
        "status": "online", 
        "worker": "Studio Node (Windows)",
        "models": len(router.get_available_models()),
        "knowledge_items": collective.get_team_status()["total_insights"]
    }

@app.post("/pull")
def pull_model(request: PullRequest):
    """Triggers a model pull on the local Ollama instance."""
    logger.info(f"Received pull request for model: {request.model}")
    try:
        import requests
        ollama_url = "http://localhost:11434/api/pull"
        payload = {"name": request.model, "stream": False}
        
        response = requests.post(ollama_url, json=payload)
        response.raise_for_status()
        
        # Refresh router availability after pull
        router.refresh_availability()
        
        return {"status": "success", "detail": f"Model {request.model} pulled successfully"}
    except Exception as e:
        logger.error(f"Pull failed: {e}")
        raise HTTPException(status_code=500, detail=f"Pull failed: {str(e)}")

@app.post("/generate")
def generate_text(request: GenerateRequest):
    """Generates text using the Model Router to pick the best local model."""
    logger.info(f"Received generation request. Task: {request.task_type}")
    
    try:
        # 1. Select Model
        if request.model:
            model_name = request.model
        else:
            # Map string task type to Enum
            try:
                task_enum = TaskType(request.task_type)
            except:
                task_enum = TaskType.CHAT
                
            selection = router.select_model(task_enum, constraints={"prefer_local": True})
            model_name = selection.get("selected")
            
            if not model_name:
                raise HTTPException(status_code=500, detail="No suitable model found")
                
        logger.info(f"Using model: {model_name}")

        # 2. Generate
        import requests
        ollama_url = "http://localhost:11434/api/generate"
        
        payload = {
            "model": model_name,
            "prompt": request.prompt,
            "stream": False
        }
        
        if request.system_prompt:
            payload["system"] = request.system_prompt
            
        response = requests.post(ollama_url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        return {
            "response": result.get("response", ""),
            "model_used": model_name
        }
        
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

# ==================== Sync Endpoints ====================

@app.post("/sync/push")
def sync_push(request: SyncRequest):
    """Receive knowledge updates from the Controller."""
    logger.info("Received knowledge sync push")
    try:
        added = collective.merge_knowledge(request.knowledge)
        return {"status": "synced", "added": added}
    except Exception as e:
        logger.error(f"Sync push failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sync/pull")
def sync_pull(since: Optional[str] = None):
    """Send local knowledge updates to the Controller."""
    logger.info(f"Received knowledge sync pull (since {since})")
    try:
        if not since:
            # Default to last 24 hours if not specified
            since = datetime.now().replace(hour=0, minute=0, second=0).isoformat()
            
        updates = collective.get_knowledge_since(since)
        return {"updates": updates}
    except Exception as e:
        logger.error(f"Sync pull failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Agent Host ====================

@app.post("/agent/run")
def run_agent_task(request: AgentRunRequest, background_tasks: BackgroundTasks):
    """
    Execute a specific agent task on this Node.
    For now, this is a simple synchronous execution wrapper.
    In the future, this could spawn independent agent processes.
    """
    logger.info(f"Received agent task for {request.agent_name}")
    
    try:
        # Dynamic import of agent class
        # This assumes agent classes are in admin.engineers.[snake_case_name]
        # and class name is PascalCase.
        
        module_name = request.agent_name.lower()
        # Handle multi-word names (e.g. ViralCoach -> viral_coach)
        import re
        module_name = re.sub(r'(?<!^)(?=[A-Z])', '_', request.agent_name).lower()
        
        try:
            module = __import__(f"admin.engineers.{module_name}", fromlist=[request.agent_name])
            AgentClass = getattr(module, request.agent_name)
        except (ImportError, AttributeError):
            raise HTTPException(status_code=404, detail=f"Agent {request.agent_name} not found")
            
        # Instantiate Agent
        agent = AgentClass()
        
        # Execute Task (this is a simplification - real agents might need more setup)
        # We assume agents have a 'process_request' or similar method, 
        # or we might need a standardized interface.
        
        # For now, let's assume we are just using the agent's LLM capability
        # or a specific method if it exists.
        
        if hasattr(agent, "run_task"):
            result = agent.run_task(request.task, request.context)
        else:
            # Fallback: Ask the agent to "think" about the task
            # This relies on the agent having a chat/generate method
            result = f"Agent {request.agent_name} received task: {request.task}. (Execution logic pending)"
            
        return {"status": "completed", "result": result}
        
    except Exception as e:
        logger.error(f"Agent execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting Studio Node (Agentic Peer)...")
    print(f"Brain: {collective.name} initialized")
    print(f"Router: {router.name} initialized ({len(router.get_available_models())} models)")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
