"""
Visual Effects Library
Implements programmatic versions of popular social media video effects.
"""

import logging
import random
import numpy as np
try:
    from moviepy import VideoClip, vfx, TextClip, CompositeVideoClip, ColorClip
    from moviepy.video.fx import MultiplyColor
except ImportError:
    pass

logger = logging.getLogger("VisualEffects")

class VisualEffects:
    """
    A collection of video effects applied to MoviePy clips.
    """
    
    @staticmethod
    def apply_effect(clip, effect_name, duration=None):
        """Applies a named effect to the clip."""
        if duration:
            clip = clip.with_duration(duration)
            
        if effect_name == "zoom_3d":
            return VisualEffects.zoom_3d_fake(clip)
        elif effect_name == "glitch":
            return VisualEffects.glitch(clip)
        elif effect_name == "velocity_pulse":
            return VisualEffects.velocity_pulse(clip)
        elif effect_name == "slow_pan":
             return clip.with_effects([vfx.Resize(lambda t: 1 + 0.02 * t)]) # Standard Ken Burns
        
        if effect_name == "hacker_overlay":
            return VisualEffects.hacker_overlay(clip)
            
        return clip

    @staticmethod
    def hacker_overlay(clip):
        """
        Adds a cyberpunk terminal overlay with scrolling text and scanlines.
        """
        w, h = clip.w, clip.h
        duration = clip.duration
        
        # 1. Darken background slightly
        clip = clip.with_effects([MultiplyColor(0.8)])
        
        # 2. Terminal Text
        try:
            # We want random hex codes or system log text
            lines = [
                "SYS.ROOT.ACCESS... GRANTED",
                "CONNECTING TO PORT 8000...",
                "UPLOADING_PACKET [==============]",
                "MEM.ALLOC: 64TB",
                "AGENT: ALCHEMIST [ONLINE]",
                "TRACE_ROUTE: 192.168.1.1",
                "COMPILING ASSETS..."
            ]
            
            text_clips = []
            for i, line in enumerate(lines):
                if i * 1.5 > duration: break
                
                txt = TextClip(
                    text=line,
                    font="Courier",
                    font_size=20,
                    color="#00FF00",
                    bg_color=None,
                    size=(w-40, None),
                    method='caption',
                    text_align='left'
                ).with_duration(duration - (i*0.5)).with_start(i*0.5)
                
                # Position progressively down
                txt = txt.with_position((20, h - 200 + (i*25)))
                text_clips.append(txt)
            
            # 3. REC indicator
            rec = TextClip(
                text="● REC [LIVE]",
                font="Arial",
                font_size=30,
                color="red",
            ).with_position((40, 40)).with_duration(duration)
            
            # 4. Scanline (Simple horizontal line moving down)
            # Create a thin semi-transparent line
            scanline = ColorClip(size=(w, 5), color=(0, 255, 0), duration=duration).with_opacity(0.3)
            
            def move_down(t):
                # Speed: height per 2 seconds
                y = (t * (h / 2.0)) % h
                return ('center', int(y))
                
            scanline = scanline.with_position(move_down)
            
            return CompositeVideoClip([clip, scanline, rec] + text_clips)
            
        except Exception as e:
            logger.error(f"Hacker overlay failed: {e}")
            return clip

    @staticmethod
    def apply_look(clip, look_name):
        """
        Applies a cinematic color grade (LUT simulation).
        """
        if look_name == "teal_orange":
            # High contrast, slightly teal tint, warm highlights? 
            # Simple simul: Boost contrast, overlay orange/teal?
            # 1. Boost saturation/contrast (MultiplyColor > 1 brightens, < 1 darkens)
            # LumContrast is usually safe if imported or accessible via vfx
            
            # Use MultiplyColor for simplified improvements
            clip = clip.with_effects([MultiplyColor(1.1), vfx.LumContrast(contrast=0.2)])
            
            w, h = clip.w, clip.h
            tint = ColorClip(size=(w, h), color=(255, 160, 0)).with_opacity(0.1).with_duration(clip.duration)
            return CompositeVideoClip([clip, tint])
            
        elif look_name == "noir":
            # B&W + High Contrast
            return clip.with_effects([vfx.BlackAndWhite(), vfx.LumContrast(contrast=0.4)])
            
        elif look_name == "warm_glow":
            # Golden hour
            w, h = clip.w, clip.h
            tint = ColorClip(size=(w, h), color=(255, 200, 100)).with_opacity(0.15).with_duration(clip.duration)
            return CompositeVideoClip([clip.with_effects([MultiplyColor(1.1)]), tint])
            
        return clip

    @staticmethod
    def zoom_3d_fake(clip, intensity=0.3):
        """
        Simulates 3D Zoom by zooming in while shifting perspective.
        This isn't true depth masking, but mimics the 'dolly zoom' sensation.
        """
        w, h = clip.w, clip.h
        
        def effect(get_frame, t):
            frame = get_frame(t)
            
            # Progress 0.0 to 1.0
            progress = t / clip.duration
            
            # Zoom Factor: 1.0 -> 1.3
            zoom = 1 + (intensity * progress)
            
            # Pan Shift (Parallax fake): Move slightly center-to-right
            # If we zoom in, we must crop. 
            # We calculate the crop window based on zoom.
            
            # Simplified: Use MoviePy's Resize/Crop logic which is optimized
            # But writing raw numpy for true 3d zoom is hard. 
            # Let's rely on standard vfx.Resize + vfx.Scroll?
            pass # We return the frame assuming wrapper handles it
            return frame

        # MoviePy implementation
        # Zoom in center
        clip = clip.with_effects([vfx.Resize(lambda t: 1 + 0.2 * t)])
        
        # Add subtle slide to emphasize motion
        # clip = clip.fx(vfx.scroll, x_speed=5, y_speed=0) 
        
        return clip

    @staticmethod
    def glitch(clip, frequency=0.5):
        """
        Adds digital glitch/chromatic aberration artifacts.
        """
        def filter_glitch(get_frame, t):
            frame = get_frame(t)
            
            # Only glitch occasionally
            if random.random() > frequency:
                return frame
                
            # Create glitch
            # Shift RGB channels
            r = np.roll(frame[:,:,0], 5, axis=1)
            g = np.roll(frame[:,:,1], -5, axis=1)
            b = frame[:,:,2]
            
            # Stack
            glitched = np.dstack((r, g, b))
            
            # Random slice offset
            if random.random() > 0.5:
                # Pick a random row block
                h = frame.shape[0]
                y1 = random.randint(0, h-50)
                y2 = y1 + random.randint(10, 50)
                offset = random.randint(-20, 20)
                glitched[y1:y2, :] = np.roll(glitched[y1:y2, :], offset, axis=1)
                
            return glitched
            
        return clip.transform(filter_glitch)

    @staticmethod
    def velocity_pulse(clip, bpm=120):
        """
        Pulsates the scale of the video to a beat.
        """
        beat_duration = 60 / bpm
        
        def scale_func(t):
            # Sawtooth wave or sine wave peaking at beat
            # (t % beat_duration) / beat_duration -> 0 to 1
            phase = (t % beat_duration) / beat_duration
            
            # Pop on beat: Rapid expansion then decay
            if phase < 0.2:
                # Zoom out fast (pop)
                return 1.1 - (phase * 0.5) 
            else:
                # Slowly zoom back in
                return 1.0 + ((phase - 0.2) * 0.05)
                
        # This requires Resize vfx
        return clip.with_effects([vfx.Resize(scale_func)])
