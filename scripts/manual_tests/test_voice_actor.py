"""
Test script for VoiceActor.
Verifies that it generates audio and VTT, falling back to edge-tts if needed.
"""
import asyncio
import os
from admin.engineers.voice_actor import VoiceActor

async def test_voice():
    print("🎙️ Testing VoiceActor...")
    actor = VoiceActor()
    
    text = "This is a test of the autonomous voice generation system. We are checking for audio and subtitles."
    output_path = "test_voice_output.mp3"
    
    # Clean up previous
    if os.path.exists(output_path):
        os.remove(output_path)
    if os.path.exists(output_path.replace(".mp3", ".vtt")):
        os.remove(output_path.replace(".mp3", ".vtt"))

    audio_path, vtt_path = await actor.speak(text, output_path)
    
    if audio_path and os.path.exists(audio_path):
        print(f"✅ Audio generated: {audio_path}")
        print(f"   Size: {os.path.getsize(audio_path)} bytes")
    else:
        print("❌ Audio generation failed.")
        
    if vtt_path and os.path.exists(vtt_path):
        print(f"✅ VTT generated: {vtt_path}")
        with open(vtt_path, 'r') as f:
            print(f"   Content Preview:\n{f.read()[:100]}...")
    else:
        print("❌ VTT generation failed.")

if __name__ == "__main__":
    asyncio.run(test_voice())
