"""
Producer for 'Fun Topic' TikTok Video.
Generates a video about a random topic with fun captions and AI features.
"""

import os
import sys
import logging
import asyncio
import random
import json
from moviepy import *

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.engineers.video_engine import VideoEngine, Scene, VisualAsset, VisualType, AudioAsset
from admin.engineers.voice_actor import VoiceActor
from admin.engineers.kinetic_text import KineticTextEngine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FunVideoProducer")

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static/videos/fun_posts")
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# --- Topic & Script ---

TOPICS = [
    "The Future of AI is Weird",
    "Why Your Toaster Will Judge You",
    "Coding with AI: A Love Story",
    "The Simulation Theory is Real",
    "Why We Fear Empty Time"
]

def generate_fun_script(topic):
    """Generates a short, punchy script for the topic."""
    # Simple templates for now to ensure reliability
    scripts = {
        "The Future of AI is Weird": [
            ("Did you know your future roommate might be a robot?", 3.0),
            ("Imagine a world where your fridge orders pizza for you.", 4.0),
            ("But what if it judges your pineapple topping?", 3.5),
            ("The future is weird, but I'm ready for it.", 3.5)
        ],
        "Why Your Toaster Will Judge You": [
            ("Your toaster knows your secrets.", 2.5),
            ("It sees you burning that bagel every morning.", 3.5),
            ("In the future, everything will be smart.", 3.0),
            ("Maybe a little too smart.", 2.5)
        ],
        "Coding with AI: A Love Story": [
            ("I used to code alone.", 2.0),
            ("Now I have an AI assistant who fixes my bugs.", 4.0),
            ("It's like having a genius best friend.", 3.0),
            ("Unless the wifi goes out. Then I'm lonely again.", 4.0)
        ],
        "The Simulation Theory is Real": [
            ("What if I told you this video isn't real?", 3.5),
            ("It's all just pixels and code.", 2.5),
            ("Are you watching the screen, or is it watching you?", 4.0),
            ("Wake up, Neo.", 2.5)
        ],
        "Why We Fear Empty Time": [
            ("When was the last time you did nothing?", 3.0),
            ("No phone, no scroll, just silence.", 3.5),
            ("We fill every second because silence allows us to think.", 4.5),
            ("And thinking is dangerous.", 3.0)
        ]
    }
    
    selected_script = scripts.get(topic)
    if not selected_script:
         # Fallback generic
        selected_script = [
            (f"Let's talk about {topic}.", 3.0),
            ("It's crazier than you think.", 2.5),
            ("Imagine a world where this is normal.", 3.0),
            ("The future is happening right now.", 3.0)
        ]
        
    return selected_script

# --- Main Producer ---

async def generate_video_async():
    topic = random.choice(TOPICS)
    print(f"🎬 Action! Producing Fun Video about: '{topic}'...")
    
    # 0. Script
    script_lines = generate_fun_script(topic)
    
    # 2. Voiceover & Scenes
    actor = VoiceActor()
    scenes = []
    
    engine = VideoEngine() # Helper for rendering
    
    for i, (text, duration) in enumerate(script_lines):
        print(f"   🎙️ Generating line {i+1}: {text}...")
        
        # Audio
        safe_topic = topic.replace(" ", "_").lower()[0:10]
        initial_audio_path = os.path.join(OUTPUT_DIR, f"{safe_topic}_line_{i}.mp3")
        
        # VoiceActor
        # Returns (audio_path, vtt_path)
        real_audio_path, vtt_path = await actor.speak(text, initial_audio_path, voice="en-US-GuyNeural")
        
        # Visual Selection (Fun & Dynamic)
        visual_path = None
        asset_type = VisualType.GENERATED_VEO # Trigger AI visual simulation
        effects = ["slow_pan"]
        
        # Add some variety based on text
        text_lower = text.lower()
        if "future" in text_lower or "robot" in text_lower:
             effects = ["zoom_3d", "glitch"]
        elif "judge" in text_lower or "scared" in text_lower:
             effects = ["velocity_pulse"]
        elif "lonely" in text_lower or "silence" in text_lower:
             effects = ["slow_pan"]
             
        # Create Visual Asset
        # Since we don't have real Veo generation yet, VideoEngine will likely fallback to color or mock
        # We can try to use a placeholder image if we have one to make it look "generated"
        # Or let VideoEngine handle the Veo fallbacks (which currently warn and use color)
        
        # Let's try to map to existing sample images if possible for a better demo
        # sample_images = ["gen_hook.png", "essay_team.png", "homepage_top.png"]
        # But for "fun" random video, let's trust VideoEngine to handle "GENERATED_VEO" or provide a generic
        
        # Actually, let's provide a valid source path to a sample image to ensure *something* shows
        # VideoEngine handles missing files by showing color, which is boring.
        # Let's find a fallback image.
        fallback_img = os.path.abspath(os.path.join(os.path.dirname(__file__), "../static/images/gen_hook.png"))
        if not os.path.exists(fallback_img):
             # Try deeper check
             fallback_img = os.path.abspath(os.path.join(os.path.dirname(__file__), "../admin/assets/ai_critique_mock.png"))
        
        visual = VisualAsset(
            asset_type=VisualType.GENERATED_VEO,
            source_path=fallback_img, # This acts as the "generated" content placeholder
            effects=effects,
            prompt=text 
        )
        
        audio = AudioAsset(source_path=real_audio_path, duration=duration)
        
        scene = Scene(
            id=i,
            text=text,
            duration=duration,
            visual=visual,
            audio=audio
        )
        scenes.append(scene)
        
    # 3. Render
    print("🎥 Rendering Final Cut...")
    
    clips = []
    
    # Kinetic Text Engine
    kte = KineticTextEngine()
    
    for scene in scenes:
        print(f"      - Rendering Scene {scene.id}...")
        clip = engine.render_scene(scene)
        
        if clip:
            # Add Audio
            if scene.audio and os.path.exists(scene.audio.source_path):
                 audio_clip = AudioFileClip(scene.audio.source_path)
                 clip = clip.with_audio(audio_clip)
                 # Ensure video matches audio duration roughly
                 if audio_clip.duration > clip.duration:
                     clip = clip.with_duration(audio_clip.duration)
            
            # --- CAPTIONS (The "Fun" Part) ---
            # Generate kinetic captions for this scene
            # We need a VTT file. VoiceActor generated one!
            base_name = os.path.splitext(scene.audio.source_path)[0]
            vtt_path = f"{base_name}.vtt"
            
            if os.path.exists(vtt_path):
                print(f"        📝 Adding kinetic captions from {vtt_path}")
                caption_clips = kte.generate_kinetic_captions(
                    vtt_path, 
                    clip.w, 
                    clip.h, 
                    style="capcut_pop"
                )
                
                # Overlay captions
                if caption_clips:
                    # Adjust start times to be relative to this clip only (they already are 0-based from VTT usually)
                    # CompositeVideoClip expects start times relative to the composite
                    # But here we are compositing onto the scene clip itself
                    final_scene_clip = CompositeVideoClip([clip] + caption_clips, size=clip.size).with_duration(clip.duration)
                    clips.append(final_scene_clip)
                else:
                    clips.append(clip)
            else:
                print("        ⚠️ No VTT found, skipping captions.")
                clips.append(clip)
                
        else:
            print(f"        ❌ Scene {scene.id} failed to render.")

    if not clips:
        print("❌ No clips were rendered! Aborting.")
        return
        
    final_video = concatenate_videoclips(clips)
    
    # Background Music
    # Try different audio paths
    bg_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../static/audio/tech.mp3"))
    if not os.path.exists(bg_path):
         bg_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../static/audio/lofi_beat.mp3"))

    if os.path.exists(bg_path):
        bg_music = AudioFileClip(bg_path)
        bg_music = bg_music.with_effects([MultiplyVolume(0.20)]) # Low volume
        from moviepy.audio.fx import AudioLoop
        bg_music = AudioLoop(duration=final_video.duration).apply(bg_music)
        
        final_audio = CompositeAudioClip([bg_music, final_video.audio])
        final_video.audio = final_audio
        
    output_path = os.path.join(OUTPUT_DIR, "fun_topic_final.mp4")
    final_video.write_videofile(output_path, fps=30)
    print(f"✨ Fun Video ready at: {output_path}")

if __name__ == "__main__":
    asyncio.run(generate_video_async())
