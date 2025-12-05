import os
import sys
from datetime import datetime
from moviepy import ColorClip
from tiktok_uploader.upload import upload_video

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def create_test_video(output_path):
    """Creates a simple 1-second black video."""
    print(f"Generating test video at {output_path}...")
    clip = ColorClip(size=(1080, 1920), color=(0, 0, 0), duration=1)
    clip.fps = 24
    clip.write_videofile(output_path, codec="libx264", audio=False, logger=None)
    print("Test video generated.")

def test_upload():
    cookies_path = os.path.join("admin", "cookies.txt")
    video_path = "test_tiktok_video.mp4"
    
    if not os.path.exists(cookies_path):
        print(f"ERROR: Cookies file not found at {cookies_path}")
        return
        
    try:
        # Create dummy video
        create_test_video(video_path)
        
        print("\nAttempting upload to TikTok...")
        print("NOTE: This will open a browser window. Do not touch it.")
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        description = f"System Test {timestamp} - Please Ignore #test"
        
        # Attempt upload
        # Note: headless=False is usually required for TikTok automation to pass bot checks
        upload_video(
            filename=video_path,
            description=description,
            cookies=cookies_path,
            browser='chrome',
            headless=False 
        )
        
        print("\n✅ SUCCESS: Video uploaded successfully!")
        print("Check your TikTok profile to verify.")
        
    except Exception as e:
        print(f"\n❌ FAILED: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        if os.path.exists(video_path):
            os.remove(video_path)

if __name__ == "__main__":
    test_upload()
