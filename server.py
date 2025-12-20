import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
from core.team import team_orchestrator
from admin.engineers.frontier_team import FrontierTeam
from admin.brain.memory_store import get_memory_store
from admin.brain.felt_right_index import fri_engine
from admin.engineers.revenue_agent import get_revenue_agent


# Initialize unified Frontier Team and Memory
frontier_team = FrontierTeam()
memory = get_memory_store()

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

# Mount frontend assets
import os
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend/dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

@app.get("/api/health")
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

from core.client_service import client_service

@app.websocket("/ws/client")
async def client_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("New Client WebSocket connection accepted")
    
    try:
        while True:
            raw_data = await websocket.receive_text()
            
            # Try parsing as JSON (New Protocol)
            try:
                payload = json.loads(raw_data)
                # It expects {'text': str, 'images': [b64]}
                # If it's old protocol (just string), we wrap it
                if isinstance(payload, str):
                     payload = {"text": payload, "images": []}
            except json.JSONDecodeError:
                # Fallback for old protocol (just text)
                payload = {"text": raw_data, "images": []}
                
            async for update in client_service.process_message(payload):
                await websocket.send_text(json.dumps(update))
    except WebSocketDisconnect:
        logger.info("Client WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in client websocket loop: {e}")
        await websocket.close()

# TikTok Verification & Demo Routes
@app.get("/tiktok_demo.html")
async def tiktok_demo():
    return FileResponse("static/tiktok_demo.html")

@app.get("/terms")
async def terms():
    return FileResponse("static/terms.html")

@app.get("/privacy")
async def privacy():
    return FileResponse("static/privacy.html")

@app.get("/tiktokHbV7mqFxkaukcOO1ZN0JhqfuMu6zjo58.txt")
async def verify1():
    return FileResponse("static/tiktokHbV7mqFxkaukcOO1ZN0JhqfuMu6zjo58.txt")

@app.get("/tiktokFQp5Br7vA7p6Rt7wamDT3mHX38rFmR9Z.txt")
async def verify2():
    return FileResponse("static/tiktokFQp5Br7vA7p6Rt7wamDT3mHX38rFmR9Z.txt")

# Studio OS Status
@app.get("/api/studio/status")
async def studio_status():
    """Returns the current state of the Evolution Loop (The Brain)."""
    try:
        # Path to the shared brain state
        state_path = os.path.join("admin", "brain", "evolution_state.json")
        
        if os.path.exists(state_path):
            with open(state_path, "r") as f:
                return json.load(f)
        
        # If file doesn't exist, return a default "sleeping" state
        return {
            "cycle": 0,
            "status": "sleeping", 
            "last_log": "System is offline.",
            "metrics": {"fitness": 0, "complexity": 0}
        }
    except Exception as e:
        logger.error(f"Error reading studio status: {e}")
        return {"status": "error", "message": str(e)}

# Data Models
from pydantic import BaseModel

class InquiryModel(BaseModel):
    name: str
    contact: str
    message: str
    history: list = []

@app.post("/api/inquiry")
async def submit_inquiry(inquiry: InquiryModel):
    """
    Handle client inquiries from the chat widget.
    Saves to admin/inquiries.json and sends email notification.
    """
    try:
        inquiry_data = inquiry.dict()
        inquiry_data["timestamp"] = __import__("datetime").datetime.now().isoformat()
        
        # 1. Save to File
        os.makedirs("admin", exist_ok=True)
        file_path = os.path.join("admin", "inquiries.json")
        
        existing_data = []
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                try:
                    existing_data = json.load(f)
                except json.JSONDecodeError:
                    existing_data = []
        
        existing_data.append(inquiry_data)
        
        with open(file_path, "w") as f:
            json.dump(existing_data, f, indent=2)
            
        logger.info(f"New inquiry received from {inquiry.name}")
        
        # 2. Email Notification (Placeholder)
        # TODO: Configure SMTP settings in admin/config.py
        # For now, we just log it.
        email_body = f"""
        New Inquiry from {inquiry.name} ({inquiry.contact}):
        
        Message: {inquiry.message}
        
        History Length: {len(inquiry.history)} messages
        """
        logger.info(f"--- EMAIL NOTIFICATION SIMULATION ---\n{email_body}\n---------------------------------------")
        
        return {"status": "success", "message": "Inquiry received"}
        
    except Exception as e:
        logger.error(f"Error saving inquiry: {e}")
        return {"status": "error", "message": str(e)}

# --- Rushed Release Loop API ---
from admin.brain.loops.rushed_release import rushed_release_loop
from fastapi import Request, HTTPException

@app.post("/v1/ingest")
async def ingest_signal(request: Request):
    try:
        data = await request.json()
        
        # Handle mobile batches
        if "batch" in data:
            results = []
            for signal in data["batch"]:
                # Normalize mobile signal to common format
                normalized = {
                    "user_id": data.get("user_id", "anon_abc123"),
                    "event_type": signal.get("type", "unknown"),
                    "context": signal.get("context", signal) # Fallback to full signal as context
                }
                # Ensure context has the url
                if "url" in signal and "url" not in normalized["context"]:
                    normalized["context"]["url"] = signal["url"]
                
                results.append(rushed_release_loop.process_ingest(normalized))
            return {"status": "batch_queued", "count": len(results)}
            
        result = rushed_release_loop.process_ingest(data)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Ingest error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/v1/snapshot")
async def get_snapshot(user_id: str):
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id")
    
    result = rushed_release_loop.get_snapshot(user_id)
    # Unify 'decisions' as 'entries' for popup compatibility
    result['entries'] = result.get('decisions', [])
    return result

@app.post("/v1/review")
async def review_entry(data: dict):
    """
    User reviews a decision (Yes/No/Defer).
    """
    try:
        entry_id = data.get('entry_id')
        action = data.get('action')
        if not entry_id or not action:
            raise HTTPException(status_code=400, detail="Missing entry_id or action")
            
        result = rushed_release_loop.mark_review(entry_id, action)
        return result
    except Exception as e:
        logger.error(f"Review error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Studio OS Metrics API (FRI) ---

@app.get("/api/studio/fri")
async def get_fri(days: int = 7):
    """
    Calculate and return the Felt Right Index.
    """
    try:
        return fri_engine.calculate_fri(days=days)
    except Exception as e:
        logger.error(f"Error calculating FRI: {e}")
        return {"status": "error", "message": str(e)}

# --- Studio OS Revenue API ---

@app.get("/api/studio/revenue")
async def get_revenue():
    """
    Get the monetization summary from the Revenue Agent.
    """
    try:
        agent = get_revenue_agent()
        return agent.get_revenue_summary()
    except Exception as e:
        logger.error(f"Error fetching revenue summary: {e}")
        return {"status": "error", "message": str(e)}

# --- Studio OS Treasurer API ---
from admin.engineers.treasurer import Treasurer

@app.get("/api/studio/finance")
async def get_finance_report(days: int = 30):
    """
    Get the financial health report from the Treasurer (CFO).
    """
    try:
        cfo = Treasurer()
        return cfo.get_financial_report(days=days)
    except Exception as e:
        logger.error(f"Error fetching finance report: {e}")
        return {"status": "error", "message": str(e)}

# --- Studio OS Decision Ledger API ---

@app.get("/api/decisions")
async def get_decisions(limit: int = 20):
    """Retrieve the decision ledger."""
    try:
        return memory.get_decision_history(limit=limit)
    except Exception as e:
        logger.error(f"Error fetching decisions: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/decisions")
async def log_decision(data: dict):
    """Log a manual decision signal."""
    try:
        topic = data.get("topic")
        decision = data.get("decision")
        if not topic or not decision:
            raise HTTPException(status_code=400, detail="Missing topic or decision")
            
        memory.save_decision(
            topic=topic,
            decision=decision,
            context=data.get("context"),
            agent_id=data.get("agent_id", "user"),
            metadata=data.get("metadata")
        )
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error saving decision: {e}")
        return {"status": "error", "message": str(e)}

# --- Frontier Team Tasks ---

@app.post("/api/team/task")
async def run_team_task(data: dict):
    """Trigger a multi-agent frontier team task."""
    try:
        prompt = data.get("prompt")
        if not prompt:
            raise HTTPException(status_code=400, detail="Missing prompt")
            
        # Run the multi-agent solving loop
        result = await frontier_team.solve_task(prompt)
        return result
    except Exception as e:
        logger.error(f"Team task failed: {e}")
        return {"status": "error", "message": str(e)}

# SPA Catch-all (must be last)

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # API/Websocket routes are handled above automatically
    # Check if file exists in frontend_dist (e.g. favicon.ico)
    target_path = os.path.join(frontend_dist, full_path)
    if full_path and os.path.exists(target_path) and os.path.isfile(target_path):
        return FileResponse(target_path)
    
    # Otherwise return index.html for client-side routing
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    return {"error": "Frontend not built or found", "path": full_path}


if __name__ == "__main__":
    # Host 0.0.0.0 is CRITICAL for mobile access
    uvicorn.run(app, host="0.0.0.0", port=8000, loop="asyncio")
