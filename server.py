import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
from core.team import team_orchestrator

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("studio-server")

app = FastAPI(title="The Studio Backend")

# CORS for mobile access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (like the mobile client)
app.mount("/static", StaticFiles(directory="docs", html=True), name="static")

@app.get("/")
async def health_check():
    """Health check endpoint."""
    return {"status": "online", "system": "Frontier Team Server"}

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("New WebSocket connection accepted")
    
    try:
        while True:
            # Receive text from client
            data = await websocket.receive_text()
            logger.info(f"Received prompt: {data}")
            
            # Delegate to Team Orchestrator and stream responses
            async for update in team_orchestrator.delegate(data):
                # Send JSON updates (Comet-style push)
                await websocket.send_text(json.dumps(update))
                
            # Signal end of stream
            await websocket.send_text(json.dumps({"type": "done"}))
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in websocket loop: {e}")
        await websocket.close()

if __name__ == "__main__":
    # Host 0.0.0.0 is CRITICAL for mobile access
    uvicorn.run(app, host="0.0.0.0", port=8000)
