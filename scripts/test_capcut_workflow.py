import sys
import os
import logging
from datetime import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))


print("STARTING TEST SCRIPT...")

def test_workflow():
    print("=== Testing TikTok Workflow (CapCut Engine) ===")
    from admin.engineers.tiktok_workflow import TikTokWorkflow
    
    # Dummy Post
    post = {
        "title": "The Future of AI Coding",
        "slug": "future-of-ai-coding",
        "content": """
        AI is changing how we write code. It's not just about autocompletion anymore.
        Agents like Devin and Gemini are becoming true pair programmers.
        
        We need to adapt our workflows to collaborate with these new intelligences.
        The future is hybrid: Human creativity + Machine precision.
        """,
        "tags": ["ai", "coding", "future"]
    }
    
    # Initialize Workflow with CapCut engine
    workflow = TikTokWorkflow(template="educational", engine="capcut")
    
    # PATCH: Bypass ViralCoach/AI generation to avoid Quota Errors
    def mock_step_write_script(data):
        print(" [MOCK] Bypassing AI Script Generation...")
        return "This is a test script for CapCut integration. We are verifying the pipeline without hitting API limits."
    
    workflow._step_write_script = mock_step_write_script
    
    # Also patch Broadcaster.generate_script just in case
    def mock_generate_script(self, post, vibe):
        return "This is a test script for CapCut integration."
        
    # We need to access the broadcaster instance inside the workflow, 
    # but it's instantiated inside _step_generate.
    # So we patch the class method Broadcaster.generate_script
    from admin.engineers.broadcaster import Broadcaster
    Broadcaster.generate_script = mock_generate_script
    
    try:
        result = workflow.execute(post)
        print("\n=== Workflow Result ===")
        print(f"Status: {result.get('status', 'completed')}")
        print(f"Draft ID: {result.get('draft_id')}")
        print(f"Success: {result.get('success')}")
        
    except Exception as e:
        print(f"Wrapper Execution Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_workflow()
