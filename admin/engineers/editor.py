import logging
import os
import sys
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.brain.memory_store import get_memory_store

logger = logging.getLogger("MasterEditor")

class Editor:
    """
    The Master Editor (Writer).
    Transforms Deep Reasoning insights into publication-ready essays.
    
    Process:
    1. Outliner: Structure the argument.
    2. Drafter: Write the content.
    3. Polisher: Refine voice and flow.
    """
    def __init__(self):
        self.memory = get_memory_store()
        self.drafts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "brain", "drafts")
        os.makedirs(self.drafts_dir, exist_ok=True)
        self.model = "gemini-2.0-flash"
        
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
        """Direct call to Gemini Flash."""
        import google.generativeai as genai
        
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            return "Error: No Gemini API Key found."
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash', system_instruction=system_prompt)
        
        try:
            response = model.generate_content(user_prompt)
            return response.text
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

    def _polish(self, draft: str) -> str:
        sys_prompt = """You are THE EDITOR.
        Polish this draft for flow, clarity, and impact.
        
        - Fix weak verbs.
        - Shorten run-on sentences.
        - Ensure "Technician" precision mixed with "Philosopher" depth.
        - Add a final "Why This Matters" callout if missing.
        
        Return the final Markdown."""
        return self._call_llm(sys_prompt, f"Draft:\n{draft}")

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