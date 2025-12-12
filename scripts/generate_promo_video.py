
import os
import sys
import logging
from pathlib import Path

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PromoGenerator")

def generate_promo():
    print("=== Generating Promo Video for 'Building with Antigravity' ===")
    
    # Import inside function to avoid import-time crashes if something is still broken
    try:
        from admin.engineers.tiktok_workflow import TikTokWorkflow
        from admin.engineers.broadcaster import Broadcaster
    except Exception as e:
        logger.error(f"Failed to import dependencies: {e}")
        return

    # Post content (extracted from building-with-antigravity.html or similar)
    post = {
        "title": "Building with Antigravity",
        "content": """
        We are building the future of AI coding interactions.
        Antigravity isn't just a name, it's a movement.
        We're creating a studio where ideas float freely into reality.
        Join us as we redefine what it means to build software.
        Coding is no longer about typing; it's about directing intelligence.
        Verify the system. Trust the process. Build the impossible.
        """,
        "url": "https://isaachernandez.com/building-with-antigravity"
    }

    # Initialize Workflow with CapCut engine
    workflow = TikTokWorkflow(template="educational", engine="capcut")
    
    # Optional: Patch script generation if Quota is still an issue, 
    # but let's try to see if it works naturally first or falls back.
    # If the user wants a specific script, we can inject it here.
    
    try:
        result = workflow.execute(post)
        print("\n=== Workflow Result ===")
        print(f"Status: {result.get('status')}")
        print(f"Draft ID: {result.get('draft_id', 'None')}")
        print(f"Success: {result.get('success')}")
        
        if result.get("status") == "paused_for_export":
            print("\nSUCCESS! Draft created in CapCut.")
            print("Action Required: Open CapCut, verify the draft, and Export it.")
            print(f"Save the file to: static/videos/{result.get('draft_id', 'promo')}.mp4")
            
    except Exception as e:
        logger.error(f"Workflow failed: {e}")

if __name__ == "__main__":
    generate_promo()
