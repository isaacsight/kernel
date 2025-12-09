import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from admin.engineers.command_router import route_and_log
import logging
import os

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MacController")

app = FastAPI(title="Mac Controller", description="API to accept commands from the Studio Node (Windows)")

class CommandRequest(BaseModel):
    command: str

@app.get("/")
def home():
    return {"status": "online", "role": "Controller", "device": "Mac"}

@app.post("/execute")
def execute_command(request: CommandRequest):
    """
    Receives a natural language command, routes it, and executes it.
    """
    logger.info(f"Received command: {request.command}")
    
    try:
        # Route and Execute
        result = route_and_log(request.command)
        return result
    except Exception as e:
        logger.error(f"Execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
