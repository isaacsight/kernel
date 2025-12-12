import os
import sys
import logging
import time
import json
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import importlib
import google.generativeai as genai

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("OpenWebUIBridge")

# Setup environment
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(root_dir)

# Fix namespace collision: Preload 'core' package
# This prevents 'import core' from resolving to 'admin/core.py' when admin is in path
try:
    import core
    # Ensure it's the package, not the file
    if not hasattr(core, '__path__'):
         # If we got the file, we must force load the package
         del sys.modules['core']
         import importlib.util
         spec = importlib.util.spec_from_file_location("core", os.path.join(root_dir, "core", "__init__.py"))
         module = importlib.util.module_from_spec(spec)
         sys.modules["core"] = module
         spec.loader.exec_module(module)
         logger.info(f"Forced load of core package: {module}")
    else:
        logger.info(f"Loaded core package: {core}")
except Exception as e:
    logger.error(f"Failed to preload core package: {e}")

from admin.config import config

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("OpenWebUIBridge")

app = FastAPI(title="Studio Agent Bridge", description="OpenAI-compatible API for Studio Agents")

# --- Data Models (OpenAI Compatible) ---

class Message(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[Message]
    stream: Optional[bool] = False
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None

class ModelCard(BaseModel):
    id: str
    object: str = "model"
    created: int = int(time.time())
    owned_by: str = "studio-os"

class ModelList(BaseModel):
    object: str = "list"
    data: List[ModelCard]

# --- Agent Loader ---

AGENTS: Dict[str, Any] = {}

def load_agents():
    """Dynamically loads available agents from admin.engineers package."""
    global AGENTS
    logger.info("Loading agents...")
    
    # Strategy 1: Load via __init__.py (Preferred)
    try:
        import admin.engineers
        logger.info(f"Loaded admin.engineers package.")
        
        for name, cls in vars(admin.engineers).items():
            if isinstance(cls, type) and name != "BaseAgent":
                try:
                    # Avoid duplicates or utility classes
                    if name in ["CommandRouter", "CommunicationAnalyzer"]:
                         continue
                         
                    # Try to instantiate to check for name/role
                    try:
                        agent_instance = cls()
                    except Exception:
                        continue
                        
                    if hasattr(agent_instance, 'name'):
                        AGENTS[agent_instance.name] = agent_instance
                        logger.info(f"Loaded agent via package: {agent_instance.name} ({name})")
                except Exception as e:
                    logger.warning(f"Failed to instantiate {name}: {e}")
                    
    except Exception as e:
        logger.error(f"Failed to import admin.engineers package: {e}", exc_info=True)

    # Strategy 2: File Iteration (Fallback)
    engineers_path = os.path.join(os.path.dirname(__file__), "engineers")
    if os.path.exists(engineers_path):
        agent_files = [f[:-3] for f in os.listdir(engineers_path) if f.endswith(".py") and f != "__init__.py"]
        
        for module_name in agent_files:
            # Check if likely already loaded (optimization)
            # This is hard because we don't know the class name in the file without importing
            
            try:
                module = importlib.import_module(f"admin.engineers.{module_name}")
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if isinstance(attr, type) and attr.__module__ == module.__name__:
                        try:
                            agent_instance = attr()
                            if hasattr(agent_instance, 'name'):
                                if agent_instance.name not in AGENTS:
                                    AGENTS[agent_instance.name] = agent_instance
                                    logger.info(f"Loaded agent via file: {agent_instance.name} ({attr_name})")
                        except Exception as e:
                            pass
            except Exception as e:
                logger.error(f"Failed to load module {module_name}: {e}", exc_info=True)


# Initial load
load_agents()

# --- Helpers ---

def get_agent_response(agent, messages: List[Message]) -> str:
    """
    Generates a response from an agent. 
    If the agent has a 'chat' method, uses it.
    Otherwise, uses a 'Persona Shell' via Gemini/LLM to simulate it.
    """
    last_user_message = next((m.content for m in reversed(messages) if m.role == "user"), "")
    history = messages[:-1]
    
    # 1. Native Chat Support (e.g., Alchemist)
    if hasattr(agent, "chat") and callable(agent.chat):
        # Todo: Pass history if supported
        return agent.chat(last_user_message)
        
    # 2. Native Execute Support for specific commands (Fallback)
    # This is harder to map to chat, so we go to simulation.
    
    # 3. Persona Shell Simulation
    # We use the configured LLM to roleplay as the agent.
    logger.info(f"Simulating {agent.name} via Persona Shell...")
    
    if not config.GEMINI_API_KEY:
        return f"I am {agent.name}, but I have no voice (GEMINI_API_KEY missing)."
        
    genai.configure(api_key=config.GEMINI_API_KEY)
    model = genai.GenerativeModel(config.GEMINI_MODEL)
    
    system_prompt = f"""
    You are {agent.name}, the {getattr(agent, 'role', 'Specialist')} of this system.
    
    YOUR MISSION:
    {getattr(agent, '__doc__', 'Help the user.')}
    
    CONTEXT:
    The user is chatting with you via the Studio OS interface.
    
    INSTRUCTIONS:
    - Stay in character.
    - Be helpful but concise.
    - If asked to do something you can't do via chat, explain your role.
    """
    
    # Construct history for Gemini
    gemini_history = []
    for m in history:
        role = "user" if m.role == "user" else "model"
        gemini_history.append({"role": role, "parts": [m.content]})
        
    chat = model.start_chat(history=gemini_history)
    
    try:
        response = chat.send_message(f"{system_prompt}\n\nUser: {last_user_message}")
        return response.text
    except Exception as e:
        return f"Error simulating agent: {e}"

# --- Endpoints ---

@app.get("/v1/models", response_model=ModelList)
async def list_models():
    """Lists available agents as models."""
    models = []
    # Add agents
    for agent_name in AGENTS.keys():
        models.append(ModelCard(id=agent_name))
        
    # Add a "Universal Router" model
    models.append(ModelCard(id="Studio Router"))
    
    return ModelList(data=models)

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    """
    Handles chat completion requests.
    """
    model_id = request.model
    logger.info(f"Chat request for model: {model_id}")
    
    response_text = ""
    
    if model_id == "Studio Router":
        # Route logic via CommandRouter
        from admin.engineers.command_router import route_and_log
        last_message = request.messages[-1].content
        result = route_and_log(last_message)
        response_text = result.get("message") or str(result)
        
    elif model_id in AGENTS:
        agent = AGENTS[model_id]
        response_text = get_agent_response(agent, request.messages)
        
    else:
        # Fuzzy match or fallback
        # Try to find partial match
        matched = next((name for name in AGENTS.keys() if model_id.lower() in name.lower()), None)
        if matched:
            agent = AGENTS[matched]
            response_text = get_agent_response(agent, request.messages)
        else:
            raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found.")

    # Construct OpenAI response object
    response_obj = {
        "id": f"chatcmpl-{int(time.time())}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model_id,
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": response_text
            },
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": 0, # Not calculating for now
            "completion_tokens": 0,
            "total_tokens": 0
        }
    }
    
    return response_obj

if __name__ == "__main__":
    # Reload logic only works if run as module, but here we just run directly
    uvicorn.run(app, host="0.0.0.0", port=8001)
