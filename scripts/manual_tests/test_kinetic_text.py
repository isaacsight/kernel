"""
Test script for Kinetic Text Engine.
"""
import os
from moviepy import VideoFileClip, CompositeVideoClip
from admin.engineers.kinetic_text import KineticTextEngine

def test_kinetic_text():
    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(base_dir, 'static', 'videos')
    
    video_path = os.path.join(static_dir, 'test-tiktok-video.mp4')
    vtt_path = os.path.join(static_dir, 'voiceover_fired-my-ai-team.vtt')
    output_path = os.path.join(static_dir, 'test_kinetic_output.mp4')
    
    if not os.path.exists(video_path):
        print(f"❌ Video not found: {video_path}")
        return
        
    if not os.path.exists(vtt_path):
        print(f"❌ VTT not found: {vtt_path}")
        return

    print("🎬 Loading video...")
    video = VideoFileClip(video_path)
    # Cut to 10 seconds for speed
    video = video.subclipped(0, 10)
    
    print("✨ Generating kinetic captions...")
    engine = KineticTextEngine()
    caption_clips = engine.generate_kinetic_captions(vtt_path, video.w, video.h)
    
    if not caption_clips:
        print("❌ No captions generated.")
        return

    print(f"✅ Generated {len(caption_clips)} caption clips.")
    
    print("🎞️ Compositing...")
    final = CompositeVideoClip([video] + caption_clips)
    
    print(f"💾 Saving to {output_path}...")
    final.write_videofile(output_path, fps=24, codec='libx264', audio_codec='aac')
    print("🎉 Done!")

if __name__ == "__main__":
    test_kinetic_text()
