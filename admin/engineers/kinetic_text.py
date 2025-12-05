"""
Kinetic Text - Physics-based Animation Generator

Inspired by Framer Motion.
Generates CSS keyframes that mimic spring physics (stiffness, damping, mass).
Now fully powered by Pillow for robust text rendering without ImageMagick.
"""

import math
import logging
import numpy as np
from typing import List, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont

try:
    from moviepy import ImageClip, CompositeVideoClip, VideoClip, vfx
except ImportError:
    pass

logger = logging.getLogger("KineticText")

class KineticTextEngine:
    """
    The Kinetic Engineer.
    Translates physics parameters into CSS animations or Video Clips.
    """
    def __init__(self):
        self.name = "Kinetic Text"
        self.role = "Motion Engineer"
        
    def _spring_solver(self, t, stiffness=100, damping=10, mass=1):
        """
        Solves the spring equation for time t.
        Returns position (0 to 1).
        Simplified implementation of a damped harmonic oscillator.
        """
        # Critical damping check
        critical_damping = 2 * math.sqrt(stiffness * mass)
        damping_ratio = damping / critical_damping
        
        # Natural frequency
        w0 = math.sqrt(stiffness / mass)
        
        if damping_ratio < 1:
            # Underdamped (bouncy)
            wd = w0 * math.sqrt(1 - damping_ratio**2)
            envelope = math.exp(-damping_ratio * w0 * t)
            return 1 - envelope * (math.cos(wd * t) + (damping_ratio * w0 / wd) * math.sin(wd * t))
        else:
            # Critically damped or overdamped (no bounce)
            return 1 - math.exp(-w0 * t) * (1 + w0 * t)

    def generate_spring_css(self, name: str, property_name: str, start_val: float, end_val: float, 
                           stiffness=170, damping=26, mass=1, duration=1.0) -> str:
        """
        Generates a CSS @keyframe animation approximating a spring.
        """
        steps = 60 # 60fps approximation
        keyframes = []
        
        for i in range(steps + 1):
            t = (i / steps) * duration
            # Get physics progress (0 to 1, usually, but can overshoot)
            progress = self._spring_solver(t, stiffness, damping, mass)
            
            # Interpolate value
            current_val = start_val + (end_val - start_val) * progress
            
            # Format unit (simplified for px/rem/scale)
            unit = "px" if property_name in ["transform", "left", "top"] and "scale" not in property_name else ""
            if "scale" in property_name:
                val_str = f"{current_val:.4f}"
                prop_str = f"transform: scale({val_str});"
            elif property_name == "opacity":
                val_str = f"{max(0, min(1, current_val)):.2f}"
                prop_str = f"opacity: {val_str};"
            elif property_name == "y":
                val_str = f"{current_val:.2f}px"
                prop_str = f"transform: translateY({val_str});"
            else:
                val_str = f"{current_val:.2f}{unit}"
                prop_str = f"{property_name}: {val_str};"
                
            percent = f"{int((i/steps)*100)}%"
            keyframes.append(f"  {percent} {{ {prop_str} }}")
            
        css = f"@keyframes {name} {{\n" + "\n".join(keyframes) + "\n}"
        return css

    def get_preset(self, name="gentle"):
        """
        Returns standard Framer-like presets.
        """
        presets = {
            "gentle": {"stiffness": 100, "damping": 15, "mass": 1},
            "wobbly": {"stiffness": 180, "damping": 12, "mass": 1},
            "stiff": {"stiffness": 200, "damping": 20, "mass": 1},
            "slow": {"stiffness": 50, "damping": 20, "mass": 1},
        }
        return presets.get(name, presets["gentle"])
        
    def parse_vtt(self, vtt_path: str) -> List[Tuple[float, float, str]]:
        """Parses a WebVTT file into a list of (start, end, text) tuples."""
        captions = []
        try:
            with open(vtt_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            lines = content.splitlines()
            current_start = None
            current_end = None
            current_text = []
            
            for line in lines:
                line = line.strip()
                if "-->" in line:
                    parts = line.split("-->")
                    current_start = self._time_str_to_seconds(parts[0].strip())
                    current_end = self._time_str_to_seconds(parts[1].strip())
                    current_text = []
                elif line and current_start is not None:
                    current_text.append(line)
                elif not line and current_start is not None:
                    if current_text:
                        captions.append((current_start, current_end, " ".join(current_text)))
                    current_start = None
                    
            if current_start is not None and current_text:
                 captions.append((current_start, current_end, " ".join(current_text)))
                 
        except Exception as e:
            logger.error(f"Error parsing VTT: {e}")
            
        return captions

    def _time_str_to_seconds(self, time_str: str) -> float:
        """Converts HH:MM:SS.mmm to seconds."""
        try:
            h, m, s = time_str.split(':')
            s, ms = s.split('.')
            return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0
        except:
            return 0.0

    def create_text_clip_pil(self, text, fontsize, color, font, size_w, size_h=None, stroke_width=0, align='center'):
        """Creates a static text image using Pillow."""
        try:
            # Font loading strategy
            font_obj = None
            candidates = [
                font, 
                "Impact",
                "Arial-Black",
                "Arial", 
                "Helvetica", 
                "/System/Library/Fonts/Helvetica.ttc",
                "/System/Library/Fonts/Supplemental/Arial.ttf"
            ]
            
            for f in candidates:
                try:
                    font_obj = ImageFont.truetype(f, fontsize)
                    break
                except (IOError, OSError):
                    continue
            
            if not font_obj:
                try:
                    font_obj = ImageFont.load_default()
                except:
                    return None

            # Measure text
            dummy_img = Image.new("RGBA", (1, 1))
            dummy_draw = ImageDraw.Draw(dummy_img)
            bbox = dummy_draw.textbbox((0, 0), text, font=font_obj)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            
            # Canvas size
            w = int(size_w)
            h = int(size_h) if size_h else int(text_h + 60)
            
            # Create image
            img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            
            # Calculate coordinates
            x = (w - text_w) / 2
            y = (h - text_h) / 2
            
            if align == 'left':
                x = 40
            
            # Draw stroke
            if stroke_width > 0:
                stroke_color = 'black'
                for adj_x in range(-stroke_width, stroke_width+1):
                    for adj_y in range(-stroke_width, stroke_width+1):
                        if adj_x**2 + adj_y**2 <= stroke_width**2:
                            draw.text((x+adj_x, y+adj_y), text, font=font_obj, fill=stroke_color)
                
            # Draw main text
            draw.text((x, y), text, font=font_obj, fill=color)
            
            return ImageClip(np.array(img))
            
        except Exception as e:
            logger.error(f"Pillow text creation failed: {e}")
            return None

    def generate_kinetic_captions(self, vtt_path: str, video_w: int, video_h: int, style="capcut_pop") -> List:
        """
        Generates MoviePy Clips for each caption with kinetic entrance.
        Styles: 'capcut_pop', 'typewriter', 'karaoke'
        """
        if not vtt_path:
            return []
            
        captions = self.parse_vtt(vtt_path)
        clips = []
        
        # Style config
        fontsize = int(video_w * 0.06) 
        color = '#FFFFFF'
        stroke_width = int(fontsize * 0.1)
        font = "Impact"
        
        for start, end, text in captions:
            duration = end - start
            if duration <= 0: continue
            
            try:
                # 1. Base Text Clip
                txt_clip = self.create_text_clip_pil(
                    text=text, 
                    fontsize=fontsize, 
                    color=color, 
                    font=font,
                    size_w=video_w,
                    size_h=int(video_h * 0.2), # Text area height
                    stroke_width=stroke_width
                )
                
                if not txt_clip: continue

                # Position: Bottom Center
                txt_clip = txt_clip.with_duration(duration).with_position(('center', 0.7), relative=True).with_start(start)
                
                # 2. Apply Animation based on Style
                if style == "capcut_pop":
                    # The classic "Spring Pop"
                    def spring_scale(t):
                        if t > 0.4: return 1.0
                        val = self._spring_solver(t * 3.0, stiffness=300, damping=18)
                        return max(0.01, val)
                    
                    try:
                        effect_clip = txt_clip.with_effects([vfx.Resize(spring_scale)])
                        clips.append(effect_clip)
                    except:
                        clips.append(txt_clip)

                elif style == "typewriter":
                    # Masking left to right?
                    # Hard to do with ImageClip without frame-by-frame generation
                    # Alternative: Show words sequentially (Word-level granularity needed)
                    # For now, just Pop-IN but faster
                    clips.append(txt_clip)

                else:
                    clips.append(txt_clip)
                    
            except Exception as e:
                logger.error(f"Error creating clip for '{text}': {e}")
                continue
                
        return clips

if __name__ == "__main__":
    kt = KineticTextEngine()
    print("KineticTextEngine Ready with CapCut styles.")
