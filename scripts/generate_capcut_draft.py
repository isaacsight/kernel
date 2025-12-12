import sys
import os
import logging
import frontmatter
import requests
import time
import subprocess
import shutil

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CapCutDraftGenerator")

from admin.engineers.broadcaster import Broadcaster
from admin.config import config

CAPCUT_API_URL = "http://localhost:9001"
CAPCUT_API_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../tools/CapCutAPI'))

def ensure_server_running():
    """Checks if CapCutAPI server is running, starts it if not."""
    try:
        requests.get(f"{CAPCUT_API_URL}/health", timeout=2)
        logger.info("✅ CapCutAPI server is already running.")
        return True
    except:
        logger.info("🚀 Starting CapCutAPI server...")
        # Start in background
        cmd = f"source venv-capcut/bin/activate && python capcut_server.py"
        subprocess.Popen(
            cmd, 
            cwd=CAPCUT_API_DIR, 
            shell=True, 
            stdout=subprocess.DEVNULL, 
            stderr=subprocess.DEVNULL,
            executable='/bin/bash'
        )
        # Wait for startup
        for _ in range(10):
            time.sleep(1)
            try:
                # server might not have /health, just check /
                requests.get(CAPCUT_API_URL, timeout=1)
                logger.info("✅ CapCutAPI server started.")
                return True
            except:
                pass
        
        logger.error("❌ Failed to start CapCutAPI server.")
        return False

def generate_draft():
    print("🎬 Starting CapCut Draft Generation...")
    
    # 1. Content & Assets
    post_path = os.path.join(config.CONTENT_DIR, "devlog-self-evolving-studio.md")
    if not os.path.exists(post_path):
        logger.error(f"Post not found at {post_path}")
        return

    post = frontmatter.load(post_path)
    broadcaster = Broadcaster()
    
    # Generate Audio (using Broadcaster's logic)
    # We want a tech/hacker vibe
    audio_path, vtt_path = broadcaster.generate_voiceover(post, vibe="tech")
    
    if not audio_path:
        logger.warning("Audio generation failed. Using dummy fallback audio.")
        # Create dummy silent audio using moviepy or just a placeholder file if exists
        dummy_audio = os.path.join(CAPCUT_API_DIR, "dummy_audio.mp3")
        # Create a simple file if possible, or just generate silence
        try:
             # Basic sine wave or silence if moviepy available
             from moviepy import AudioClip
             import numpy as np
             def make_frame(t): return 0
             clip = AudioClip(make_frame, duration=10, fps=44100)
             clip.write_audiofile(dummy_audio, logger=None)
             audio_path = dummy_audio
        except Exception as e:
             logger.error(f"Could not create dummy audio: {e}")
             return

    logger.info(f"Audio ready: {audio_path}")
    
    # 2. Start Server
    if not ensure_server_running():
        return

    # 3. Create Draft
    try:
        # Explicitly create draft first
        logger.info("Creating new draft...")
        res = requests.post(f"{CAPCUT_API_URL}/create_draft", json={"width": 1080, "height": 1920})
        if res.status_code != 200:
            logger.error(f"Failed to create draft: {res.text}")
            return
            
        data = res.json()
        if not data.get("success"):
            logger.error(f"Failed to create draft: {data.get('error')}")
            return
            
        # Extract ID from nested output structure if needed
        # The API returns {"output": {"draft_id": ...}}
        draft_id = data["output"]["draft_id"]
        logger.info(f"Draft Created: {draft_id}")

        # Add Audio
        logger.info("Adding audio track...")
        res = requests.post(f"{CAPCUT_API_URL}/add_audio", json={
            "draft_id": draft_id,
            "audio_url": f"file://{audio_path}", # Fixed parameter name
            "start": 0,
            "volume": 1.0
        })
        logger.info(f"Add Audio Response: {res.text}")
        
        # Add Text (Title)
        logger.info("Adding Title...")
        res = requests.post(f"{CAPCUT_API_URL}/add_text", json={
            "draft_id": draft_id,
            "text": post['title'].upper(),
            "start": 0,
            "end": 3,
            "font_size": 15, 
            "font_color": "#00FF00", 
            "stroke_color": "#000000",
            "stroke_width": 2,
            "position": [0, 0.5] 
        })
        logger.info(f"Add Text Response: {res.text}")

        # Save
        logger.info("Saving Draft...")
        res = requests.post(f"{CAPCUT_API_URL}/save_draft", json={
            "draft_id": draft_id,
            "draft_folder": "/" # Optional, uses default if empty
        })
        try:
            data = res.json()
            logger.info(f"Save Result: {data}")
        except:
             logger.error(f"Save Failed (Non-JSON): {res.text}")

        # Move Draft mechanism (same as before)
        
        # Move Draft
        # Look for dfd_ folder in CAPCUT_API_DIR
        draft_name = None
        for item in os.listdir(CAPCUT_API_DIR):
            if item.startswith("dfd_") and os.path.isdir(os.path.join(CAPCUT_API_DIR, item)):
                draft_name = item
                break
        
        if draft_name:
            source = os.path.join(CAPCUT_API_DIR, draft_name)
            # Mac CapCut Drafts
            # Standard path: ~/Movies/CapCut/User Data/Projects/com.lveditor.draft/
            user_home = os.path.expanduser("~")
            target_dir = os.path.join(user_home, "Movies/CapCut/User Data/Projects/com.lveditor.draft/")
            
            if os.path.exists(target_dir):
                target = os.path.join(target_dir, draft_name)
                if os.path.exists(target):
                    shutil.rmtree(target)
                shutil.move(source, target)
                print(f"✅ Draft moved to CapCut: {target}")
                print("👉 Open CapCut and look for the new project!")
            else:
                print(f"⚠️ Could not find CapCut directory. Draft is at: {source}")
        else:
            print("❌ No draft folder found.")

    except Exception as e:
        logger.error(f"API Error: {e}")

if __name__ == "__main__":
    generate_draft()
