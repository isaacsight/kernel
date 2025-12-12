from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import sys

# Add project root to path to allow importing admin.core
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from admin import core
from admin.heartbeat import heartbeat
from admin.api.models import Post, AgentAction
from admin.api.premium import router as premium_router

app = FastAPI(title="Studio OS API", version="1.0.0")

# Mount static files (Frontend Build)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure dist directory exists before mounting
dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/dist'))

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
origins = [
    "http://localhost:5173",  # Vite Dev Server
    "http://localhost:3000",
    "http://localhost:8081",  # Local Static Server
    "https://doesthisfeelright.com",  # Production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/agents")
async def get_agents():
    """
    Returns the current status of all agents.
    """
    # In a real system, these would be dynamic.
    # For now, we'll check if their dependencies are met.
    
    # Check Alchemist (Gemini/Ollama)
    alchemist_status = "Ready"
    
    # Check Operator (Server)
    server_manager = core.ServerManager()
    operator_status = "Active" if server_manager.get_status() == "Running" else "Standby"
    
    # Check Librarian (Graph)
    librarian_status = "Ready"
    if os.path.exists(os.path.join(core.REPO_DIR, "docs/static/graph.json")):
        librarian_status = "Active"

    return [
        {"name": "The Alchemist", "role": "Content Generator", "status": alchemist_status},
        {"name": "The Guardian", "role": "Safety Officer", "status": "Active"},
        {"name": "The Editor", "role": "Style & Quality", "status": "Active"},
        {"name": "The Librarian", "role": "Knowledge Graph", "status": librarian_status},
        {"name": "The Operator", "role": "System Manager", "status": operator_status},
        {"name": "The Visionary", "role": "Visual Design", "status": "Dreaming"},
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


# ==================== Client Portal Chat ====================
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
    
    Examples:
    - "Write a post about AI ethics"
    - "Publish the site"
    - "What's the status?"
    """
    try:
        from admin.engineers.command_router import get_command_router
        router = get_command_router()
        
        # Route the command
        routed = router.route(input.command)
        
        if not routed.get("success"):
            return {
                "success": False,
                "error": routed.get("error"),
                "suggestion": routed.get("suggestion")
            }
        
        # Execute the command
        result = router.execute(routed)
        
        return {
            "success": True,
            "intent": routed.get("intent"),
            "agents_involved": routed.get("target_agents"),
            "execution_plan": routed.get("execution_plan"),
            "result": result
        }
    except Exception as e:
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


# SPA Catch-all route
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

