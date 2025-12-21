import logging
import os
import sys
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.brain.memory_store import get_memory_store

logger = logging.getLogger("MasterEditor")

from core.agent_interface import BaseAgent
from typing import Dict, List, Any

logger = logging.getLogger("MasterEditor")

class Editor(BaseAgent):
    """
    The Master Editor (Writer).
    Transforms intake and deep reasoning into publication-ready essays.
    """
    def __init__(self):
        self.memory = get_memory_store()
        self.drafts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "brain", "drafts")
        os.makedirs(self.drafts_dir, exist_ok=True)
        self.model_name = "gemini-2.0-flash"
        
        # Initialize the Refiner Specialist
        from admin.engineers.refiner import Refiner
        self.refiner = Refiner()

    @property
    def name(self) -> str:
        return "The Editor"
    
    # ... (skipping unchanged parts) ...

    async def audit(self, content: str) -> List[Dict]:
        """
        Audits content using the Refiner specialist.
        """
        result = await self.refiner.audit(content, criteria="""
        "Be honest, clear, and kind. Avoid cliches. Use lyrical flow."
        Identify style issues, run-on sentences, or sections that feel "AI-generated" or impersonal.
        """)
        
        return result.get("suggestions", [])

    # ... (skipping unchanged parts) ...

    async def _polish(self, draft: str) -> str:
        """delegates polishing to the Refiner."""
        instructions = """
        Polish this draft for flow, clarity, and impact.
        - Fix weak verbs.
        - Shorten run-on sentences.
        - Ensure "Technician" precision mixed with "Philosopher" depth.
        - Add a final "Why This Matters" callout if missing.
        """
        
        # We need to bridge the sync/async gap here since write_essay is sync in this version
        # But Refiner is async. For now, we will wrap it or keep it simple.
        # Ideally, we should make write_essay async.
        import asyncio
        result = asyncio.run(self.refiner.refine(draft, instructions))
        return result.get("refined_text", draft)




    @property
    def role(self) -> str:
        return "Master Editor"

    async def execute(self, action: str, **params) -> Dict:
        if action == "process_pending":
            return await self.process_pending_intake()
        elif action == "write_essay":
            topic = params.get("topic")
            source = params.get("source")
            self.write_essay(topic, source)
            return {"status": "success"}
        else:
             raise NotImplementedError(f"Action {action} not supported by Editor.")

    async def process_pending_intake(self):
        """
        Subscription-based reaction to new work. Normalizes and summarizes.
        """
        from admin.brain.intake import get_intake_manager
        intake = get_intake_manager()
        
        pending = intake.get_subscriptions("editor")
        if not pending:
            return {"message": "No pending intake for the Editor."}
            
        results = []
        for work in pending:
            try:
                res = await self._summarize_intake(work)
                intake.update_subscription_status(work['sub_id'], "completed", res)
                results.append(res)
            except Exception as e:
                logger.error(f"Editor failed to process intake {work['id']}: {e}")
                intake.update_subscription_status(work['sub_id'], "failed", {"error": str(e)})
                
        return {"processed": len(results), "details": results}

    async def _summarize_intake(self, work: Dict):
        """Generates a brief/summary of the intake."""
        content = work.get('content', '')
        prompt = f"Summarize this work and extract key themes for the Studio OS. Content:\n\n{content}"
        
        summary = self._call_llm("You are the Master Editor. Be concise and professional.", prompt)
        
        # Save as a draft brief
        safe_title = "".join([c if c.isalnum() else "_" for c in (work.get('source_path') or f"intake_{work['id']}")])[:50]
        filename = f"BRIEF_{safe_title}.md"
        path = os.path.join(self.drafts_dir, filename)
        
        with open(path, 'w') as f:
            f.write(f"# Summary of {work['source_type']}\n\n{summary}")
            
        return {"id": work['id'], "summary_saved": filename}
        
    def run_check(self):
        """Checks for new DEEP REASONING insights and writes essays."""
        # 1. Look for High-Confidence Council Insights
        insights = self.memory.get_insights("deep_reasoning", min_confidence=0.9)
        if not insights:
            logger.info("No deep reasoning insights found to editing.")
            return

        latest_insight = insights[0]
        topic = latest_insight['data'].get('topic')
        council_output = latest_insight['data'].get('council_output')
        
        # Deduplication
        safe_topic = "".join([c if c.isalnum() else "_" for c in topic])[:50]
        expected_filename = f"ESSAY_{safe_topic}.md"
        if os.path.exists(os.path.join(self.drafts_dir, expected_filename)):
            logger.info(f"Essay already exists for {topic}")
            return
            
        logger.info(f"✍️ The Master Editor is writing: {topic}")
        self.write_essay(topic, council_output)



    async def execute_llm(self, prompt: str, system_instruction: str = "") -> Any:
        # Helper to use the model configured in __init__
        import google.generativeai as genai
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key: return None
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(self.model_name, system_instruction=system_instruction)
        return await model.generate_content_async(prompt)

    def write_essay(self, topic: str, source_material: str):
        """Executes the 3-step writing loop."""
        
        # Step 1: Outline
        outline = self._outline(topic, source_material)
        if "Error" in outline or "Quota exceeded" in outline:
            logger.error("Outline generation failed due to API limits.")
            return
        logger.info("   ↳ Outline created.")
        
        # Step 2: Draft
        first_draft = self._draft(topic, outline, source_material)
        if "Error" in first_draft or "Quota exceeded" in first_draft:
             logger.error("Draft generation failed due to API limits.")
             return
        logger.info("   ↳ First draft written.")
        
        # Step 3: Polish
        final_piece = self._polish(first_draft)
        if "Error" in final_piece or "Quota exceeded" in final_piece:
             logger.error("Polish generation failed due to API limits.")
             return
        logger.info("   ↳ Final polish complete.")
        
        # Save
        safe_topic = "".join([c if c.isalnum() else "_" for c in topic])[:50]
        filename = f"ESSAY_{safe_topic}.md"
        path = os.path.join(self.drafts_dir, filename)
        
        with open(path, 'w') as f:
            f.write(final_piece)
            
        logger.info(f"✅ Published to: {path}")

    def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """Direct call to Gemini Flash (Async wrapped)."""
        import google.generativeai as genai
        import asyncio
        
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            return "Error: No Gemini API Key found."
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash', system_instruction=system_prompt)
        
        async def run_async():
            resp = await model.generate_content_async(user_prompt)
            return resp.text
            
        try:
            return asyncio.run(run_async())
        except Exception as e:
            logger.error(f"Inference Failed: {e}")
            return f"[Generation Error: {e}]"

    def _outline(self, topic: str, context: str) -> str:
        sys_prompt = """You are THE OUTLINER.
        Create a logical, compelling structure for an essay based on the provided deep analysis.
        
        Structure:
        - Catchy H1 Title
        - The Hook (Introduction)
        - 3-4 Clear Sections (H2) with bullet points of what to cover
        - The Conclusion (Actionable or Philosophical)
        
        Output ONLY the outline."""
        return self._call_llm(sys_prompt, f"Topic: {topic}\n\nAnalysis:\n{context}")

    def _draft(self, topic: str, outline: str, context: str) -> str:
        sys_prompt = """You are THE DRAFTER.
        Write the full essay following the Outline.
        Use the deep analysis provided to ensure substance.
        
        Tone: Intellectual, slightly contrarian, tech-optimist but grounded.
        Format: Markdown.
        
        Do not output preamble, just the content."""
        return self._call_llm(sys_prompt, f"Topic: {topic}\n\nOutline:\n{outline}\n\nDeep Context:\n{context}")



if __name__ == "__main__":
    # Test Mode
    logging.basicConfig(level=logging.INFO)
    editor = Editor()
    
    # Mock Insight for testing
    print("Testing Master Editor...")
    try:
        editor.write_essay(
            "The Death of Coding", 
            "Context: AI is writing better code. The Architect argues we become Product Managers. The Skeptic argues we lose understanding of how things work. Synthesis: We must become Systems Architects."
        )
    except Exception as e:
        print(f"Test failed: {e}")