"""
Command Router - AI-Powered Natural Language Code

Enhanced with Communication Analyzer integration for logging and insights.
"""

import os
import json
import logging
import time
import google.generativeai as genai
from typing import Dict, List, Any, Optional
from datetime import datetime
from admin.config import config

logger = logging.getLogger("CommandRouter")

class CommandRouter:
    """
    Routes natural language commands to the appropriate agent(s) using Gemini LLM.
    """
    
    def __init__(self):
        self.name = "Command Router"
        
        # Configure Gemini
        api_key = config.GEMINI_API_KEY
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL)
        else:
            logger.warning("GEMINI_API_KEY not found. CommandRouter will fail.")
            self.model = None

        # Agent registry with capabilities
        self.agents = {
            "Alchemist": "Generates blog posts, essays, and content. Params: 'topic'",
            "Guardian": "Audits content for safety and alignment. Params: 'content'",
            "Operator": "Manages system status, health, and deployment (publishing).",
            "Researcher": "Performs web research and finds trends. Params: 'query'",
            "Status": "Checks system health and team status.",
            "Help": "Explains how to use the system."
        }
        
    def route(self, user_input: str) -> Dict[str, Any]:
        """
        Uses LLM to analyze user input and determine the best course of action.
        """
        if not self.model:
             return {"success": False, "error": "LLM not configured"}
             
        # System Instruction for the Router
        prompt = f"""
        You are the "Studio OS" Orchestrator. Your job is to classify user requests and route them to the correct Agent.
        
        AVAILABLE AGENTS:
        {json.dumps(self.agents, indent=2)}
        
        USER INPUT: "{user_input}"
        
        INSTRUCTIONS:
        1. Analyze the user's intent.
        2. If it's a casual greeting or chit-chat, set "intent" to "chat" and write a friendly "response_text".
        3. If it's a command, map it to one of these ACTIONS: [generate_post, publish, status, research, help].
        4. Extract relevant parameters (e.g., topic, query).
        5. Return ONLY valid JSON.
        
        JSON STRUCTURE:
        {{
            "intent": "action" | "chat",
            "action": "generate_post" | "publish" | "status" | "research" | "help" | null,
            "target_agent": "Alchemist" | "Operator" | etc or null,
            "parameters": {{ "topic": "...", "query": "..." }},
            "response_text": "A brief, natural language response to the user confirming the action or replying to chat."
        }}
        """
        
        try:
            response = self.model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
            text_response = response.text.strip()
            # Clean potential markdown wrappers
            if text_response.startswith("```json"):
                text_response = text_response[7:-3]
            
            data = json.loads(text_response)
            
            return {
                "success": True,
                **data,
                "original_input": user_input,
                "routed_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Routing failed: {e}")
            return {
                "success": False, 
                "error": str(e),
                "intent": "unknown",
                "response_text": "I'm sorry, I'm having trouble connecting to my brain right now."
            }
    
    def execute(self, routed_command: Dict) -> Dict[str, Any]:
        """
        Executes the routed command.
        """
        if not routed_command.get("success"):
            return routed_command
            
        intent = routed_command.get("intent")
        action = routed_command.get("action")
        params = routed_command.get("parameters", {})
        response_text = routed_command.get("response_text", "")
        
        # If it's just chat, return the response
        if intent == "chat" or not action:
            return {
                "success": True,
                "intent": intent,
                "message": response_text
            }
            
        # Execute Action
        try:
            result_data = {}
            
            if action == "generate_post":
                from admin.engineers.alchemist import Alchemist
                alchemist = Alchemist()
                # Get the doctrine (simplifying import)
                from admin.core import get_doctrine
                doctrine = get_doctrine()
                
                topic = params.get("topic", "General")
                # We can run this async in a real app, but for now blocking is fine or we return a "started" message
                filename = alchemist.generate(topic, doctrine)
                result_data = {"filename": filename, "preview": f"Generated post about {topic}"}
                
            elif action == "publish":
                from admin.core import publish_git
                msg = publish_git()
                result_data = {"status": msg}
                
            elif action == "status":
                from admin.core import ServerManager
                from admin.brain.collective_intelligence import get_collective_intelligence
                server = ServerManager()
                ci = get_collective_intelligence()
                result_data = {
                    "server_status": server.get_status(),
                    "team_status": ci.get_team_status()
                }
                
            elif action == "research":
                 # Placeholder for researcher
                 result_data = {"info": "Research agent not fully linked yet."}

            return {
                "success": True,
                "intent": intent, 
                "action": action,
                "message": response_text,
                "data": result_data
            }
            
        except Exception as e:
            logger.error(f"Execution failed: {e}")
            return {
                "success": False,
                "message": f"I tried to {action}, but something went wrong: {str(e)}"
            }

# Singleton
_router = None

def get_command_router() -> CommandRouter:
    global _router
    if _router is None:
        _router = CommandRouter()
    return _router


def route_and_log(user_input: str, session_id: str = None) -> Dict[str, Any]:
    """
    Routes a command and logs the conversation to Communication Analyzer.
    
    This is the preferred entry point for chat interactions as it
    automatically tracks all communication for analysis.
    """
    router = get_command_router()
    
    # Time the operation
    start_time = time.time()
    
    # Route the command
    routed = router.route(user_input)
    
    # Execute the command
    result = router.execute(routed)
    
    # Calculate response time
    response_time_ms = int((time.time() - start_time) * 1000)
    
    # Log to Communication Analyzer
    try:
        from admin.engineers.communication_analyzer import get_communication_analyzer
        analyzer = get_communication_analyzer()
        
        conversation_id = analyzer.log_conversation(
            user_input=user_input,
            detected_intent=routed.get("intent", "unknown"),
            action=routed.get("action"),
            routed_to=routed.get("target_agent"),
            response=result.get("message", ""),
            execution_success=result.get("success", False),
            execution_data=result.get("data"),
            session_id=session_id,
            response_time_ms=response_time_ms
        )
        
        # Attach conversation ID to result for feedback
        result["conversation_id"] = conversation_id
        
    except Exception as e:
        logger.warning(f"Failed to log conversation: {e}")
    
    return result

