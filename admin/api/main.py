from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import sys

# Add project root to path to allow importing admin.core
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from admin import core
from admin.api.models import Post, AgentAction

app = FastAPI(title="Studio OS API", version="1.0.0")

# CORS Configuration
origins = [
    "http://localhost:5173",  # Vite Dev Server
    "http://localhost:3000",
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
    if action.agent_name == "The Alchemist":
        if action.action == "generate":
            topic = action.parameters.get("topic")
            provider = action.parameters.get("provider", "gemini")
            if not topic:
                raise HTTPException(status_code=400, detail="Topic is required")
            
            # Run in background to not block
            # Note: core.generate_ai_post is synchronous, so we might want to wrap it
            # For now, we'll just run it. In a real app, use a task queue.
            try:
                filename = core.generate_ai_post(topic, provider=provider)
                return {"message": "Alchemist finished", "filename": filename}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
                
    elif action.agent_name == "The Librarian":
        if action.action == "rebuild_graph":
            try:
                from admin.engineers.librarian import Librarian
                librarian = Librarian()
                posts = core.get_posts()
                librarian.build_graph(posts)
                return {"message": "Knowledge Graph updated"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

    elif action.agent_name == "The Guardian":
         if action.action == "audit":
             # Placeholder for audit logic
             return {"message": "Guardian finished audit"}

    raise HTTPException(status_code=400, detail="Unknown agent or action")

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
