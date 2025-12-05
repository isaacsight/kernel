import os
import logging
from typing import Optional, List, Dict
import random

# Try importing moviepy, handle missing dependency gracefully
try:
    from moviepy import (
        VideoFileClip, ImageClip, ColorClip, TextClip, 
        CompositeVideoClip, AudioFileClip, CompositeAudioClip, 
        concatenate_videoclips,
        vfx, afx
    )
    from moviepy.video.tools.subtitles import SubtitlesClip
    HAS_MOVIEPY = True
except ImportError:
    HAS_MOVIEPY = False

from .schema import Movie, Scene, Element

logger = logging.getLogger("VideoRenderer")

class VideoRenderer:
    """
    Renders a Movie schema object into a video file using MoviePy.
    """
    
    def __init__(self, output_dir: str = "static/videos"):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
    def render(self, movie: Movie, filename: str) -> Optional[str]:
        """
        Renders the movie to a file.
        Returns the absolute path of the generated video.
        """
        if not HAS_MOVIEPY:
            logger.error("MoviePy is not installed. Cannot render video.")
            return None
            
        try:
            logger.info(f"Rendering movie: {filename} ({movie.width}x{movie.height})")
            
            # 1. Render each scene
            scene_clips = []
            
            for i, scene in enumerate(movie.scenes):
                logger.info(f"Rendering scene {i+1}/{len(movie.scenes)}")
                clip = self._render_scene(scene, movie.width, movie.height)
                if clip:
                    scene_clips.append(clip)
                else:
                    logger.warning(f"Scene {i+1} failed to render.")

            if not scene_clips:
                logger.error("No scenes were rendered successfully.")
                return None

            # 2. Concatenate Scenes
            # from moviepy.video.compositing.concatenate import concatenate_videoclips
            # Note: Transition logic handles here? 
            # For V1, simple concatenation. formatting transitions is harder in moviepy without overlapping
            # MoviePy 1.0 supports method="compose" for overlapping transitions but it's computationally expensive
            final_video = concatenate_videoclips(scene_clips, method="compose")
            
            # 3. Write to file
            output_path = os.path.join(self.output_dir, filename)
            
            # Optimization: Use libx264 for speed/size balance
            final_video.write_videofile(
                output_path, 
                fps=movie.fps, 
                codec="libx264", 
                audio_codec="aac",
                threads=4,
                preset="medium"
            )
            
            logger.info(f"Video rendered successfully: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Render failed: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _parse_color(self, color_str):
        """Converts hex string to RGB tuple"""
        if not color_str: return (0, 0, 0)
        if isinstance(color_str, (tuple, list)): return color_str
        
        color_str = color_str.lstrip('#')
        # Handle 3 char hex
        if len(color_str) == 3:
            color_str = ''.join([c*2 for c in color_str])
            
        try:
            return tuple(int(color_str[i:i+2], 16) for i in (0, 2, 4))
        except:
            return (0, 0, 0)

    def _render_scene(self, scene: Scene, width: int, height: int) -> Optional[CompositeVideoClip]:
        """
        Renders a single scene into a CompositeVideoClip.
        """
        try:
            # 1. Background
            bg_color = self._parse_color(scene.background_color or "#000000")
            # Determine duration: explicit > max element duration > default 5s
            duration = scene.duration
            if duration <= 0:
                # Calculate max duration
                max_dur = 5.0 # Default
                for e in scene.elements:
                    end_time = e.start + (e.duration if e.duration > 0 else 5.0) # Estimate
                    if end_time > max_dur:
                        max_dur = end_time
                duration = max_dur
            
            # Create base clip (background)
            base_clip = ColorClip(size=(width, height), color=bg_color, duration=duration)
            
            layers = [base_clip]
            audio_layers = []

            # 2. Process Elements
            # Sort by Z-index (low to high)
            sorted_elements = sorted(scene.elements, key=lambda x: x.z_index)
            
            for element in sorted_elements:
                clip = self._create_element_clip(element, width, height, duration)
                if clip:
                    # Set start time is crucial for CompositeVideoClip
                    clip = clip.with_start(element.start)
                    
                    # Handle separate audio elements or visual elements with audio
                    if element.type == "audio":
                        audio_layers.append(clip) # It's an audio clip
                    else:
                        layers.append(clip)
                        if clip.audio:
                            # Adjust volume
                            clip.audio = clip.audio.with_effects([MultiplyVolume(element.volume)])
            
            # 3. Composite Visuals
            layout = CompositeVideoClip(layers, size=(width, height)).with_duration(duration)
            
            # 4. Composite Audio
            # Mix scene audio (from video elements) + separate audio elements
            if audio_layers:
                # Get audio from visual clips
                visual_audio = [c.audio for c in layers if c.audio is not None]
                all_audio = visual_audio + audio_layers
                if all_audio:
                    final_audio = CompositeAudioClip(all_audio)
                    layout.audio = final_audio
            
            return layout
            
        except Exception as e:
            logger.error(f"Scene render error: {e}")
            return None

    def _create_element_clip(self, element: Element, parent_w: int, parent_h: int, scene_duration: float):
        """
        Creates a primitive MoviePy clip from an Element.
        """
        clip = None
        
        # Determine duration
        elem_dur = element.duration
        if elem_dur <= 0:
            elem_dur = scene_duration - element.start
            if elem_dur < 0: elem_dur = 1.0 # Safety
            
        try:
            if element.type == "image":
                if element.src and os.path.exists(element.src):
                    clip = ImageClip(element.src).with_duration(elem_dur)
                    clip = self._apply_position_size(clip, element, parent_w, parent_h)
                else:
                    logger.warning(f"Image source missing: {element.src}")
                    
            elif element.type == "video":
                if element.src and os.path.exists(element.src):
                    clip = VideoFileClip(element.src)
                    # Loop if needed? or Trim?
                    # For now, default behavior: trim to requested duration
                    if element.duration > 0:
                        if clip.duration < element.duration:
                             # loop
                             # clip = clip.loop(duration=element.duration) # moviepy 1.0 syntax differs?
                             # Let's just subclip/limit
                             pass
                        else:
                             clip = clip.subclipped(0, element.duration)
                    else:
                        # Full duration requested (-1)
                        # We update elem_dur to actual clip duration if it was -1
                        pass
                        
                    clip = self._apply_position_size(clip, element, parent_w, parent_h)
                else:
                    logger.warning(f"Video source missing: {element.src}")

            elif element.type == "text":
                # Text generation
                # Using TextClip (requires ImageMagick)
                # Fallback or robust configuration needed
                content = element.content or "Text"
                font = element.style.get("font", "Arial") # Arial might need full path on Mac
                fontsize = element.style.get("fontsize", 70)
                color = element.style.get("color", "white")
                stroke_width = element.style.get("stroke_width", 2)
                stroke_color = element.style.get("stroke_color", "black")
                
                # Check for Mac fonts if "Arial" is generic
                if "Arial" in font and os.path.exists("/System/Library/Fonts/Supplemental/Arial.ttf"):
                    font = "Arial"
                
                clip = TextClip(
                    text=content,
                    font=font,
                    font_size=fontsize,
                    color=color,
                    stroke_color=stroke_color,
                    stroke_width=stroke_width,
                    method="caption", # 'caption' enables wrapping
                    size=(int(parent_w*0.8), None) # width limit for wrapping
                ).with_duration(elem_dur)
                
                clip = self._apply_position_size(clip, element, parent_w, parent_h)

            elif element.type == "color":
                # Pure color block
                color = self._parse_color(element.content or "#000000") # Use content field for hex
                clip = ColorClip(size=(100, 100), color=color).with_duration(elem_dur)
                clip = self._apply_position_size(clip, element, parent_w, parent_h)

            elif element.type == "audio":
                if element.src and os.path.exists(element.src):
                    clip = AudioFileClip(element.src).with_duration(elem_dur)
                    clip = clip.with_effects([MultiplyVolume(element.volume)])
                return clip # Return audio directly, checking handling in caller

            # Apply Common Effects (Opacity, Fade)
            if clip and element.type != "audio":
                # Opacity - not standard in all MoviePy versions easily? 
                # CrossFadeIn/Out
                if element.animation == "fade_in":
                    clip = clip.with_effects([vfx.CrossFadeIn(0.5)])
                
                # Custom Filters
                for effect in element.filters:
                     pass # Todo implement map
                     
            return clip

        except Exception as e:
            logger.error(f"Element creation error ({element.type}): {e}")
            return None

    def _apply_position_size(self, clip, element: Element, parent_w: int, parent_h: int):
        """
        Applies resizing and positioning logic.
        """
        # 1. Resize
        # If width/height defined, resize to that.
        # If both missing, and it's image/video, maybe 'cover' logic if position is 'center'?
        # For now, simplistic explicit resizing
        
        target_w = self._parse_dimension(element.width, parent_w)
        target_h = self._parse_dimension(element.height, parent_h)
        
        if target_w and target_h:
            clip = clip.resized((target_w, target_h))
        elif target_w:
            clip = clip.resized(width=target_w)
        elif target_h:
            clip = clip.resized(height=target_h)
        else:
            # Default "Cover" behavior for background images/videos if they are at z=0?
            # Or just leave as is.
            # Let's implement "Cover" if it looks like a background (z_index=0 full duration)
            if element.z_index == 0 and element.duration >= 0:
                 # Resize to fill screen - simplistic cover
                 if clip.w < parent_w or clip.h < parent_h:
                     ratio = max(parent_w/clip.w, parent_h/clip.h)
                     clip = clip.resized(ratio)
        
        # 2. Position
        pos = element.position
        # If string 'center', 'top', etc.
        # If dict {'x': 10, 'y': 10}
        
        if isinstance(pos, dict):
            x = pos.get('x', 'center')
            y = pos.get('y', 'center')
            clip = clip.with_position((x, y))
        else:
            clip = clip.with_position(pos)
            
        return clip

    def _parse_dimension(self, dim, parent_dim):
        if dim is None: return None
        if isinstance(dim, int): return dim
        if isinstance(dim, float): return int(dim) # If <1 assumes percentage? No, keep simple
        if isinstance(dim, str):
            if "%" in dim:
                # Percentage
                p = float(dim.replace("%", "")) / 100.0
                return int(parent_dim * p)
            return int(dim)
        return None
