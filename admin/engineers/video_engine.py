"""
Video Engine - The Core Composition System
"Programmatic CapCut" logic for assembling scenes, assets, and effects.
"""

import os
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Union, Dict
from enum import Enum
import random

try:
    from moviepy import VideoFileClip, ImageClip, ColorClip, CompositeVideoClip, AudioFileClip, vfx, CompositeAudioClip
    from moviepy.audio.fx import AudioFadeOut, AudioNormalize, MultiplyVolume
except ImportError:
    # Allow running without moviepy for structure testing
    pass

logger = logging.getLogger("VideoEngine")

class VisualType(Enum):
    IMAGE = "image"
    VIDEO = "video"
    COLOR = "color"
    GENERATED_VEO = "veo"
    GENERATED_SORA = "sora"

@dataclass
class VisualAsset:
    """A visual element to be shown on screen."""
    source_path: str = None
    asset_type: VisualType = VisualType.COLOR
    duration: float = 0.0
    prompt: str = None # For AI generation
    color: str = None # For Color clips
    effects: List[str] = field(default_factory=list) # e.g. ["zoom_in", "pan_left"]

@dataclass
class AudioAsset:
    """An audio element (voiceover, sfx)."""
    source_path: str
    duration: float
    volume: float = 1.0

@dataclass
class Scene:
    """
    A semantic unit of the video. 
    Corresponds roughly to one sentence or phrase of the script.
    """
    id: int
    text: str # The spoken text
    duration: float
    visual: VisualAsset
    audio: Optional[AudioAsset] = None
    subtitles: List[Dict] = field(default_factory=list) # [{'start': 0, 'end': 1, 'text': 'Hello'}]

class VideoEngine:
    """
    The Technician. 
    Takes a list of Scenes and renders the final video.
    """
    def __init__(self, resolution=(1080, 1920)):
        self.w, self.h = resolution
        self.fps = 30
    
    def render_scene(self, scene: Scene) -> Optional[CompositeVideoClip]:
        """Technically renders a single scene into a CompositeVideoClip."""
        try:
            # 1. Base Visual Clip
            clip = None
            
            if scene.visual.asset_type == VisualType.COLOR:
                color = scene.visual.color or "#000000"
                clip = ColorClip(size=(self.w, self.h), color=color, duration=scene.duration)
                
            elif scene.visual.asset_type == VisualType.IMAGE:
                if os.path.exists(scene.visual.source_path):
                    clip = ImageClip(scene.visual.source_path).with_duration(scene.duration)
                    # Smart Resize (Cover)
                    clip = self._resize_cover(clip)
                else:
                    logger.error(f"Image not found: {scene.visual.source_path}")
                    clip = ColorClip(size=(self.w, self.h), color="#333333", duration=scene.duration)
            
            elif scene.visual.asset_type in [VisualType.VIDEO, VisualType.GENERATED_VEO, VisualType.GENERATED_SORA]:
                 if scene.visual.source_path and os.path.exists(scene.visual.source_path):
                     clip = VideoFileClip(scene.visual.source_path)
                     # Loop if too short
                     if clip.duration < scene.duration:
                         from moviepy.video.fx import Loop
                         clip = clip.with_effects([vfx.Loop(duration=scene.duration)])
                     else:
                         clip = clip.subclipped(0, scene.duration)
                     clip = self._resize_cover(clip)
                 else:
                     logger.warning(f"Video asset missing: {scene.visual.source_path}")
                     clip = ColorClip(size=(self.w, self.h), color="#220000", duration=scene.duration)

            if not clip:
                return None

            # Apply Effects (CapCut Style)
            from admin.engineers.visual_effects import VisualEffects
            for effect_name in scene.visual.effects:
                clip = VisualEffects.apply_effect(clip, effect_name, duration=scene.duration)
                
            # Default "Slow Pan" if no effects on an image (avoid static boring images)
            if scene.visual.asset_type == VisualType.IMAGE and not scene.visual.effects:
                clip = VisualEffects.apply_effect(clip, "slow_pan", duration=scene.duration)

            # 2. Audio
            if scene.audio and os.path.exists(scene.audio.source_path):
                audio_clip = AudioFileClip(scene.audio.source_path)
                # Ensure audio duration matches scene exactly or is handled
                clip.audio = audio_clip

            # 3. Kinetic Text Overlay
            # This is where we integrate the KineticTextEngine
            from admin.engineers.kinetic_text import KineticTextEngine
            kte = KineticTextEngine()
            
            # Convert simple subtitles list to Kinetic format if needed
            if scene.subtitles:
                # Generate granular captions for this scene
                # We need to create a list of (start, end, text) relative to scene start
                # Assuming scene.subtitles is [{'start': 0, 'end':1, 'text': 'Hi'}]
                granular_clips = []
                
                # We reuse the logic from generate_kinetic_captions but pass data directly
                # For now, let's assume we can generate VTT or just call internal method
                # This is a placeholder for V2 granular support
                pass
            
            # For V1: If scene text is short, show it all centered with Pop
            if scene.text and len(scene.text.split()) < 10:
                 # Create a single caption for the whole scene
                 txt_clip = kte.create_text_clip_pil(
                     scene.text, 
                     fontsize=int(self.w*0.06), 
                     color="white", 
                     font="Impact", 
                     size_w=self.w, 
                     stroke_width=4
                 )
                 if txt_clip:
                     # Add Spring Pop
                     def spring_scale(t):
                         if t > 0.4: return 1.0
                         # Simple spring
                         return 1.0 if t > 0.4 else t*2.5
                     
                     txt_clip = txt_clip.with_duration(scene.duration).with_position(('center', 'center')).with_start(0)
                     try:
                         txt_clip = txt_clip.with_effects([vfx.Resize(spring_scale)])
                     except: 
                        pass
                     
                     clip = CompositeVideoClip([clip, txt_clip])
            
            return clip
            
        except Exception as e:
            logger.error(f"Failed to render scene {scene.id}: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _resize_cover(self, clip):
        """Resizes clip to cover the resolution (CSS object-fit: cover)."""
        w, h = clip.w, clip.h
        target_ratio = self.w / self.h
        current_ratio = w / h
        
        if current_ratio > target_ratio:
            # Too wide, crop width
            new_w = h * target_ratio
            left = (w - new_w) / 2
            clip = clip.cropped(x1=left, width=new_w)
            clip = clip.resized((self.w, self.h))
        else:
            # Too tall, crop height
            new_h = w / target_ratio
            top = (h - new_h) / 2
            return clip.cropped(y1=top, height=new_h).resized((self.w, self.h))
            
        return clip

class Director:
    """
    The Creative Mind.
    Breaks a script into scenes and assigns visuals.
    """
    def __init__(self):
        pass
        
    def direct_script(self, script_text: str, audio_map: List[Dict]) -> List[Scene]:
        """
        script_text: Full text
        audio_map: List of dicts from VoiceActor alignment [{'word': 'Hello', 'start': 0, 'end': 0.5}, ...]
        """
        scenes = []
        
        # 1. Break down by sentences (simplistic)
        # Ideally we use the alignment data to break exactly where pauses are
        import re
        sentences = re.split(r'(?<=[.!?])\s+', script_text)
        
        current_time = 0.0
        
        for i, sentence in enumerate(sentences):
            if not sentence.strip():
                continue
                
            # Estimate duration from audio map or word count if map is imperfect
            # This is complex, for V1 we roughly estimate:
            word_count = len(sentence.split())
            duration = word_count * 0.4 # approx 0.4s per word
            
            # Create the visual plan
            visual = self._choose_visual(sentence, i, len(sentences))
            
            scene = Scene(
                id=i,
                text=sentence,
                duration=duration,
                visual=visual
            )
            scenes.append(scene)
            current_time += duration
            
        return scenes
    
    def _choose_visual(self, text: str, index: int, total: int) -> VisualAsset:
        """Decides best visual for the text context with CapCut flair."""
        text_lower = text.lower()
        
        # 1. Special Sections
        if index == 0:
            # Hook: Glitch or 3D Zoom
            return VisualAsset(asset_type=VisualType.IMAGE, effects=["glitch", "zoom_3d"])
        
        if index == total - 1:
             # Outro: Fade to black
             return VisualAsset(asset_type=VisualType.COLOR, color="#000000", effects=[])
        
        # 2. Keyword Mapping for AI Video (High Value)
        ai_triggers = ["imagine", "future", "world", "simulate", "dream"]
        if any(w in text_lower for w in ai_triggers):
            return VisualAsset(asset_type=VisualType.GENERATED_VEO, prompt=text, effects=["slow_pan"])
            
        # 3. Keyword Mapping for Effects
        # High Energy -> Velocity Pulse
        pulse_triggers = ["fast", "quick", "boom", "suddenly", "power", "energy"]
        if any(w in text_lower for w in pulse_triggers):
             return VisualAsset(asset_type=VisualType.IMAGE, effects=["velocity_pulse"])
             
        # Tech/Glitch -> Glitch
        glitch_triggers = ["error", "hack", "bug", "broken", "digital", "weird"]
        if any(w in text_lower for w in glitch_triggers):
             return VisualAsset(asset_type=VisualType.IMAGE, effects=["glitch"])
             
        # Nostalgia/Focus -> 3D Zoom
        zoom_triggers = ["remember", "focus", "look", "deep", "realize"]
        if any(w in text_lower for w in zoom_triggers):
             return VisualAsset(asset_type=VisualType.IMAGE, effects=["zoom_3d"])

        # Default: Slow Pan (Ken Burns)
        return VisualAsset(asset_type=VisualType.IMAGE, effects=["slow_pan"])

if __name__ == "__main__":
    # Test
    print("Video Engine Loaded.")
