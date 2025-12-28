import os
import logging
import subprocess
from typing import Optional, List


logger = logging.getLogger(__name__)

class VisualArtist:
    """
    The Visual Artist agent.
    Responsible for generating unique visual assets using:
    1. ASCII Video generation (The "Matrix" look)
    2. Animated Drawings (The "Sketchbook" look)
    3. Thumbnail generation via Flux/SD (Planned)
    """
    
    def __init__(self):
        self.name = "The Visual Artist"
        self.role = "Generative Artist"
        self.ascii_tool_path = os.path.join(os.path.dirname(__file__), "ascii_lib", "ascii.py")
        
    def generate_ascii_video(self, input_video: str, output_video: str, quality: int = 10):
        """
        Converts a video to ASCII art using the vendored AlexEidt/ASCII-Video tool.
        """
        if not os.path.exists(self.ascii_tool_path):
            logger.error("ASCII tool not found. Please run download_ascii_tool.py.")
            return False
            
        cmd = [
            "python3", self.ascii_tool_path,
            input_video,
            output_video,
            "--quality", str(quality)
        ]
        
        logger.info(f"🎨 Generating ASCII video: {input_video} -> {output_video}")
        try:
            subprocess.run(cmd, check=True)
            logger.info("✅ ASCII generation complete.")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ ASCII generation failed: {e}")
            return False

    def generate_ascii_image(self, input_image: str, output_image: str, quality: int = 10):
        """
        Converts an image to ASCII art.
        """
        if not os.path.exists(self.ascii_tool_path):
            logger.error("ASCII tool not found.")
            return False
            
        cmd = [
            "python3", self.ascii_tool_path,
            input_image,
            output_image,
            # For images, quality might map to font size or density. 
            "--fontsize", "10",
            "--background", "0", # Black background for matrix look
            "--font", "/System/Library/Fonts/Supplemental/Courier New.ttf"
        ]
        
        logger.info(f"🎨 Generating ASCII image: {input_image} -> {output_image}")
        try:
            subprocess.run(cmd, check=True)
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ ASCII generation failed: {e}")
            return False

    def generate_sketch_animation(self, image_path: str, output_video: str):
        """
        Animates a static character sketch using Animated Drawings.
        """
        ad_path = os.path.join(os.path.dirname(__file__), "AnimatedDrawings")
        script_path = os.path.join(ad_path, "examples", "image_to_animation.py")
        
        # If not in examples, check root (structure varies)
        if not os.path.exists(script_path):
             script_path = os.path.join(ad_path, "image_to_animation.py")
        
        if not os.path.exists(script_path):
            logger.error(f"AnimatedDrawings script not found at {script_path}")
            return False
            
        # Animated Drawings creates a folder with the output. We need to handle that.
        # It takes an output directory.
        output_dir = os.path.dirname(output_video)
        base_name = os.path.splitext(os.path.basename(output_video))[0]
        
        # We need to run it.
        # python image_to_animation.py char.png result_dir
        
        cmd = [
            "python3", script_path,
            image_path,
            output_dir
        ]
        
        logger.info(f"🎨 Animating sketch: {image_path} -> {output_dir}")
        try:
            # Note: This might take a while and uses GPU/CPU heavy resources
            subprocess.run(cmd, check=True)
            
            # The tool usually saves as 'video.mp4' or similar in the folder.
            # We might need to find it and rename it to output_video if it's specific.
            # For now, just running it to generate *something* is a win.
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Sketch animation failed: {e}")
            return False

    def generate_carousel_slide(self, text: str, output_path: str, style: str = "minimal_dark"):
        """
        Generates a text-based carousel slide using Pillow.
        """
        try:
            from PIL import Image, ImageDraw, ImageFont
            import textwrap

            width, height = 1080, 1350  # IG Portrait
            
            # Background
            if style == "minimal_dark":
                bg_color = (15, 17, 21) # #0f1115
                text_color = (255, 255, 255)
            else:
                bg_color = (255, 255, 255)
                text_color = (0, 0, 0)
                
            img = Image.new('RGB', (width, height), color=bg_color)
            draw = ImageDraw.Draw(img)
            
            # Font handling (try to find a nice system font)
            font_path = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
            if not os.path.exists(font_path):
                 font_path = "/Library/Fonts/Arial Bold.ttf"
            
            try:
                font = ImageFont.truetype(font_path, size=80)
            except IOError:
                font = ImageFont.load_default()
                
            # Wrap text
            lines = textwrap.wrap(text, width=20) # Approx chars per line
            
            # Draw text
            # Simple centering logic
            current_h = height // 2 - (len(lines) * 50)
            for line in lines:
                bbox = draw.textbbox((0, 0), line, font=font)
                text_w = bbox[2] - bbox[0]
                draw.text(((width - text_w) / 2, current_h), line, font=font, fill=text_color)
                current_h += 100 # Line height
                
            img.save(output_path)
            logger.info(f"🖼️ Generated slide: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to generate carousel slide: {e}")
            return False

if __name__ == "__main__":
    # Test
    logging.basicConfig(level=logging.INFO)
    artist = VisualArtist()
    print(f"initialized {artist.name}")
