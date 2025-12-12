
import os
import sys
import logging
import asyncio
import subprocess
import time

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.video_editor import VideoEditor
from admin.engineers.graphic_designer import GraphicDesigner
from admin.config import config

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("AdobeProducer")

POST = {
    "title": "AI Agents: The New Creative Team",
    "content": "Imagine a world where your creative team is entirely digital. AI Agents can design, edit, and code 24/7. They don't sleep, they don't drink coffee, they just create. Are you ready for the revolution?",
    "slug": "ai-agents-creative-team"
}

def generate_audio_mac(text, output_path):
    """Uses macOS 'say' command for reliable audio generation."""
    try:
        # say -o output.aiff "text"
        logger.info("🎙️ Using macOS 'say' command for audio...")
        temp_aiff = output_path.replace(".mp3", ".aiff")
        subprocess.run(["say", "-o", temp_aiff, text, "-v", "Samantha"], check=True)
        
        # Convert to mp3 using ffmpeg if available, otherwise just rename/use aiff
        # Premiere handles AIFF fine.
        if os.path.exists(temp_aiff):
            return temp_aiff
    except Exception as e:
        logger.error(f"Mac 'say' failed: {e}")
    return None

def wait_for_file(filepath, timeout=30):
    """Waits for a file to appear on disk."""
    start = time.time()
    logger.info(f"⏳ Waiting for {os.path.basename(filepath)}...")
    while time.time() - start < timeout:
        if os.path.exists(filepath):
            # Wait a split second for write to finish
            time.sleep(1.0)
            return True
        time.sleep(1)
    return False

async def produce_tiktok():
    print("=== 🎬 IMPROVED Adobe TikTok Workflow ===")
    
    # Setup paths
    output_dir = os.path.abspath("output_adobe_test")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    # 1. Audio Production (Robust Fallback)
    print("\n🎤 [1/3] Generating Audio...")
    script_text = POST["content"]
    audio_path = os.path.join(output_dir, "voiceover.aiff") # Using AIFF for Premiere friendless
    
    generated_audio = generate_audio_mac(script_text, audio_path)
    if generated_audio and os.path.exists(generated_audio):
        print(f"   ✅ Audio ready: {generated_audio}")
        audio_path = generated_audio
    else:
        print("   ❌ Audio generation failed completely.")
        return

    # 2. Visual Production (Photoshop)
    print("\n🎨 [2/3] Designing Graphics (Photoshop)...")
    graphic_designer = GraphicDesigner()
    image_path = os.path.join(output_dir, f"{POST['slug']}_thumb.jpg")
    
    # Ensure clean slate
    if os.path.exists(image_path):
        os.remove(image_path)
    
    if graphic_designer.app_path:
        print(f"   Using {graphic_designer.app_name}")
        success = graphic_designer.create_thumbnail(
            title="AI CREATIVE\nREVOLUTION",
            output_path=image_path
        )
        if success:
            print(f"   ✅ Script sent to Photoshop.")
            if wait_for_file(image_path, timeout=45):
                 print(f"   ✅ Image file verified: {image_path}")
            else:
                 print(f"   ❌ Timeout waiting for Photoshop to save image.")
                 return
        else:
            print("   ❌ Failed to send script to Photoshop.")
            return
    else:
        print("   ❌ Photoshop not found.")
        return

    # 3. Editorial (Premiere Pro)
    print("\n🎞️ [3/3] Editing & Exporting (Premiere Pro)...")
    video_editor = VideoEditor()
    
    if video_editor.app_path:
        print(f"   Using {video_editor.app_name}")
        
        sequence_name = f"TikTok_{POST['slug']}"
        
        # We start by assembling
        success = video_editor.assemble_clips(
            file_paths=[audio_path, image_path],
            sequence_name=sequence_name
        )
        
        if success:
            print("   ✅ Assembly script sent.")
            print("   👉 Premiere Pro is creating the sequence now.")
            
            # NOTE: Automated export in Premiere requires pointing to a valid .epr Preset file.
            # Without a known preset path, exportAsMediaDirect often fails or requires user input.
            # We will attempt to notify the user.
            
            print("\n✅ WORKFLOW COMPLETE!")
            print(f"1. Audio: {audio_path}")
            print(f"2. Image: {image_path}")
            print(f"3. Premiere Sequence: '{sequence_name}' created.")
            print("\nTo Export Video:")
            print("   Open Premiere Pro > Click Sequence > File > Export > Media (Cmd+M)")
            
    else:
        print("   ❌ Premiere Pro not found.")

if __name__ == "__main__":
    asyncio.run(produce_tiktok())
