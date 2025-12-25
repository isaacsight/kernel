import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import sys
import os

# Inject project root into sys.path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from admin.engineers.command_router import route_and_log
from admin.brain.agent_presence import get_agent_presence, AgentStatus
import logging
import os
from admin.api.chat import router as chat_router

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MacController")

app = FastAPI(title="Mac Controller", description="API to accept commands from the Studio Node (Windows)")

class CommandRequest(BaseModel):
    command: str

class AgentActionRequest(BaseModel):
    agent_name: str
    action: str
    parameters: dict = {}

app.include_router(chat_router)

@app.get("/")
def home():
    return {"status": "online", "role": "Controller", "device": "Mac"}

@app.post("/execute")
async def execute_command(request: CommandRequest):
    """
    Receives a natural language command, routes it, and executes it.
    """
    logger.info(f"Received command: {request.command}")
    
    try:
        # Route and Execute
        result = await route_and_log(request.command)
        return result
    except Exception as e:
        logger.error(f"Execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agents")
def get_agents():
    """
    Returns the real-time active agent swarm state.
    """
    return get_agent_presence().get_team_presence()

@app.post("/agents/run")
def run_agent_action(request: AgentActionRequest):
    """
    Executes an action on a specific agent.
    """
    logger.info(f"Agent Action Request: {request.agent_name} -> {request.action}")
    
    # Simple direct mutation for now (can be expanded to complex router later)
    # This proves the "Experiment with mutate" capability
    presence = get_agent_presence()
    presence.update_presence(
        request.agent_name, 
        AgentStatus.WORKING, 
        current_task=f"Manual Override: {request.action}",
        progress=0
    )
    
    return {"status": "queued", "message": f"Action {request.action} queued for {request.agent_name}"}

@app.get("/logs")
def get_logs(lines: int = 50):
    """Returns the last N lines of the admin log."""
    log_file = os.path.join(os.path.dirname(__file__), "admin.log")
    if not os.path.exists(log_file):
        return {"logs": ["Log file not found."]}
    
    try:
        # Simple tail implementation
        with open(log_file, "r") as f:
            all_lines = f.readlines()
            return {"logs": [line.strip() for line in all_lines[-lines:]]}
    except Exception as e:
        return {"logs": [f"Error reading logs: {e}"]}

if __name__ == "__main__":
    print("Starting Mac Controller API on port 8001...")
    uvicorn.run(app, host="0.0.0.0", port=8001)
