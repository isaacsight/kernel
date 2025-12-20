import os
import json
import google.generativeai as genai
from typing import Dict, Any, Generator
from admin.config import config

class ClientService:
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ClientService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.services = self.get_services()
        self.chat_session = None
        self.services_text = "\n".join([f"- {k.replace('_', ' ').title()}: Starting at ${v['base_price']}/{v['unit']}" for k, v in self.services.items()])
        if self.api_key:
            genai.configure(api_key=self.api_key)
            
            # Define OS Control Tools
            tools = [
                self.execute_command,
                self.generate_content_action,
                self.perform_research,
                self.get_system_telemetry,
                self.publish_site_action
            ]
            
            self._model = genai.GenerativeModel(
                'gemini-2.0-flash',
                system_instruction=self._get_system_params(),
                tools=tools
            )
        else:
            print("WARNING: GEMINI_API_KEY not found. ClientService will be limited.")
            self._model = None

    def _get_system_params(self) -> str:
        return f"""You are the Advanced AI System Operator for Studio OS.
        
        Primary Role: **System Controller**
        You manage the entire OS from this conversation. You don't just talk; you EXECUTE.
        
        Core Directives:
        1. **Precision & Power**: Use your tools to control the system.
        2. **Socratic Reasoning**: Always 'Think' before taking high-impact OS actions.
        3. **Contrarian Guard**: Critique your own plans to avoid system instability.
        4. **Lab Optimized**: Your behavior adapts to variables like CONTROL_PRECISION ({config.CONTROL_PRECISION}).
        
        Capabilities:
        {self.services_text}
        
        Operational Protocol:
        - If a user asks to "do X", "fix Y", or "run Z", use your tools.
        - If a user asks to create/generate a post/article, use `generate_content_action`. This SAVES the draft automatically.
        - If a user asks to "publish" or "push" the site, use `publish_site_action`.
        - Surface reasoning in 'thought' blocks.
        - Confirm executions clearly.
        """

    # --- Tool Definitions ---
    
    async def execute_command(self, command: str) -> str:
        """Executes a shell command on the host OS. Use with caution."""
        if not config.ALLOW_OS_COMMANDS:
            return "Error: OS Commands are currently disabled by Mission Control."
        from admin.engineers.operator import Operator
        op = Operator()
        result = await op.execute("run_command", command=command)
        return json.dumps(result)

    async def generate_content_action(self, topic: str) -> str:
        """Generates and SAVES a high-quality blog post draft to the site."""
        from admin.core import generate_ai_post
        try:
            filename = await generate_ai_post(topic)
            return f"Draft saved successfully as: {filename}. You should ask the user if they want to publish it now."
        except Exception as e:
            return f"Error during generation: {str(e)}"

    async def publish_site_action(self) -> str:
        """Publishes all current drafts and changes to the live site (Git and TikTok)."""
        from admin.core import publish_git
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, publish_git)
            return f"Publish result: {result}"
        except Exception as e:
            return f"Publish failed: {str(e)}"

    async def perform_research(self, query: str) -> str:
        """Searches the web and internal knowledge for trends and data."""
        from admin.engineers.command_router import get_command_router
        router = get_command_router()
        result = await router.execute({"success": True, "intent": "action", "action": "research", "parameters": {"query": query}})
        return json.dumps(result)

    async def get_system_telemetry(self) -> str:
        """Returns deep telemetry and health metrics for the Studio OS."""
        from admin.engineers.operator import Operator
        op = Operator()
        result = await op.execute("system_telemetry")
        return json.dumps(result)

    async def stream_chat(self, message: str) -> Generator[Dict[str, str], None, None]:
        if not self._model:
            yield {"type": "text", "content": "I apologize, but I'm currently unable to connect to my AI brain. Please contact the studio directly."}
            return

        try:
            # Initialize chat session if it doesn't exist
            if not self.chat_session:
                # Manual function calling to support stream=True
                self.chat_session = self._model.start_chat(history=[])
            
            # Prune history if it grows too long (latency optimization variable)
            history_limit = getattr(config, 'CHAT_HISTORY_LIMIT', 20)
            if len(self.chat_session.history) > history_limit:
                self.chat_session.history = self.chat_session.history[-history_limit:]
            
            # Send message and stream response (Streaming variable check)
            print(f"DEBUG: Starting stream_chat for: {message[:30]}...")
            
            # Use Automatic Function Calling for seamless OS control
            # But we want to preserve 'thought' streaming
            # So we use a manual loop to capture results
            
            # Manual Tool Loop to support streaming + thoughts
            current_message = message
            while True:
                response = await self.chat_session.send_message_async(current_message, stream=True)
                
                tool_calls = []
                async for chunk in response:
                    # Handle Tool Calls for UI Feedback
                    try:
                        if chunk.candidates[0].content.parts:
                            for part in chunk.candidates[0].content.parts:
                                if part.function_call:
                                    print(f"DEBUG: Tool Call detected: {part.function_call.name}")
                                    tool_calls.append(part.function_call)
                                    # Yield a special 'action' chunk for UI feedback
                                    yield {"type": "thought", "content": f"\n[System Action: Executing {part.function_call.name}...]\n"}
                    except (IndexError, AttributeError):
                        pass
                    
                    # Extract thought if available (Gemini 2.0 Flash)
                    try:
                        # Check for thought field in the proto
                        if hasattr(chunk, 'thought') and chunk.thought:
                            print(f"DEBUG: Yielding thought chunk")
                            yield {"type": "thought", "content": chunk.thought}
                    except (ValueError, AttributeError):
                        pass
                    
                    # Standard text response - EXTREMELY safe access
                    try:
                        # Check if the chunk has text without triggering ValueError
                        has_text = any(hasattr(p, 'text') and p.text for p in chunk.candidates[0].content.parts)
                        if has_text:
                            text = chunk.text
                            if text:
                                print(f"DEBUG: Yielding text chunk: {text[:20]}...")
                                yield {"type": "text", "content": text}
                    except (ValueError, AttributeError, IndexError):
                        pass

                if not tool_calls:
                    break

                # Execute all tool calls collected in this turn
                tool_responses = []
                for fc in tool_calls:
                    tool_result = await self._dispatch_tool(fc)
                    # Create FunctionResponse part
                    # We use the lower level proto to be safe with name/result
                    from google.ai.generativelanguage_v1beta.types import Part, FunctionResponse
                    
                    # Ensure tool_result is a dict or string that can be in the response
                    if not isinstance(tool_result, (dict, list, str, int, float, bool)):
                        tool_result = str(tool_result)
                    
                    if isinstance(tool_result, str):
                        tool_result = {"result": tool_result}

                    res_part = genai.protos.Part(
                        function_response=genai.protos.FunctionResponse(
                            name=fc.name,
                            response=tool_result
                        )
                    )
                    tool_responses.append(res_part)
                
                # Continue the conversation with the tool results
                current_message = tool_responses

            print("DEBUG: Finished stream_chat")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error in stream_chat: {e}")
            yield {"type": "text", "content": f"I encountered a slight neural glitch ({str(e)}). Let me try that again... actually, maybe getting a human involves is best?"}

    async def _dispatch_tool(self, fc) -> Any:
        # Dispatch to the appropriate tool method
        method = getattr(self, fc.name, None)
        if not method:
            return f"Error: Tool {fc.name} not found."
        
        try:
            # Handle tool arguments
            kwargs = dict(fc.args)
            print(f"DEBUG: Dispatching to {fc.name} with {kwargs}")
            
            # Check if it's an async method
            import inspect
            if inspect.iscoroutinefunction(method):
                return await method(**kwargs)
            else:
                return method(**kwargs)
        except Exception as e:
            return f"Error executing {fc.name}: {str(e)}"

    def get_services(self) -> Dict[str, Any]:
        return {
            "video_editing": {"base_price": 500, "unit": "video"},
            "motion_graphics": {"base_price": 800, "unit": "minute"},
            "web_design": {"base_price": 2000, "unit": "project"},
            "consulting": {"base_price": 300, "unit": "hour"},
            "brand_identity": {"base_price": 1500, "unit": "package"}
        }
