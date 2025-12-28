"""
Command Router - AI-Powered Natural Language Code

Enhanced with Communication Analyzer integration for logging and insights.
"""

import os
import json
import logging
import asyncio
import time
import google.generativeai as genai
from typing import Dict, List, Any, Optional
from datetime import datetime
import requests
from admin.config import config

logger = logging.getLogger("CommandRouter")

class RemoteNode:
    """Helper to interact with the remote Studio Node (Windows)."""
    def __init__(self, url):
        self.url = url

    def execute_agent(self, agent_name, task, context=None):
        try:
            response = requests.post(
                f"{self.url}/agent/run",
                json={
                    "agent_name": agent_name,
                    "task": task,
                    "context": context or {}
                },
                timeout=30
            )
            return response.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def relay_command(self, command):
        try:
            response = requests.post(
                f"{self.url}/execute",
                json={"command": command},
                timeout=30
            )
            return response.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

class CommandRouter:
    """
    Routes natural language commands to the appropriate agent(s) using Gemini LLM.
    """
    
    def __init__(self):
        self.name = "Command Router"
        
        # Configure Gemini
        api_key = config.GEMINI_API_KEY
        if api_key:
            logger.info(f"CommandRouter initialized with API Key: {api_key[:10]}...")
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL)
        else:
            logger.warning("GEMINI_API_KEY not found. CommandRouter will fail.")
            self.model = None

        # Agent registry with capabilities
        self.agents = {
            "Alchemist": "Generates blog posts, essays, and content. Params: 'topic'",
            "Guardian": "Audits content for safety and alignment. Params: 'content'",
            "Operator": "Manages system status, health, deployments, and mobile bridge. Actions: 'bridge_to_mobile', 'system_telemetry', 'apply', 'run_command'.",
            "Researcher": "Performs web research and finds trends. Params: 'query'",
            "Status": "Checks system health and team status.",
            "Librarian": "Queries the Knowledge Graph and indexes docs.",
            "Antigravity": "Autonomous coding agent. Can read/write files, run commands, and implement code changes. Actions: 'code', 'build', 'implement', 'fix', 'refactor'. Params: 'task'",
            "Design Partner": "Focused on patterns, architectures, and design systems. Integrates Architect and Librarian capabilities. Use for 'does this feel right?' inquiries.",
            "Content Engine Brain": "High-speed content pipeline. Integrates Alchemist and Editor. Use for end-to-end content generation and auditing.",
            "Research Copilot": "Technical discovery and autonomous research. Integrates Researcher and Antigravity for deep paper/tool audits.",
            "Help": "Explains how to use the system.",
            "MLEngineer": "Expert in Machine Learning and Reinforcement Learning. Use for RL optimization, reward modeling, and deep learning audits.",
            "Director": "Sovereign orchestration for 'Directing vs Typing'. Use for high-level project missions. Actions: 'direct'. Params: 'mission'"
        }
        
        # Remote Node
        self.node = RemoteNode(config.STUDIO_NODE_URL) if config.STUDIO_NODE_URL else None

        # Dispatch Map
        self.action_handlers = {
            "generate_post": self._handle_generate_post,
            "publish": self._handle_publish,
            "status": self._handle_status,
            "research": self._handle_research,
            "mobile_handover": self._handle_mobile_handover,
            "system_control": self._handle_system_control,
            "code": self._handle_code,
            "capture_note": self._handle_capture_note,
            "reflect": self._handle_reflect,
            "rl_optimize": self._handle_rl_optimize,
            "direct": self._handle_direct
        }
    def route(self, user_input: str) -> Dict[str, Any]:
        """
        Uses LLM to analyze user input and determine the best course of action.
        """
        # --- BYPASS: String-based routing for reliability ---
        lower_input = user_input.lower().strip()
        if lower_input.startswith("note:"):
            return {
                "success": True,
                "intent": "action",
                "action": "capture_note",
                "target_agent": "Librarian",
                "parameters": {"content": user_input[5:].strip()},
                "response_text": "I've captured your note in the system memory. I'll remember this.",
                "original_input": user_input,
                "routed_at": datetime.now().isoformat()
            }
        
        if any(word in lower_input for word in ["review", "reflect", "summarize my notes"]):
            return {
                "success": True,
                "intent": "action",
                "action": "reflect",
                "target_agent": "ReflectionAgent",
                "parameters": {},
                "response_text": "Analyzing your recent thoughts and notes. One moment...",
                "original_input": user_input,
                "routed_at": datetime.now().isoformat()
            }
        
        if any(word in lower_input for word in ["reinforcement learning", "rl optimize", "rlvai"]):
            return {
                "success": True,
                "intent": "action",
                "action": "rl_optimize",
                "target_agent": "MLEngineer",
                "parameters": {"topic": "general"},
                "response_text": "Initiating Reinforcement Learning optimization via the ML Engineer...",
                "original_input": user_input,
                "routed_at": datetime.now().isoformat()
            }
        # ----------------------------------------------------

        if not self.model:
             return {"success": False, "error": "LLM not configured"}
             
        # System Instruction for the Router
        # System Instruction for the Router
        prompt = self._get_system_instruction(user_input)
        
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
            error_str = str(e)
            logger.error(f"Routing failed: {error_str}")
            
            # Detect Rate Limiting (429) or Invalid Key (400)
            if "RESOURCE_EXHAUSTED" in error_str or "429" in error_str:
                return {
                    "success": False,
                    "error": "rate_limit_exceeded",
                    "intent": "system_error",
                    "message": "Sovereign Core is currently at capacity (Gemini API 429). Please wait a moment or upgrade to a paid tier for higher limits."
                }
            elif "API_KEY_INVALID" in error_str or "400" in error_str and "API Key not found" in error_str:
                return {
                    "success": False,
                    "error": "invalid_api_key",
                    "intent": "system_error",
                    "message": "Sovereign Core API Key is balance/invalid. Please check your billing status or generate a new key in Google AI Studio."
                }

            # Alchemy Transmutation: Turn unknown errors into solutions
            logger.warning(f"Router failed ({error_str}). Summoning Alchemist for fallback...")
            try:
                from admin.engineers.alchemist import Alchemist
                alchemist = Alchemist()
                # Ask Alchemist to handle the user's input directly as a chat fallback
                fallback_response = alchemist.chat(f"System Error in Router: {error_str}. User said: '{user_input}'. Reply to user creatively as if you are the system recovering.")
                return {
                    "success": True,
                    "intent": "chat",
                    "action": None,
                    "target_agent": "Alchemist (Fallback)",
                    "response_text": fallback_response
                }
            except Exception as e2:
                logger.error(f"Even Alchemy failed: {e2}")
                return {
                    "success": False, 
                    "error": error_str,
                    "intent": "unknown",
                    "response_text": "System Overload. All circuits busy. Please retry."
                }

    def _get_system_instruction(self, user_input: str) -> str:
        """
        Returns the orchestration prompt.
        """
        return f"""
        You are the "Studio OS" Orchestrator. Your job is to classify user requests and route them to the correct Agent.
        
        AVAILABLE AGENTS:
        {json.dumps(self.agents, indent=2)}
        
        USER INPUT: "{user_input}"
        
        INSTRUCTIONS:
        1. Analyze the user's intent.
        2. If it's a casual greeting, set "intent" to "chat".
        3. If it's a command, map it to one of these ACTIONS: [generate_post, publish, status, research, help, mobile_handover, system_control, code, capture_note, reflect].
        4. "mobile_handover": Use when the user wants to send context/data to their phone or Gemini mobile.
        5. "system_control": Use for deep system operations or telemetry requests.
        6. "code": Use for coding tasks like building features, fixing bugs, refactoring, or implementing changes. Route to Antigravity.
        7. "capture_note": Use when the user wants to save a note, idea, or draft.
        8. "reflect": Use when the user wants to review, summarize, or reflect on their recent thoughts and notes.
        9. Extract relevant parameters (e.g., topic, query, content, task).
        10. Return ONLY valid JSON.
        
        JSON STRUCTURE:
        {{
            "intent": "action" | "chat",
            "action": "generate_post" | "publish" | "status" | "research" | "help" | "mobile_handover" | "system_control" | "code" | "capture_note" | "reflect" | "rl_optimize" | "direct",
            "target_agent": "Alchemist" | "Operator" | "Librarian" | "Design Partner" | "Content Engine Brain" | "ReflectionAgent" | "MLEngineer" | "Director",
            "parameters": {{ "topic": "...", "query": "...", "content": "Note text or summary", "task": "...", "mission": "..." }},
            "response_text": "A brief, natural language response confirming the action."
        }}
        """
    
    async def execute(self, routed_command: Dict) -> Dict[str, Any]:
        """
        Executes the routed command using the dispatch map.
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
            handler = self.action_handlers.get(action)
            result_data = {}
            
            if handler:
                if asyncio.iscoroutinefunction(handler):
                    result_data = await handler(params, routed_command)
                else:
                    result_data = handler(params, routed_command)
            else:
                 logger.warning(f"No handler found for action: {action}")

            # Failover / Relay check: If action isn't handled locally or explicitly requested remote
            if not result_data and params.get("remote") and self.node:
                logger.info(f"Relaying command to remote node: {action}")
                return self.node.execute_agent(routed_command.get("target_agent", "GeneralAgent"), action, params)

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

    # --- Action Handlers ---

    def _handle_generate_post(self, params, cmd):
        from admin.core import generate_ai_post
        topic = params.get("topic", "General")
        filename = generate_ai_post(topic)
        return {"filename": filename, "preview": f"Generated post about {topic}"}

    def _handle_publish(self, params, cmd):
        from admin.core import publish_git
        msg = publish_git()
        return {"status": msg}

    def _handle_status(self, params, cmd):
        from admin.core import ServerManager
        from admin.brain.collective_intelligence import get_collective_intelligence
        server = ServerManager()
        ci = get_collective_intelligence()
        return {
            "server_status": server.get_status(),
            "team_status": ci.get_team_status()
        }

    def _handle_research(self, params, cmd):
        if self.node:
            return self.node.execute_agent("Researcher", f"Research {params.get('query', 'trends')}")
        return {"info": "Research agent not fully linked yet."}

    async def _handle_mobile_handover(self, params, cmd):
        from admin.engineers.operator import Operator
        op = Operator()
        return await op.execute("bridge_to_mobile", **params)

    async def _handle_system_control(self, params, cmd):
        from admin.engineers.operator import Operator
        op = Operator()
        if params.get('command'):
            return await op.execute("run_command", command=params['command'])
        else:
            return await op.execute("system_telemetry", **params)

    async def _handle_code(self, params, cmd):
        from admin.engineers.antigravity_engineer import AntigravityEngineer
        agent = AntigravityEngineer()
        task_description = params.get('task', cmd.get('original_input', ''))
        
        # Inject Sovereign Prompts
        task_description = self._inject_sovereign_prompts(task_description)
        
        result = await agent.execute(task_description)
        return {"result": result}

    def _handle_capture_note(self, params, cmd):
        from admin.brain.intake import get_intake_manager
        manager = get_intake_manager()
        content = params.get("content") or cmd.get("original_input", "")
        if content.lower().startswith("note:"):
            content = content[5:].strip()
        
        intake_id = manager.ingest(
            source_type="text",
            content=content,
            metadata={"source": "mobile_bridge", "intent": "note_capture"}
        )
        return {"intake_id": intake_id, "status": "captured"}

    async def _handle_reflect(self, params, cmd):
        try:
            from admin.engineers.reflection_agent import ReflectionAgent
            agent = ReflectionAgent()
            return await agent.execute("summarize_recent_notes", **params)
        except ImportError:
            # Fallback
            return {"info": "ReflectionAgent not installed."}

    def _handle_rl_optimize(self, params, cmd):
        from admin.engineers.ml_engineer import MLEngineer
        engineer = MLEngineer()
        return engineer.demo_rl_pipeline()

    async def _handle_direct(self, params, cmd):
        from admin.engineers.directing_loop import DirectingLoop
        loop = DirectingLoop()
        mission = params.get("mission") or cmd.get("original_input", "")
        if mission.lower().startswith("direct:"):
            mission = mission[7:].strip()
        
        result = await loop.execute_mission(mission)
        return result

    def _inject_sovereign_prompts(self, task_description: str) -> str:
        """
        Injects specific system prompts based on keywords in the task description.
        This is the "Kinetic Prompt" layer.
        """
        task_lower = task_description.lower()
        
        # 1. Entropy / Refactor
        if "entropy" in task_lower or "refactor" in task_lower:
            from admin.brain.system_prompts import SystemPrompts
            return f"{SystemPrompts.get_entropy_reduction_prompt()}\\n\\nTASK: {task_description}"

        # 2. UX / Design / Aesthetic
        design_keywords = ["aesthetic", "design", "ux", "ui", "color", "mobile", "layout", "typography", "motion", "animation", "visual"]
        if any(k in task_lower for k in design_keywords):
            from admin.brain.system_prompts import SystemPrompts
            return f"{SystemPrompts.get_aesthetic_integrity_prompt()}\\n{SystemPrompts.get_first_impression_audit_prompt()}\\n\\nTASK: {task_description}"

        # 3. Deep Research
        if any(k in task_lower for k in ["research", "investigate", "sota"]):
            from admin.brain.system_prompts import SystemPrompts
            return f"{SystemPrompts.get_deep_research_protocol_prompt()}\\n\\nTASK: {task_description}"

        # 4. Experiment / Hypothesis
        if any(k in task_lower for k in ["experiment", "hypothesis", "a/b"]):
             from admin.brain.system_prompts import SystemPrompts
             return f"{SystemPrompts.get_experiment_design_prompt()}\\n{SystemPrompts.get_bandit_algorithm_strategy_prompt()}\\n\\nTASK: {task_description}"

        # 5. Paper / ArXiv
        if any(k in task_lower for k in ["paper", "arxiv", "summary"]):
             from admin.brain.system_prompts import SystemPrompts
             return f"{SystemPrompts.get_arxiv_distillation_prompt()}\\n\\nTASK: {task_description}"

        # 6. ML / Model
        if any(k in task_lower for k in ["model", "training", "hparams"]):
             from admin.brain.system_prompts import SystemPrompts
             return f"{SystemPrompts.get_explainable_ai_audit_prompt()}\\n{SystemPrompts.get_hyperparameter_tuning_strategy_prompt()}\\n\\nTASK: {task_description}"

        # 7. Gallery / Curate
        if any(k in task_lower for k in ["gallery", "curate", "timeless"]):
             from admin.brain.system_prompts import SystemPrompts
             return f"{SystemPrompts.get_gallery_curator_prompt()}\\n\\nTASK: {task_description}"

        # 8. Engine / Signal
        if any(k in task_lower for k in ["engine", "rss", "signal"]):
             from admin.brain.system_prompts import SystemPrompts
             return f"{SystemPrompts.get_engine_diagnostic_prompt()}\\n{SystemPrompts.get_signal_noise_ratio_prompt()}\\n\\nTASK: {task_description}"

        # 9. Vibe / Governance
        if any(k in task_lower for k in ["vibe", "feel", "governance"]):
             from admin.brain.system_prompts import SystemPrompts
             return f"{SystemPrompts.get_vibe_check_prompt()}\\n{SystemPrompts.get_governance_enforcer_prompt()}\\n\\nTASK: {task_description}"

        # 10. Swarm / Management
        if any(k in task_lower for k in ["swarm", "manager", "coordinate"]):
             from admin.brain.system_prompts import SystemPrompts
             return f"{SystemPrompts.get_swarm_coordination_prompt()}\\n{SystemPrompts.get_task_delegation_prompt()}\\n\\nTASK: {task_description}"

        # 11. Review / Audit
        if any(k in task_lower for k in ["review", "performance", "audit"]):
             from admin.brain.system_prompts import SystemPrompts
             return f"{SystemPrompts.get_agent_performance_review_prompt()}\\n\\nTASK: {task_description}"

        # 12. Conflict / Resource
        if any(k in task_lower for k in ["conflict", "budget", "resource"]):
             from admin.brain.system_prompts import SystemPrompts
             return f"{SystemPrompts.get_conflict_resolution_prompt()}\\n{SystemPrompts.get_resource_allocation_prompt()}\\n\\nTASK: {task_description}"

        return task_description

# Singleton
_router = None

def get_command_router() -> CommandRouter:
    global _router
    if _router is None:
        _router = CommandRouter()
    return _router


async def route_and_log(user_input: str, session_id: str = None) -> Dict[str, Any]:
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
    result = await router.execute(routed)
    
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

