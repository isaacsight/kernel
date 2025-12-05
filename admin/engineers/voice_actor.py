"""
Voice Actor - Premium AI Narration

Handles text-to-speech generation using ElevenLabs (premium) 
with a fallback to edge-tts (free/standard).
"""

import os
import logging
import hashlib
import json
import requests
import asyncio
import edge_tts

logger = logging.getLogger("VoiceActor")

class VoiceActor:
    def __init__(self):
        self.elevenlabs_key = os.environ.get("ELEVENLABS_API_KEY")
        self.elevenlabs_voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        self.cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static", "audio_cache")
        
        # Kokoro paths
        self.kokoro_model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "admin", "brain", "kokoro_models", "kokoro-v0_19.onnx")
        self.kokoro_voices_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "admin", "brain", "kokoro_models", "voices.json")
        self.kokoro = None
        
        if not os.path.exists(self.cache_dir):
            os.makedirs(self.cache_dir)

    async def speak(self, text: str, output_path: str, voice: str = None) -> tuple[str, str]:
        """
        Generates audio and subtitles from text.
        Returns (audio_path, vtt_path).
        """
        # Map friendly/Edge-TTS names to Kokoro voices
        kokoro_map = {
            "en-GB-SoniaNeural": "bf_isabella",  # British Female
            "en-US-GuyNeural": "am_adam",        # American Male
            "en-US-ChristopherNeural": "am_michael", # American Male Deep
            "en-US-JennyNeural": "af_sarah",      # American Female
            "en-US-BrianMultilingualNeural": "am_michael" # Map deep authoritative to Michael
        }
        
        target_voice = voice or "en-GB-SoniaNeural"
        kokoro_voice = kokoro_map.get(target_voice, "bf_isabella")
        # Prepare paths
        base_name = os.path.splitext(output_path)[0]
        vtt_path = f"{base_name}.vtt"
        
        # Check cache first
        text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
        cache_audio = os.path.join(self.cache_dir, f"{text_hash}.mp3") # We use mp3 extension for cache even if wav
        cache_vtt = os.path.join(self.cache_dir, f"{text_hash}.vtt")
        
        if os.path.exists(cache_audio) and os.path.exists(cache_vtt):
            logger.info("Using cached audio/vtt.")
            import shutil
            shutil.copy(cache_audio, output_path)
            shutil.copy(cache_vtt, vtt_path)
            return output_path, vtt_path

        # Try ElevenLabs if key is present
        if self.elevenlabs_key:
            try:
                logger.info("🎙️ Generating premium audio with ElevenLabs...")
                success = self._generate_elevenlabs(text, output_path)
                if success:
                    # Generate VTT via edge-tts (dummy run)
                    await self._generate_edge_tts(text, output_path.replace(".mp3", "_temp.mp3"), vtt_path, target_voice)
                    if os.path.exists(output_path.replace(".mp3", "_temp.mp3")):
                        os.remove(output_path.replace(".mp3", "_temp.mp3"))
                        
                    # Cache it
                    import shutil
                    shutil.copy(output_path, cache_audio)
                    shutil.copy(vtt_path, cache_vtt)
                    return output_path, vtt_path
            except Exception as e:
                logger.error(f"ElevenLabs generation failed: {e}. Falling back to Kokoro/edge-tts.")

        # Try Kokoro (Local Premium)
        if os.path.exists(self.kokoro_model_path):
            try:
                logger.info("🎙️ Generating premium audio with Kokoro (Local)...")
                # Kokoro generates WAV, so we might need to adjust output_path extension or convert
                # For simplicity, we save as WAV but keep the .mp3 extension in the variable name if caller expects it,
                # but we should probably write to a .wav file.
                wav_path = output_path.replace(".mp3", ".wav")
                
                success = await self._generate_kokoro(text, wav_path, kokoro_voice)
                if success:
                    # Generate VTT via edge-tts (dummy run)
                    await self._generate_edge_tts(text, output_path.replace(".mp3", "_temp.mp3"), vtt_path, target_voice)
                    if os.path.exists(output_path.replace(".mp3", "_temp.mp3")):
                        os.remove(output_path.replace(".mp3", "_temp.mp3"))
                    
                    # If caller expects mp3, we should probably convert or just return wav
                    # Broadcaster handles wav fine.
                    
                    # Cache it (as wav)
                    import shutil
                    shutil.copy(wav_path, cache_audio) # Saving wav content to .mp3 file (ffmpeg handles this fine usually)
                    shutil.copy(vtt_path, cache_vtt)
                    
                    return wav_path, vtt_path
            except Exception as e:
                logger.error(f"Kokoro generation failed: {e}. Falling back to edge-tts.")

        # Fallback to edge-tts
        try:
            logger.info(f"🗣️ Generating standard audio with edge-tts ({target_voice})...")
            await self._generate_edge_tts(text, output_path, vtt_path, target_voice)
            # Cache it
            import shutil
            shutil.copy(output_path, cache_audio)
            shutil.copy(vtt_path, cache_vtt)
            return output_path, vtt_path
        except Exception as e:
            logger.error(f"edge-tts generation failed: {e}")
            return None, None

    async def _generate_kokoro(self, text: str, output_path: str, voice: str = "bf_isabella") -> bool:
        """Generates audio using Kokoro-82M (Local)."""
        import soundfile as sf
        # Use our local patched version
        from admin.engineers.kokoro_lib.kokoro import Kokoro
        
        # Lazy load model
        if not self.kokoro:
            self.kokoro = Kokoro(self.kokoro_model_path, self.kokoro_voices_path)
            
        # Generate
        # Voice options: af_sarah, af_bella, af_nicole, am_adam, am_michael, bf_emma, bf_isabella, bm_george
        # We'll use 'bf_isabella' (British Female) as requested
        samples, sample_rate = self.kokoro.create(
            text, 
            voice=voice, 
            speed=1.0, 
            lang="en-gb"
        )
        
        sf.write(output_path, samples, sample_rate)
        return True

    def _generate_elevenlabs(self, text: str, output_path: str) -> bool:
        """Generates audio using ElevenLabs API."""
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.elevenlabs_voice_id}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.elevenlabs_key
        }
        
        data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        response = requests.post(url, json=data, headers=headers)
        
        if response.status_code == 200:
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk:
                        f.write(chunk)
            return True
        else:
            logger.error(f"ElevenLabs API Error: {response.status_code} - {response.text}")
            return False

    async def _generate_edge_tts(self, text: str, output_path: str, vtt_path: str, voice: str = "en-US-ChristopherNeural") -> None:
        """Generates audio and VTT using edge-tts CLI."""
        import subprocess
        
        # voice is passed in argument
        cmd = [
            "edge-tts",
            "--voice", voice,
            "--text", text,
            "--write-media", output_path,
            "--write-subtitles", vtt_path
        ]
        
        # Run in executor to avoid blocking async loop
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            raise Exception(f"edge-tts failed: {stderr.decode()}")

if __name__ == "__main__":
    # Test
    actor = VoiceActor()
    asyncio.run(actor.speak("This is a test of the emergency broadcast system.", "test_voice.mp3"))
