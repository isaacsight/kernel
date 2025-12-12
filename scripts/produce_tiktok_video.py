import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

logging.basicConfig(level=logging.INFO)

from admin.engineers.broadcaster import Broadcaster
from moviepy import AudioClip, AudioFileClip
import numpy as np

# Create a dummy silent audio file for testing
def create_dummy_audio(path, duration=10):
    make_frame = lambda t: np.sin(2 * np.pi * 440 * t) * 0.1 # Sine wave
    clip = AudioClip(make_frame, duration=duration, fps=44100)
    clip.write_audiofile(path, logger=None)
    return path

class MockBroadcaster(Broadcaster):
    def generate_voiceover(self, post, vibe="chill", voice=None):
        print("[MockBroadcaster] Generating dummy voiceover and VTT...")
        
        # Create audio
        audio_path = os.path.join(self.output_dir, "dummy_voice.mp3")
        create_dummy_audio(audio_path, duration=12)
        
        # Create VTT
        vtt_path = os.path.join(self.output_dir, "dummy.vtt")
        with open(vtt_path, "w") as f:
            f.write("""WEBVTT

00:00:00.000 --> 00:00:03.000
SYSTEM INITIALIZED.

00:00:03.000 --> 00:00:06.000
CONNECTING MOBILE BRAIN...

00:00:06.000 --> 00:00:09.000
CODE INJECTION SUCCESSFUL.

00:00:09.000 --> 00:00:12.000
THE AGENT IS ONLINE.
""")
        return audio_path, vtt_path

    def generate_script(self, post, vibe="chill"):
        return "System Initialized. Connecting Mobile Brain. Code Injection Successful. The Agent is Online."

def main():
    print("🎬 Starting TikTok Production (Hacker Mode)...")
    
    # 1. Simulate the Post
    post = {
        "title": "The Self-Evolving Studio",
        "slug": "self-evolving-studio",
        "content": "A website that builds itself. A studio that edits its own videos. The Toolsmith is online. The system is autonomous. This is the future of creation."
    }
    
    # 2. Use Mock
    broadcaster = MockBroadcaster()
    
    # 3. Generate
    output_path = broadcaster.generate_video(post, vibe="tech")
    
    if output_path:
        print(f"✅ Video generated: {output_path}")
        os.system(f"open {output_path}")
    else:
        print("❌ Video generation failed.")

if __name__ == "__main__":
    main()
