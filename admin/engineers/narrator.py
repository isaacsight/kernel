"""
The Narrator - Voice/Audio Agent

Creates audio content, podcasts, and voiceovers using Studio Node.
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from config import config

logger = logging.getLogger("Narrator")


class Narrator:
    """
    The Narrator (Voice/Audio Producer)
    
    Mission: Transform written content into engaging audio experiences.
    
    Responsibilities:
    - Generate audio summaries of posts
    - Create podcast-style narrations
    - Produce voiceovers for videos
    - Manage audio content library
    """
    
    VOICES = {
        "calm": "en-US-GuyNeural",          # Calm male voice
        "warm": "en-US-JennyNeural",         # Warm female voice  
        "professional": "en-US-AriaNeural",  # Professional female
        "conversational": "en-US-DavisNeural" # Conversational male
    }
    
    def __init__(self):
        self.name = "The Narrator"
        self.role = "Voice/Audio Producer"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.node_url = config.STUDIO_NODE_URL
        self.audio_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), '../../static/audio')
        )
        os.makedirs(self.audio_dir, exist_ok=True)
        
    def generate_summary(self, title: str, content: str, max_words: int = 150) -> str:
        """
        Generates a concise summary suitable for audio narration.
        """
        logger.info(f"[{self.name}] Generating audio summary for: {title}")
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Create a concise audio summary ({max_words} words max) for this blog post:
                
                Title: {title}
                Content: {content[:1500]}
                
                Guidelines:
                - Write in a conversational, podcast-friendly style
                - Start with a hook that grabs attention
                - Summarize the key takeaways
                - End with a thought-provoking question
                
                Return ONLY the summary text.
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=30
                )
                response.raise_for_status()
                summary = response.json().get("response", "").strip()
                
                self.metrics.track_agent_action(self.name, 'generate_summary', True, 0)
                return summary
                
            except Exception as e:
                logger.warning(f"[{self.name}] Summary generation failed: {e}")
        
        # Fallback: First few sentences
        sentences = content.split('.')[:3]
        return '. '.join(sentences) + '.'
    
    def create_audio(self, text: str, output_name: str, voice: str = "calm") -> str:
        """
        Creates audio file from text using edge-tts.
        """
        logger.info(f"[{self.name}] Creating audio: {output_name}")
        
        output_path = os.path.join(self.audio_dir, f"{output_name}.mp3")
        
        try:
            import edge_tts
            import asyncio
            
            voice_id = self.VOICES.get(voice, self.VOICES["calm"])
            
            async def generate():
                communicate = edge_tts.Communicate(text, voice_id)
                await communicate.save(output_path)
            
            asyncio.run(generate())
            
            self.metrics.track_agent_action(self.name, 'create_audio', True, 0)
            logger.info(f"[{self.name}] Audio saved: {output_path}")
            
            return f"static/audio/{output_name}.mp3"
            
        except ImportError:
            logger.warning(f"[{self.name}] edge-tts not installed")
            return ""
        except Exception as e:
            logger.error(f"[{self.name}] Audio creation failed: {e}")
            return ""
    
    def create_podcast_episode(self, title: str, content: str, 
                                voice: str = "conversational") -> Dict:
        """
        Creates a full podcast-style episode from a post.
        """
        # Generate intro
        intro = f"Welcome to Does This Feel Right? Today we're exploring: {title}."
        
        # Generate summary
        summary = self.generate_summary(title, content)
        
        # Generate outro
        outro = "Thanks for listening. If this resonated with you, share it with someone who needs to hear it. Until next time, keep asking - does this feel true?"
        
        # Combine
        full_script = f"{intro}\n\n{summary}\n\n{outro}"
        
        # Create audio
        slug = title.lower().replace(" ", "-")[:30]
        audio_path = self.create_audio(full_script, f"podcast-{slug}", voice)
        
        return {
            "title": title,
            "script": full_script,
            "audio_path": audio_path,
            "duration_estimate": len(full_script.split()) / 150,  # ~150 words per minute
            "created_at": datetime.now().isoformat()
        }
    
    def create_video_voiceover(self, script: str, slug: str, 
                                voice: str = "calm") -> Dict:
        """
        Creates a voiceover for video content.
        """
        audio_path = self.create_audio(script, f"voiceover-{slug}", voice)
        
        return {
            "audio_path": audio_path,
            "word_count": len(script.split()),
            "estimated_duration": len(script.split()) / 150
        }
    
    def get_audio_library(self) -> List[Dict]:
        """
        Lists all generated audio files.
        """
        library = []
        
        if os.path.exists(self.audio_dir):
            for filename in os.listdir(self.audio_dir):
                if filename.endswith('.mp3'):
                    filepath = os.path.join(self.audio_dir, filename)
                    library.append({
                        "filename": filename,
                        "path": f"static/audio/{filename}",
                        "size_kb": os.path.getsize(filepath) // 1024,
                        "created": datetime.fromtimestamp(
                            os.path.getctime(filepath)
                        ).isoformat()
                    })
        
        return sorted(library, key=lambda x: x['created'], reverse=True)
    
    def generate_tts_script(self, content: str, style: str = "podcast") -> str:
        """
        Prepares content for text-to-speech by adding natural pauses and emphasis.
        """
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Prepare this content for text-to-speech narration:
                
                Content: {content[:1000]}
                Style: {style}
                
                Guidelines:
                - Add natural pauses (use commas and periods)
                - Break up long sentences
                - Make it conversational
                - Keep the meaning intact
                
                Return ONLY the modified text.
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=30
                )
                response.raise_for_status()
                return response.json().get("response", "").strip()
                
            except Exception as e:
                logger.warning(f"[{self.name}] Script preparation failed: {e}")
        
        return content


if __name__ == "__main__":
    narrator = Narrator()
    
    # Test summary generation
    sample_content = """
    In a world increasingly defined by constant connectivity and endless notifications, 
    the art of being still has become almost revolutionary. We scroll through feeds 
    while eating, check emails before our eyes fully open, and fill every quiet moment 
    with noise. But what happens when we stop?
    """
    
    summary = narrator.generate_summary("The Lost Art of Stillness", sample_content)
    print("Summary:", summary)
    
    print("\nAudio Library:", narrator.get_audio_library())
