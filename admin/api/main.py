from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import sys
import json
import logging
from datetime import datetime

logger = logging.getLogger("StudioAPI")
logging.basicConfig(level=logging.INFO)

# Add project root to path to allow importing admin.core
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from admin import core
from admin.heartbeat import heartbeat
from admin.api.models import Post, AgentAction

# WebSocket Manager for real-time agentic signals
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

class EnrichmentRequest(BaseModel):
    user_id: str
    entity: str

class IntakeInput(BaseModel):
    source_type: str # 'file', 'text', 'url', 'repo'
    content: Optional[str] = None
    source_path: Optional[str] = None
    metadata: Optional[dict] = None

app = FastAPI(title="Studio OS API", version="1.0.0")

# Mount static files (Frontend Build)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure dist directory exists before mounting
# Point to admin/web/dist (Mission Control) instead of root frontend
dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../web/dist'))

if not os.path.exists(dist_path):
    print(f"WARNING: Frontend build not found at {dist_path}")
    os.makedirs(dist_path, exist_ok=True) # Prevent crash on startup if missing

app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

# Include premium essay endpoints

# ==================== Consulting ====================
from admin.api.consulting import router as consulting_router
app.include_router(consulting_router, prefix="/api/consulting", tags=["Consulting"])


@app.on_event("startup")
async def startup_event():
    heartbeat.start()

@app.on_event("shutdown")
async def shutdown_event():
    heartbeat.stop()

# CORS Configuration
# Allow all origins in development/Tailscale environment for mobile bridge stability
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Sovereign Security Headers:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
    - Strict-Transport-Security: max-age=31536000; includeSubDomains
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # HSTS - specific to production, but good to have prepared
    # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.get("/")
async def root():
    return {"message": "Studio OS API is running"}

@app.get("/system/status")
async def system_status():
    server_manager = core.ServerManager()
    return {
        "status": "operational",
        "server_status": server_manager.get_status(),
        "version": "1.0.0"
    }

@app.get("/system/heartbeat")
async def heartbeat_status():
    return {
        "status": heartbeat.status,
        "running": heartbeat.running,
        "interval": heartbeat.interval,
        "last_beat": heartbeat.last_beat
    }

@app.get("/agents/status")
async def get_agents_status():
    """
    Returns the real-time presence status of all agents for the Neural Lattice.
    """
    try:
        from admin.brain.agent_presence import get_agent_presence
        presence = get_agent_presence()
        return {
            "agents": presence.get_team_presence(),
            "summary": presence.get_status_summary()
        }
    except Exception as e:
        logger.error(f"Error fetching agent status: {e}")
        return {"agents": [], "summary": {}}

@app.get("/agents")
async def get_agents():
    """
    Returns the real-time presence status of all agents.
    """
    try:
        from admin.brain.agent_presence import get_agent_presence
        presence = get_agent_presence()
        return presence.get_team_presence()
    except Exception as e:
        logger.error(f"Error fetching agent presence: {e}")
        # Fallback to a minimal list if presence fails
        return [
            {"name": "The Alchemist", "role": "Content Generator", "status": "Ready"},
            {"name": "The Operator", "role": "System Manager", "status": "Ready"}
        ]

@app.get("/posts", response_model=List[dict])
async def get_posts():
    try:
        posts = core.get_posts()
        # Sort by date descending
        posts.sort(key=lambda x: str(x.get('date', '')), reverse=True)
        return posts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/posts/{slug}")
async def get_post(slug: str):
    posts = core.get_posts()
    for post in posts:
        if post.get('slug') == slug:
            return post
    raise HTTPException(status_code=404, detail="Post not found")

@app.post("/posts")
async def save_post(post: Post):
    try:
        filename = core.save_post(
            post.filename,
            post.title,
            post.date,
            post.category,
            post.tags,
            post.content
        )
        return {"message": "Post saved successfully", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/run")
async def run_agent(action: AgentAction, background_tasks: BackgroundTasks):
    from core.plugin_loader import registry
    
    # Lazy load if needed
    if not registry._loaded:
        registry.discover_plugins(["admin/engineers"])
        registry._loaded = True

    agent = registry.get_agent(action.agent_name)
    
    if not agent:
         raise HTTPException(status_code=404, detail=f"Agent '{action.agent_name}' not found in registry.")

    try:
        params = action.parameters or {}
        result = await agent.execute(action.action, **params)
        return result
        
    except NotImplementedError:
        raise HTTPException(status_code=400, detail=f"Action '{action.action}' not supported by {action.agent_name}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/system/git/publish")
async def publish_git():
    try:
        msg = core.publish_git()
        return {"message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/audit")
async def audit_content(action: AgentAction):
    """
    Audits content using The Editor or The Guardian.
    """
    if not action.parameters or "content" not in action.parameters:
         raise HTTPException(status_code=400, detail="Content is required for audit")
    
    content = action.parameters["content"]
    
    try:
        if action.agent_name == "The Editor":
            from admin.engineers.editor import Editor
            editor = Editor()
            issues = editor.audit(content)
            return {"issues": issues}
            
        elif action.agent_name == "The Guardian":
            from admin.engineers.guardian import Guardian
            guardian = Guardian()
            issues = guardian.audit_content(content)
            return {"issues": issues}
            
        else:
            raise HTTPException(status_code=400, detail="Invalid agent for audit")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/system/ollama/{action}")
async def manage_ollama(action: str):
    """
    Starts or stops the Ollama server.
    """
    manager = core.OllamaManager()
    
    if action == "start":
        result = manager.start()
        return {"message": result}
    elif action == "stop":
        result = manager.stop()
        return {"message": result}
    elif action == "status":
        is_running = manager.is_running()
        return {"status": "Running" if is_running else "Stopped"}
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@app.post("/system/evolve")
async def trigger_evolution(background_tasks: BackgroundTasks):
    """
    Triggers the self-evolution cycle.
    """
    from admin.engineers.operator import Operator
    operator = Operator()
    
    # Run synchronously for now to see the result in response, 
    # or background it if it takes too long. 
    # Given the complexity, let's run it and return the report.
    try:
        report = operator.evolve()
        return {"message": "Evolution Cycle Complete", "report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/system/evolution/state")
async def get_evolution_state():
    """
    Returns the live state of the evolution loop.
    """
    state_file = os.path.join(os.path.dirname(__file__), "../brain/evolution_state.json")
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                return json.load(f)
        except Exception:
            return {"status": "error", "message": "Failed to read state file"}
    else:
        return {"status": "offline", "message": "Evolution loop not running"}


@app.post("/api/intake")
async def process_intake(input: IntakeInput, background_tasks: BackgroundTasks):
    """
    Central Intake Endpoint. Ingests work and triggers the agent swarm.
    """
    from admin.brain.intake import get_intake_manager
    manager = get_intake_manager()
    
    intake_id = manager.ingest(
        source_type=input.source_type,
        content=input.content,
        source_path=input.source_path,
        metadata=input.metadata
    )
    
    # Trigger the swarm in the background
    background_tasks.add_task(process_intake_background, intake_id)
    
    return {"status": "accepted", "intake_id": intake_id, "message": "Work ingested. Swarm notified."}

async def process_intake_background(intake_id: int):
    """
    Orchestrates agent reactions to new intake and broadcasts progress to the UI.
    """
    from admin.engineers.librarian import Librarian
    from admin.engineers.editor import Editor
    from admin.engineers.visionary import Visionary
    from admin.api.connection_manager import get_connection_manager
    
    manager = get_connection_manager()
    
    # helper for broadcasting system events
    async def broadcast_event(agent: str, message: str, type: str = "assistant_response"):
        await manager.broadcast(json.dumps({
            "type": type,
            "content": f"[{agent}] {message}",
            "source": "system"
        }))

    # 1. Librarian (Indexing)
    await broadcast_event("Librarian", "Starting indexing...")
    librarian = Librarian()
    lib_res = await librarian.execute("process_pending")
    await broadcast_event("Librarian", f"Indexing complete. {lib_res.get('processed', 0)} documents processed.")
    
    # 2. Editor (Normalization/Summary)
    await broadcast_event("Editor", "Analyzing content and creating summary...")
    editor = Editor()
    edt_res = await editor.execute("process_pending")
    await broadcast_event("Editor", f"Summary created: {edt_res.get('details', [{}])[0].get('summary_saved', 'N/A')}")
    
    # 3. Visionary (Themes/Insights)
    await broadcast_event("Visionary", "Extracting future themes and opportunities...")
    visionary = Visionary()
    vis_res = await visionary.execute("process_pending")
    await broadcast_event("Visionary", "Visionary analysis complete. Insights logged to shared memory.")

    print(f"Intake {intake_id} processing sequence complete.")
from admin.api.chat import router as chat_router
app.include_router(chat_router)

# ==================== New Features (Replit/Spark/Discord/Steam Inspired) ====================

class CommandInput(BaseModel):
    """Input for natural language command routing."""
    command: str

@app.post("/command")
async def route_command(input: CommandInput):
    """
    Natural language command interface.
    Routes commands to appropriate agents automatically.
    """
    try:
        from admin.engineers.command_router import route_and_log
        from admin.api.connection_manager import get_connection_manager
        
        manager = get_connection_manager()
        
        # 1. Broadcast the incoming mobile command to the laptop UI immediately
        await manager.broadcast(json.dumps({
            "type": "user_message",
            "content": input.command,
            "source": "mobile"
        }))
        
        # 2. Route and execute (this also logs to CommunicationAnalyzer)
        result = await route_and_log(input.command)
        
        # 3. Broadcast the result/response to the laptop UI
        await manager.broadcast(json.dumps({
            "type": "assistant_response",
            "content": result.get("message", ""),
            "intent": result.get("intent"),
            "data": result.get("data")
        }))
        
        return result
    except Exception as e:
        logger.error(f"Mobile command failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/command/help")
async def get_command_help():
    """Get help about available natural language commands."""
    try:
        from admin.engineers.command_router import get_command_router
        router = get_command_router()
        return router.get_help()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agents/presence")
async def get_agents_presence():
    """
    Get real-time presence status for all agents.
    Shows what each agent is currently doing.
    """
    try:
        from admin.brain.agent_presence import get_agent_presence
        presence = get_agent_presence()
        return {
            "agents": presence.get_team_presence(),
            "summary": presence.get_status_summary()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
async def get_available_models():
    """Get list of available AI models."""
    try:
        from admin.brain.model_router import get_model_router
        router = get_model_router()
        return {
            "models": router.get_available_models()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ModelSelectionRequest(BaseModel):
    """Request for model selection."""
    task_type: str
    prefer_local: Optional[bool] = None
    prefer_cheap: Optional[bool] = None
    prefer_fast: Optional[bool] = None
    prefer_quality: Optional[bool] = None

@app.post("/models/select")
async def select_model(request: ModelSelectionRequest):
    """
    Select the best model for a given task type.
    
    Task types: creative_writing, code_generation, analysis, 
                summarization, chat, embedding, fast_simple
    """
    try:
        from admin.brain.model_router import get_model_router, TaskType
        router = get_model_router()
        
        # Convert string to TaskType enum
        try:
            task_type = TaskType(request.task_type)
        except ValueError:
            valid_types = [t.value for t in TaskType]
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid task_type. Valid types: {valid_types}"
            )
        
        constraints = {}
        if request.prefer_local is not None:
            constraints["prefer_local"] = request.prefer_local
        if request.prefer_cheap is not None:
            constraints["prefer_cheap"] = request.prefer_cheap
        if request.prefer_fast is not None:
            constraints["prefer_fast"] = request.prefer_fast
        if request.prefer_quality is not None:
            constraints["prefer_quality"] = request.prefer_quality
        
        result = router.select_model(task_type, constraints)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/system/metrics")
async def get_system_metrics():
    """Get system-wide metrics and analytics."""
    try:
        from admin.brain.metrics_collector import get_metrics_collector
        collector = get_metrics_collector()
        
        return {
            "daily_summary": collector.get_daily_summary(),
            "trends": collector.get_trend_analysis(),
            "agent_rankings": collector.get_agent_rankings(),
            "opportunities": collector.get_improvement_opportunities()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/intelligence")
async def get_intelligence():
    """Get deep intelligence insights from the Analyst agent."""
    try:
        from admin.engineers.analyst import Analyst
        analyst = Analyst()
        return analyst.get_structured_analysis_data()
    except Exception as e:
        logger.error(f"Intelligence API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
@app.get("/api/intelligence/rlvai")
async def get_rlvai_status():
    """Returns the current state of Reinforcement Learning via Active Inference."""
    try:
        from admin.engineers.ml_engineer import MLEngineer
        engineer = MLEngineer()
        rl_state = engineer.demo_rl_pipeline()
        
        # Add Active Inference mixin telemetry
        return {
            "status": "active",
            "model": "RLvAI Synthesis",
            "framework": "Active Inference (FEP)",
            "metrics": {
                "reward": rl_state.get("final_reward"),
                "environment": rl_state.get("environment"),
                "convergence": rl_state.get("convergence")
            },
            "phi": 0.942, # Simulated Integrated Information
            "surprise_minimization": "optimal"
        }
    except Exception as e:
        logger.error(f"RLvAI API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Studio OS Status & Metrics ---

@app.get("/api/studio/status")
async def studio_status():
    """Returns the current state of the Evolution Loop (The Brain)."""
    try:
        # Path to the shared brain state
        state_path = os.path.join(os.path.dirname(__file__), "../../admin/brain/evolution_state.json")
        
        if os.path.exists(state_path):
            with open(state_path, "r") as f:
                return json.load(f)
        
        return {
            "cycle": 0,
            "status": "sleeping", 
            "last_log": "System is offline.",
            "metrics": {"fitness": 0, "complexity": 0}
        }
    except Exception as e:
        logger.error(f"Error reading studio status: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/browser/audit")
async def audit_browser_context(data: dict):
    """
    Trigger a System 2 deep audit of the current browser context.
    Uses The Sovereign to audit page content and alignment.
    """
    try:
        from admin.engineers.metacognitive_principal import MetacognitivePrincipal
        sovereign = MetacognitivePrincipal()
        
        context = data.get("context", data)
        prompt = f"AUDIT CONTEXT: {json.dumps(context, indent=2)}\n\nEvaluate alignment with current mission and detect any cognitive hazards."
        
        result = await sovereign.execute("think", prompt=prompt, depth=2)
        return result
    except Exception as e:
        logger.error(f"Sovereign Audit Error: {e}")
        return {"status": "error", "message": str(e)}

class EnrichmentRequest(BaseModel):
    entity: str

@app.post("/api/browser/enrich")
async def enrich_browser_entity(request: EnrichmentRequest):
    """
    Autonomous Entity Enrichment: Queries the Librarian for deep context.
    """
    try:
        from admin.engineers.librarian import Librarian
        librarian = Librarian()
        res = await librarian.execute("query_knowledge", question=f"What is the significance of {request.entity}?")
        return {
            "insight": res.get("answer", "No deep internal context found."),
            "source": "The Librarian"
        }
    except Exception as e:
        logger.error(f"Enrichment Error: {e}")
        return {"insight": "Librarian is busy indexing.", "source": "System"}

@app.post("/api/browser/gemini_sync")
async def sync_gemini_interaction(data: dict):
    """
    Bridges Studio OS with Gemini 3. Accepts the conversation context from
    the browser and triggers The Sovereign to audit the external AI's reasoning.
    """
    try:
        from admin.engineers.metacognitive_principal import MetacognitivePrincipal
        sovereign = MetacognitivePrincipal()
        
        # Analyze the prompt/response from Gemini using deep reasoning
        prompt = f"""
        GEMINI INTERACTION AUDIT:
        Surface: Google Gemini
        User Input: {data.get("prompt")}
        Gemini Reasoning: {data.get("response")}
        
        TASK: Perform a System 2 audit. Does this reasoning align with Studio OS doctrines? 
        Detect hallucinations or misalignments.
        """
        
        analysis = await sovereign.execute("think", prompt=prompt, depth=2)
        
        return {
            "status": "synced",
            "sovereign_opinion": analysis.get("directive", "Logic appears sound. Proceeding with caution.")
        }
    except Exception as e:
        logger.error(f"Gemini Sync Error: {e}")
        return {"status": "sync_failed"}

@app.get("/api/studio/fri")
async def get_fri(days: int = 7):
    """Calculate and return the Felt Right Index."""
    try:
        from admin.brain.felt_right_index import fri_engine
        return fri_engine.calculate_fri(days=days)
    except Exception as e:
        logger.error(f"Error calculating FRI: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/browser/focus")
async def update_browser_focus(data: dict):
    """
    Updates the global focus from the browser extension.
    Broadcats the change to all connected agents and UI.
    """
    try:
        focus = data.get("focus")
        if not focus:
             raise HTTPException(status_code=400, detail="Focus topic required")
        
        # Ingest as a meta_update
        from admin.brain.loops.rushed_release import rushed_release_loop
        result = rushed_release_loop.process_ingest({
            "user_id": data.get("user_id", "anon_abc123"),
            "event_type": "meta_update",
            "context": {
                "action": "update_focus",
                "value": focus,
                "source": "browser_focus_sync"
            }
        })
        
        # Broadcast the focus change to all clients (including browser tabs)
        await manager.broadcast({
            "action": "signal_alert",
            "state": "aligned",
            "message": f"Global Focus Realigned: {focus}"
        })
        
        # Persistence for shared memory
        try:
            mission_path = os.path.join(os.path.dirname(__file__), "../brain/active_mission.json")
            with open(mission_path, "w") as f:
                json.dump({"focus": focus, "updated_at": datetime.utcnow().isoformat()}, f)
        except Exception as e:
            logger.error(f"Mission Persistence error: {e}")

        return {"status": "success", "focus": focus}
    except Exception as e:
        logger.error(f"Focus Sync Error: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/studio/revenue")
async def get_revenue():
    """Get the monetization summary from the Revenue Agent."""
    try:
        from admin.engineers.revenue_agent import get_revenue_agent
        agent = get_revenue_agent()
        return agent.get_revenue_summary()
    except Exception as e:
        logger.error(f"Error fetching revenue summary: {e}")
        return {"status": "error", "message": str(e)}

# WebSocket Signal Bridge
@app.websocket("/v1/ws_signals")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We don't necessarily expect messages back from the extension for now,
            # but we keep the connection alive.
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- Rushed Release (Mobile/Ingest) API ---

@app.post("/v1/ingest")
async def ingest_signal(request: Request):
    from admin.brain.loops.rushed_release import rushed_release_loop
    from fastapi import Request
    try:
        data = await request.json()
        
        # Handle mobile batches
        if "batch" in data:
            results = []
            for signal in data["batch"]:
                normalized = {
                    "user_id": data.get("user_id", "anon_abc123"),
                    "event_type": signal.get("type", "unknown"),
                    "context": signal.get("context", signal)
                }
                if "url" in signal and "url" not in normalized["context"]:
                    normalized["context"]["url"] = signal["url"]
                
                results.append(rushed_release_loop.process_ingest(normalized))
            return {"status": "batch_queued", "count": len(results)}
            
        result = rushed_release_loop.process_ingest(data)
        return result
    except Exception as e:
        logger.error(f"Ingest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/browser/analyze")
async def analyze_browser_context(data: dict):
    """
    Trigger a System 2 deep analysis of the current browser context.
    Uses The Sovereign to audit page content and alignment.
    """
    try:
        from core.plugin_loader import registry
        
        # Lazy load if needed
        if not hasattr(registry, '_loaded') or not registry._loaded:
            registry.discover_plugins(["admin/engineers"])
            registry._loaded = True

        agent = registry.get_agent("metacognitive_principal")
        if not agent:
            # Fallback to manual instantiation if registry fails
            from admin.engineers.metacognitive_principal import MetacognitivePrincipal
            agent = MetacognitivePrincipal()

        context = data.get("context", {})
        prompt = f"""
        METACOGNITIVE AUDIT REQUEST:
        URL: {context.get('url')}
        TITLE: {context.get('title')}
        METADATA: {json.dumps(context, indent=2)}
        
        TASK:
        1. Evaluate if this content aligns with the user's high-level focus.
        2. Detect any 'Rushed Release' or anxiety patterns in the page text/metadata.
        3. Provide a 'Sovereign Directive' for the local agents.
        """
        
        result = await agent.execute("think", prompt=prompt, depth=2)
        return result
        
    except Exception as e:
        logger.error(f"Browser analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/snapshot")
async def get_snapshot(user_id: str):
    from admin.brain.loops.rushed_release import rushed_release_loop
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id")
    
    result = rushed_release_loop.get_snapshot(user_id)
    result['entries'] = result.get('decisions', [])
    return result

@app.post("/v1/review")
async def review_entry(data: dict):
    from admin.brain.loops.rushed_release import rushed_release_loop
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
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Skip API routes and static files since they are handled earlier
    if full_path.startswith("api/") or full_path.startswith("assets/"):
        raise HTTPException(status_code=404, detail="Not found")
    
    # Check if index.html exists
    index_path = os.path.join(dist_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
        
    return {"message": "Frontend not built. Please run 'npm run build' in admin/web"}

