
import logging
import sys
import os

# Setup paths
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from admin.engineers.broadcaster import Broadcaster
from admin.engineers.video_engine import VideoEngine

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(name)s - %(levelname)s - %(message)s')

def test_pipeline():
    print("=== Testing Hybrid Video Engine Pipeline ===")
    
    # Mock Post
    mock_post = {
        "title": "The Future of Coding",
        "slug": "future-coding-test",
        "content": """
        Imagine a world where code writes itself.
        Suddenly, the error is gone.
        Digital dreams become reality.
        Focus on the logic, not the syntax.
        """
    }
    
    broadcaster = Broadcaster()
    
    # We need to mock generate_voiceover if no API key is present
    # Or rely on VoiceActor failing gracefully (it might return None)
    # If it fails, Broadcaster aborts.
    # Let's see if we can force a dummy audio path
    
    print("Running generate_video...")
    video_path = broadcaster.generate_video(mock_post, vibe="tech")
    
    if video_path and os.path.exists(video_path):
        print(f"SUCCESS: Video generated at {video_path}")
    else:
        print("FAILURE: Video generation returned None")

if __name__ == "__main__":
    test_pipeline()
