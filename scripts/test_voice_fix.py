import sys
import os
import asyncio
import logging

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.voice_actor import VoiceActor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestVoiceFix")

async def test_voice_mapping():
    print("Testing VoiceActor voice mapping...")
    actor = VoiceActor()
    
    # Test text
    text = "Hello, this is a test of the British voice."
    output = "test_british.mp3"
    
    # We expect "en-GB-SoniaNeural" to map to "bf_isabella" internally for Kokoro
    # We can't easily spy on the internal call without mocking, 
    # but we can check if it runs without error and logs what we expect from Edge-TTS fallback
    
    print("\n[Test] Calling speak with 'en-GB-SoniaNeural'...")
    try:
        await actor.speak(text, output, voice="en-GB-SoniaNeural")
        print("[Pass] speak() completed successfully.")
    except Exception as e:
        print(f"[Fail] speak() failed: {e}")
        import traceback
        traceback.print_exc()

    # Clean up
    if os.path.exists(output):
        os.remove(output)
    if os.path.exists(output.replace(".mp3", ".wav")):
        os.remove(output.replace(".mp3", ".wav"))
    if os.path.exists(output.replace(".mp3", ".vtt")):
        os.remove(output.replace(".mp3", ".vtt"))

if __name__ == "__main__":
    asyncio.run(test_voice_mapping())
