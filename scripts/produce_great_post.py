"""
Producer for 'Websiting & Commentary' TikTok Video.
Refined to focus on the website engine and AI commentary.
"""

import os
import sys
import logging
import asyncio
import random
from moviepy import *

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.engineers.video_engine import VideoEngine, Scene, VisualAsset, VisualType, AudioAsset
from admin.engineers.voice_actor import VoiceActor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GreatPostProducer")

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static/videos/great_posts")
ASSETS_DIR = os.path.join(OUTPUT_DIR, "assets")
if not os.path.exists(ASSETS_DIR):
    os.makedirs(ASSETS_DIR)

# --- Asset Generators ---

async def capture_website_assets():
    """Captures real screenshots from the local server."""
    from playwright.async_api import async_playwright
    
    screenshots = {}
    print("🌐 Capturing website assets via Playwright...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1080, 'height': 1920})
        page = await context.new_page()
        
        # 1. Homepage Scroll
        try:
            print("   📸 Snapping Homepage...")
            await page.goto("http://localhost:8085/static/index.html", timeout=10000)
            await page.wait_for_timeout(2000)
            
            # Scroll and capture video-like frames? No, just one long screenshot for panning
            # We'll take a few screenshots at different scroll positions
            path = os.path.join(ASSETS_DIR, "homepage_top.png")
            await page.screenshot(path=path)
            screenshots['homepage'] = path
            
            await page.evaluate("window.scrollBy(0, 500)")
            await page.wait_for_timeout(1000)
            path_scroll = os.path.join(ASSETS_DIR, "homepage_scroll.png")
            await page.screenshot(path=path_scroll)
            screenshots['homepage_scroll'] = path_scroll
            
        except Exception as e:
            print(f"   ⚠️ Could not capture homepage: {e}")
            screenshots['homepage'] = _generate_color_fallback("homepage", "#111111")

        # 2. Essay Page (Meet Your Team)
        try:
            print("   📸 Snapping Essay...")
            await page.goto("http://localhost:8085/static/posts/ai-meet-your-ai-engineering-team.html", timeout=10000)
            await page.wait_for_timeout(2000)
            path = os.path.join(ASSETS_DIR, "essay_team.png")
            await page.screenshot(path=path)
            screenshots['essay'] = path
        except Exception as e:
            print(f"   ⚠️ Could not capture essay: {e}")
            screenshots['essay'] = _generate_color_fallback("essay", "#222222")

        await browser.close()
        
    return screenshots

def _generate_color_fallback(name, color):
    from moviepy import ColorClip
    # Just return path to a created color image or let VideoEngine handle it?
    # VideoEngine handles colors if path is None, but we need a path for consistency in this script.
    # Let's just return None and handle in assembly.
    return None 

def generate_critique_overlay():
    """Generates a text-heavy image simulating AI critique."""
    # Placeholder for a generated image
    # For now, we will return a path to a static image we'll assume exists or create a text clip later
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "../content/assets/ai_critique_mock.png"))

# --- Main Producer ---

async def generate_video_async():
    print("🎬 Action! Producing 'Websiting & Commentary'...")
    
    # 0. Script
    script_lines = [
        ("People think this is just a blog.", 2.5),
        ("But under the hood, it's a living engine.", 3.0),
        ("Every essay I write acts as a prompt for a team of AI critics.", 4.5),
        ("They analyze the arguments, check the tone, and even rewrite the tweets.", 5.0),
        ("It's not just publishing. It's websiting.", 4.0)
    ]
    
    # 1. Capture Assets
    site_assets = await capture_website_assets()
    
    # 2. Voiceover & Scenes
    actor = VoiceActor()
    scenes = []
    
    engine = VideoEngine() # Helper for rendering
    
    for i, (text, duration) in enumerate(script_lines):
        print(f"   🎙️ Generating line {i+1}: {text}...")
        
        # Audio
        initial_audio_path = os.path.join(OUTPUT_DIR, f"speech_v2_{i}.mp3")
        # VoiceActor might return a .wav path if using Kokoro
        real_audio_path, _ = await actor.speak(text, initial_audio_path, voice="en-US-BrianMultilingualNeural")
        
        # Visual Selection
        visual_path = None
        asset_type = VisualType.IMAGE
        effects = ["slow_pan"]
        
        if i == 0: # "Just a blog"
            visual_path = site_assets.get('homepage')
        elif i == 1: # "Living Engine"
            # Use Terminal or Code visual
            # Fallback to homepage scroll with glitch
            visual_path = site_assets.get('homepage_scroll')
            effects = ["glitch"]
        elif i == 2: # "AI Critics"
            visual_path = site_assets.get('essay')
            effects = ["zoom_3d"]
        elif i == 3: # "Analyze/Rewrite"
            # Critique Overlay
            # For now, reuse essay with a color overlay or different effect
            visual_path = site_assets.get('essay')
            effects = ["velocity_pulse", "hacker_overlay"] # Simulate AI work
        elif i == 4: # "Websiting"
            # Final strong shot
            visual_path = site_assets.get('homepage')
        
        # Fallback if capture failed
        if not visual_path:
             asset_type = VisualType.COLOR
             visual_path = "#000000"
             effects = []

        visual = VisualAsset(
            asset_type=asset_type,
            source_path=visual_path,
            effects=effects,
            color=visual_path if asset_type == VisualType.COLOR else None
        )
        
        if real_audio_path:
            audio = AudioAsset(source_path=real_audio_path, duration=duration)
        else:
            print(f"      ⚠️ Voice generation failed for line {i}. Proceeding without voice.")
            audio = None
        
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
    
    # Custom render loop to ensure audio sync
    clips = []
    print(f"   🎞️  Processing {len(scenes)} scenes...")
    for scene in scenes:
        print(f"      - Rendering Scene {scene.id} (Visual: {scene.visual.source_path})")
        clip = engine.render_scene(scene)
        if clip:
            print(f"        ✅ Scene {scene.id} rendered successfully. Duration: {clip.duration}")
            if scene.audio:
                if os.path.exists(scene.audio.source_path):
                     audio_clip = AudioFileClip(scene.audio.source_path)
                     clip = clip.with_audio(audio_clip)
                     if audio_clip.duration > clip.duration:
                         clip = clip.with_duration(audio_clip.duration)
                else:
                    print(f"        ⚠️ Audio file not found: {scene.audio.source_path}")
            clips.append(clip)
        else:
            print(f"        ❌ Scene {scene.id} failed to render.")

    if not clips:
        print("❌ No clips were rendered! Aborting.")
        return
        
    final_video = concatenate_videoclips(clips)
    
    # Background Music
    bg_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static/audio/tech.mp3"))
    if not os.path.exists(bg_path):
         # Try lofi fallback
         bg_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static/audio/lofi_beat.mp3"))

    if os.path.exists(bg_path):
        bg_music = AudioFileClip(bg_path)
        bg_music = bg_music.with_effects([MultiplyVolume(0.25)])
        from moviepy.audio.fx import AudioLoop
        bg_music = AudioLoop(duration=final_video.duration).apply(bg_music)
        
        final_audio = CompositeAudioClip([bg_music, final_video.audio])
        final_video.audio = final_audio
        
    output_path = os.path.join(OUTPUT_DIR, "websiting_final.mp4")
    final_video.write_videofile(output_path, fps=30)
    print(f"✨ Video ready at: {output_path}")

if __name__ == "__main__":
    asyncio.run(generate_video_async())
