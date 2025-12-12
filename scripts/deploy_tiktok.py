
import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

logging.basicConfig(level=logging.INFO)
from admin.engineers.broadcaster import Broadcaster

def main():
    print("🚀 Deploying to TikTok...")
    
    broadcaster = Broadcaster()
    
    # Path to the generated video
    # We assume it was just generated
    video_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../static/videos/the-self-evolving-studio.mp4"))
    
    if not os.path.exists(video_path):
        print(f"❌ Video not found at {video_path}")
        return
        
    print(f"📤 Uploading: {video_path}")
    
    # Attempt upload with VERIFICATION
    # Note: This requires cookies.txt in the project root
    cookies_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../cookies.txt"))
    
    if not os.path.exists(cookies_path):
        print("\n❌ CRITICAL: 'cookies.txt' not found!")
        print("To fix this:")
        print("1. Install 'Get cookies.txt LOCALLY' Chrome extension")
        print("2. Login to TikTok.com")
        print("3. Export cookies and save as 'cookies.txt' in the project root")
        print(f"   Expected path: {cookies_path}\n")
        return

    print("⏳ Starting upload sequence (this may take a minute)...")
    success = broadcaster.upload_to_tiktok(
        video_path, 
        description="The Studio OS just evolved. 🎬 #coding #ai #tech #devlog"
    )
    
    # The new uploader wrapper handles verification internally by waiting
    # But let's be double sure by checking file existence
    if success:
        print("✅ Upload reported success.")
        if not os.path.exists(video_path):
             print("🗑️ File successfully deleted (Proof of cleanup).")
        else:
             print("⚠️ File still exists. Deletion/Cleanup might have failed.")
    else:
        print("❌ Upload failed. Please check screenshots/logs.")

if __name__ == "__main__":
    main()
