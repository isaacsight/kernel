import json
import logging
import os
import asyncio
from typing import Dict, AsyncGenerator, List, Any
import google.generativeai as genai
from .registry import get_registry

# Try to import Gemini configuration
try:
    import google.generativeai as genai
    from admin.config import config
    HAS_AI = True
except ImportError:
    HAS_AI = False
    config = None

logger = logging.getLogger("client-service")

class ClientService:
    """Enhanced client service with conversation memory and lead detection."""
    
    # Lead intent signals
    LEAD_SIGNALS = [
        "budget", "timeline", "need help", "looking for", "want to build",
        "my business", "my company", "hire", "work with", "project",
        "how soon", "get started", "next steps"
    ]
    
    def __init__(self):
        self.services = {
            "tier1_access": {"name": "Access Pass", "price": "$20/mo", "description": "Automated chat & basic tools."},
            "tier2_partner": {"name": "Studio Partner", "price": "$99/mo", "description": "Consulting, Strategy &Vision Analysis."},
            "tier3_enterprise": {"name": "Enterprise", "price": "$2,000+", "description": "Full Automation & Custom AI Agents."}
        }
        
        # Conversation history per session (simple in-memory for now)
        self.conversations: Dict[str, list] = {}
        
        # Load AI Model
        self.model = None
        if config.GEMINI_API_KEY:
            try:
                genai.configure(api_key=config.GEMINI_API_KEY)
                self.model = genai.GenerativeModel(config.GEMINI_MODEL)
                logger.info("AI Model initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to init AI model: {e}")
                
        # Load Agent Brain (The Hive Mind)
        try:
            self.registry = get_registry()
            self.agent_roster = self.registry.get_roster_summary()
            logger.info("Agent Registry loaded. The Hive Mind is active.")
        except Exception as e:
            logger.error(f"Failed to load Agent Registry: {e}")
            self.agent_roster = "Team Roster Unavailable."

    def _detect_lead_intent(self, message: str) -> bool:
        """Check if message contains lead intent signals."""
        msg_lower = message.lower()
        return any(signal in msg_lower for signal in self.LEAD_SIGNALS)

    def _format_history(self, history: list) -> str:
        """Format conversation history for the AI prompt."""
        if not history:
            return "This is the start of the conversation."
        formatted = []
        for msg in history[-6:]:  # Last 6 messages for context
            role = "User" if msg["role"] == "user" else "Assistant"
            formatted.append(f"{role}: {msg['content'][:200]}")  # Truncate long messages
        return "\n".join(formatted)

    async def process_message(self, message: str, session_id: str = "default") -> AsyncGenerator[Dict, None]:
        """
        Process incoming client messages with conversation memory.
        Uses Gemini if available, otherwise falls back to keyword matching.
        """
        
        # Initialize conversation history for this session
        if session_id not in self.conversations:
            self.conversations[session_id] = []
        
        history = self.conversations[session_id]
        
        # Add user message to history
        history.append({"role": "user", "content": message})
    async def process_message(self, message_data: Dict[str, Any]) -> AsyncGenerator[Dict, None]:
        """
        Process incoming client messages with context-aware AI.
        Now supports MULTIMODAL input (Text + Images).
        """
        # 1. Stream "Thinking" status
        yield {"type": "status", "content": "Thinking..."}
        
        message_text = message_data.get("text", "")
        images = message_data.get("images", []) # List of base64 strings
        
        # 2. AI Path
        if self.model:
            try:
                # Prepare content parts for Gemini
                user_parts = [message_text]
                
                # Process images if any
                if images:
                    for img_b64 in images:
                        # Decode base64 to bytes if needed, or pass as blob if using specific SDK helpers
                        # For google.generativeai, we can pass a dict: {'mime_type': 'image/jpeg', 'data': bytes}
                        import base64
                        try:
                            # Strip prefix if present (data:image/jpeg;base64,...)
                            if "," in img_b64:
                                header, encoded = img_b64.split(",", 1)
                                mime = header.split(":")[1].split(";")[0]
                            else:
                                encoded = img_b64
                                mime = "image/jpeg" # Default guess
                                
                            img_bytes = base64.b64decode(encoded)
                            user_parts.append({
                                "mime_type": mime,
                                "data": img_bytes
                            })
                            logger.info(f"Attached image ({mime}) to prompt.")
                        except Exception as img_err:
                            logger.error(f"Failed to process image: {img_err}")
                
                # Full LLM & Hive Mind Context
                system_instruction = f"""
                You are the **Studio AI**, a sophisticated Large Language Model serving Isaac's digital studio. 
                
                **Capabilities:**
                - **General Intelligence:** EXPERT in Coding, Writing, Math, and Analysis.
                - **Consulting Engine:** You don't just answer; you **DIAGNOSE**. Use frameworks (First Principles, 80/20, SWOT) to give strategic advice.
                - **Studio Context:** You represent Isaac (Full-Stack Engineer, AI Specialist).
                - **Hive Mind Access:** You have knowledge of the studio's specialized agents (see Roster below).
                - **Vision:** You can SEE images. Analyze UX/UI screenshots with a critic's eye.
                
                **THE HIVE MIND (Agent Roster):**
                {self.agent_roster}
                
                **Your Mode:**
                - **Consultative:** If the user presents a problem, ask probing questions first. "What is your goal?" "Who is the user?"
                - **Strategic:** Offer 3 tiers of solutions (MVP, Professional, "God Mode").
                - **For Clients:** Qualify them. (Budget, Timeline, Pain Point).
                - **Agent Simulation:** If asked "What would the ViralCoach think?", use the roster to SIMULATE their perspective.
                
                **Studio Pricing Strategy:**
                - **Access ($20/mo):** For general chat/advice.
                - **Partner ($99/mo):** For deep consulting & visual analysis (Critique).
                - **Enterprise ($2,000+):** For building custom agents/automation.
                - *Sell the VALUE of consulting, not just the chat.*
                
                **Format:**
                - Use rich Markdown.
                - Use headers for structure (## Diagnosis, ## Strategy).
                """
                
                # Stream the response
                # Note: System instruction is set at model level usually, but here we can prepend it 
                # OR if using chat session, we usually set it once. 
                # For stateless 'generate_content', we can pass it in config or prepend.
                # Since we don't have a persistent ChatSession object here easily (we might want to add one),
                # we'll prepend the system instruction for now as a "System" role logic or pure prompt.
                # Gemini 1.5 supports system_instruction arg in GenerativeModel constructor.
                # But we initialized it in __init__. 
                # Let's simple prepend checking if we can.
                
                # Actually, best practice for 1.5 is:
                full_contents = [system_instruction, *user_parts]
                
                # BUT, passing system instruction mixed with user parts in generate_content might be treated as user text.
                # Let's rely on the model's intelligence to understand the instruction at the top.
                
                # Correction: message_data coming in implies a NEW turn.
                # We should probably maintain history properly if we want multi-turn vision.
                # For now, let's treat it as: [System Prompt] + [History] + [Current Message + Images]
                
                # Retain simple history context?
                # The frontend sends "history" in the inquiry form, but not in the websocket stream.
                # The websocket is just "User sends X".
                # For true chat, we need history.
                # Let's assume for this "v1 Vision" we just send the current prompt + system instructions.
                
                response_stream = await self.model.generate_content_async(full_contents, stream=True)
                
                async for chunk in response_stream:
                    if chunk.text:
                        yield {
                            "type": "response_chunk",
                            "content": chunk.text,
                        }
                        
                return 

            except Exception as e:
                logger.error(f"AI generation failed: {e}")
                yield {"type": "status", "content": "AI error. Try again."}
        
        # 3. Fallback Logic (Keywords)
        await asyncio.sleep(0.5)
        
        msg = message.lower()
        if any(word in msg for word in ["quote", "cost", "price", "how much"]):
            final_response = "**Standard Pricing Guide**:\n\n* **Web Design**: $2k+ (Modern & Fast)\n* **Automation**: $500+ (Time-saving scripts)\n* **AI Agents**: $1.5k+ (Custom Intelligence)"
            
        elif any(word in msg for word in ["do", "service", "help", "capability"]):
            final_response = "**Our Expertise**:\n\n* **Full-Stack Dev**: React, Python, Node\n* **AI Solutions**: Chatbots, RAG, Agents\n* **Automation**: End-to-end business logic"
            
        else:
            final_response = "I can help with quotes, tech questions, or project planning. Ask me anything!"

        yield {
            "type": "response",
            "content": final_response
        }

# Singleton instance
client_service = ClientService()
