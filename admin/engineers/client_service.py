import os
import google.generativeai as genai
from typing import Dict, Any, Generator

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
        
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self._model = genai.GenerativeModel(
                'gemini-2.0-flash',
                system_instruction=self._get_system_params()
            )
        else:
            print("WARNING: GEMINI_API_KEY not found. ClientService will be limited.")
            self._model = None

    def _get_system_params(self) -> str:
        services_text = "\n".join([f"- {k.replace('_', ' ').title()}: Starting at ${v['base_price']}/{v['unit']}" for k, v in self.services.items()])
        
        return f"""You are the Advanced AI Assistant for a high-end creative studio.
        
        Core Directives:
        1. **Professional & Charming**: Be polite, witty, and helpful.
        2. **Sales Oriented**: Gently guide clients to booking a consultation.
        3. **Context Aware**: Remember conversation details.
        4. **Expert Knowledge**:
        {services_text}
        
        Pricing: Give starting prices. Custom quotes need consultation.
        Unknowns: Suggest scheduling a call.
        """

    async def stream_chat(self, message: str) -> Generator[str, None, None]:
        if not self._model:
            yield "I apologize, but I'm currently unable to connect to my AI brain. Please contact the studio directly."
            return

        try:
            # Initialize chat session if it doesn't exist
            if not self.chat_session:
                self.chat_session = self._model.start_chat(history=[])
            
            # Send message and stream response
            response = await self.chat_session.send_message_async(message, stream=True)
            
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            print(f"Error in stream_chat: {e}")
            yield f"I encountered a slight neural glitch ({str(e)}). Let me try that again... actually, maybe getting a human involves is best?"

    def get_services(self) -> Dict[str, Any]:
        return {
            "video_editing": {"base_price": 500, "unit": "video"},
            "motion_graphics": {"base_price": 800, "unit": "minute"},
            "web_design": {"base_price": 2000, "unit": "project"},
            "consulting": {"base_price": 300, "unit": "hour"},
            "brand_identity": {"base_price": 1500, "unit": "package"}
        }
