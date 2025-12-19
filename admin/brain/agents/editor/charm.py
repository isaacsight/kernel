"""
Editor Charm
Role: Editor-in-Chief
Capabilities: Outlining, Drafting, Polishing essays.
"""
import os
import logging
import google.generativeai as genai
from typing import Dict, Any
from admin.brain.charm import Charm
from admin.config import config

logger = logging.getLogger("EditorCharm")

class EditorCharm(Charm):
    def on_install(self):
        super().on_install()
        # Setup Drafts directory
        self.drafts_dir = os.path.join(config.BRAIN_DIR, "drafts")
        os.makedirs(self.drafts_dir, exist_ok=True)
        
        # Configure Model
        if config.GEMINI_API_KEY:
            genai.configure(api_key=config.GEMINI_API_KEY)
            self.model = genai.GenerativeModel("gemini-2.0-flash")
        
        self.set_status("active", "Ready to Write")

    def _action_write(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Action: write
        Params: topic (str), context (str)
        """
        topic = params.get("topic")
        context = params.get("context", "")
        
        if not topic:
            return {"success": False, "error": "Topic is required"}
            
        self.set_status("active", f"Writing: {topic}")
        
        try:
            # 1. Outline
            self.set_status("active", "Outlining...")
            outline = self._generate_step("OUTLINER", f"Topic: {topic}\nContext: {context}", "Create a logical outline.")
            
            # 2. Draft
            self.set_status("active", "Drafting...")
            draft = self._generate_step("DRAFTER", f"Topic: {topic}\nOutline: {outline}", "Write the full essay.")
            
            # 3. Polish
            self.set_status("active", "Polishing...")
            final = self._generate_step("EDITOR", f"Draft: {draft}", "Polish for clarity and flow.")
            
            # Save
            filename = f"Essay_{topic.replace(' ', '_')[:30]}.md"
            filepath = os.path.join(self.drafts_dir, filename)
            with open(filepath, 'w') as f:
                f.write(final)
                
            self.set_status("active", "Idle")
            return {"success": True, "filepath": filepath, "content": final}
            
        except Exception as e:
            self.set_status("blocked", f"Writing failed: {e}")
            return {"success": False, "error": str(e)}

    def _generate_step(self, role: str, content: str, instruction: str) -> str:
        prompt = f"""
        You are THE {role}.
        Instruction: {instruction}
        
        Input:
        {content}
        """
        resp = self.model.generate_content(prompt)
        return resp.text
