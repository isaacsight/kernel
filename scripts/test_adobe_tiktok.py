
import os
import sys
import logging
import time

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.video_editor import VideoEditor
from admin.engineers.graphic_designer import GraphicDesigner

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AdobeTest")

def run_test():
    print("=== Adobe Ecosystem Automation Test (Premiere & Photoshop) ===")
    
    # 1. Test Video Editor (Premiere Pro)
    print("\n[1/2] Testing Video Editor (Premiere Pro)...")
    try:
        editor = VideoEditor()
        if editor.app_path:
            print(f"✅ Premiere Pro found at: {editor.app_path}")
            
            # Create a dummy video file for testing import if needed, or just test sequence creation
            # We'll just ask it to create a sequence from nothing (it handles empty lists gracefully usually 
            # or we create a text file mimicking a clip)
            
            print(f"   Generating Sequence script...")
            # We pass an empty list of clips, the prompt handles the logic
            success = editor.assemble_clips(
                file_paths=[], 
                sequence_name="TikTok_Test_Sequence"
            )
            
            if success:
                print("   ✅ Script executed successfully (check Premiere Pro).")
            else:
                print("   ❌ Script execution failed.")
        else:
            print("   ⚠️ Premiere Pro application not found. Skipping automation test.")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # 2. Test Graphic Designer (Photoshop)
    print("\n[2/2] Testing Graphic Designer (Photoshop)...")
    try:
        graphic = GraphicDesigner()
        if graphic.app_path:
            print(f"✅ Photoshop found at: {graphic.app_path}")
            
            thumb_path = os.path.abspath("tiktok_cover.jpg")
            print(f"   Generating Thumbnail script for: '{thumb_path}'...")
            
            success = graphic.create_thumbnail(
                title="AI AGENTS\nTAKEOVER",
                background_path=None, 
                output_path=thumb_path
            )
            
            if success:
                print("   ✅ Script executed successfully (check Photoshop).")
            else:
                print("   ❌ Script execution failed.")
        else:
            print("   ⚠️ Photoshop application not found. Skipping automation test.")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print("\n=== Test Complete ===")
    print("Note: Automation scripts run asynchronously. Check your open Adobe apps.")

if __name__ == "__main__":
    run_test()
