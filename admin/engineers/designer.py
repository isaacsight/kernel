"""
The Designer - Visual Designer Agent

Generates images, thumbnails, and visual content using Studio Node.
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

logger = logging.getLogger("Designer")


class Designer:
    """
    The Designer (Visual Designer)
    
    Mission: Create compelling visual content that enhances the blog.
    
    Responsibilities:
    - Generate featured images for posts
    - Create social media graphics
    - Design thumbnails and banners
    - Maintain visual consistency
    """
    
    def __init__(self):
        self.name = "The Designer"
        self.role = "Visual Designer"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.node_url = config.STUDIO_NODE_URL
        self.static_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), '../../static')
        )
        self.images_dir = os.path.join(self.static_dir, 'images', 'generated')
        os.makedirs(self.images_dir, exist_ok=True)
        
        # Brand colors
        self.brand_colors = {
            "primary": "#1a1a1a",
            "secondary": "#333333",
            "accent": "#646cff",
            "text": "#ffffff",
            "muted": "#888888"
        }
        
    def generate_image_prompt(self, title: str, theme: str = "minimal") -> str:
        """
        Generates an image prompt based on the post title.
        """
        logger.info(f"[{self.name}] Creating image prompt for: {title}")
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Create a single, detailed image generation prompt for a blog post titled:
                "{title}"
                
                Style: {theme} aesthetic, modern, professional
                Guidelines:
                - Abstract or symbolic representation
                - No text in the image
                - Dark, moody color palette
                - Suitable for a thoughtful, reflective blog
                
                Return ONLY the image prompt, nothing else.
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=30
                )
                response.raise_for_status()
                image_prompt = response.json().get("response", "").strip()
                
                self.metrics.track_agent_action(self.name, 'generate_prompt', True, 0)
                return image_prompt
                
            except Exception as e:
                logger.warning(f"[{self.name}] Prompt generation failed: {e}")
        
        return f"Abstract minimalist illustration representing the concept of {title.lower()}, dark moody colors, modern aesthetic"
    
    def create_placeholder_image(self, slug: str, title: str, 
                                  size: tuple = (1200, 630)) -> str:
        """
        Creates a styled placeholder image using PIL.
        """
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ImportError:
            return ""
        
        width, height = size
        
        # Create gradient background
        image = Image.new('RGB', (width, height), self.brand_colors["primary"])
        draw = ImageDraw.Draw(image)
        
        # Add subtle gradient effect
        for i in range(height):
            alpha = int(30 * (i / height))
            draw.line([(0, i), (width, i)], fill=(30 + alpha, 30 + alpha, 35 + alpha))
        
        # Add decorative elements
        accent_color = (100, 108, 255)  # #646cff
        draw.rectangle([40, 40, width-40, height-40], outline=accent_color, width=2)
        
        # Add title text
        try:
            font = ImageFont.truetype("Arial.ttf", 48)
            small_font = ImageFont.truetype("Arial.ttf", 24)
        except:
            font = ImageFont.load_default()
            small_font = font
        
        # Wrap title
        words = title.split()
        lines = []
        current_line = []
        for word in words:
            current_line.append(word)
            if len(" ".join(current_line)) > 30:
                lines.append(" ".join(current_line[:-1]))
                current_line = [word]
        lines.append(" ".join(current_line))
        
        y = height // 2 - (len(lines) * 30)
        for line in lines:
            draw.text((80, y), line, font=font, fill=(255, 255, 255))
            y += 60
        
        # Add branding
        draw.text((80, height - 80), "DOES THIS FEEL RIGHT?", 
                  font=small_font, fill=(136, 136, 136))
        
        # Save
        output_path = os.path.join(self.images_dir, f"{slug}.jpg")
        image.save(output_path, quality=90)
        
        logger.info(f"[{self.name}] Created image: {output_path}")
        return f"static/images/generated/{slug}.jpg"
    
    def create_social_graphic(self, title: str, platform: str = "twitter") -> str:
        """
        Creates a social media graphic.
        """
        sizes = {
            "twitter": (1200, 675),
            "instagram": (1080, 1080),
            "linkedin": (1200, 627),
            "pinterest": (1000, 1500)
        }
        
        size = sizes.get(platform, (1200, 630))
        slug = title.lower().replace(" ", "-")[:30]
        
        return self.create_placeholder_image(f"{slug}-{platform}", title, size)
    
    def get_color_palette(self, theme: str = "calm") -> Dict:
        """
        Returns a color palette based on the theme.
        """
        palettes = {
            "calm": {
                "background": "#1a1a2e",
                "primary": "#16213e",
                "secondary": "#0f3460",
                "accent": "#e94560"
            },
            "minimal": {
                "background": "#0a0a0a",
                "primary": "#1a1a1a",
                "secondary": "#2a2a2a",
                "accent": "#ffffff"
            },
            "warm": {
                "background": "#2d1f1f",
                "primary": "#3d2929",
                "secondary": "#5c4033",
                "accent": "#d4a574"
            },
            "cool": {
                "background": "#0d1b2a",
                "primary": "#1b263b",
                "secondary": "#415a77",
                "accent": "#778da9"
            }
        }
        
        return palettes.get(theme, palettes["minimal"])
    
    def suggest_visual_style(self, content: str) -> Dict:
        """
        Suggests visual style based on content.
        """
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Analyze this content and suggest a visual style:
                
                Content: {content[:500]}
                
                Return JSON with:
                {{
                    "theme": "calm/minimal/warm/cool",
                    "color_mood": "description",
                    "imagery_suggestions": ["suggestion1", "suggestion2"],
                    "typography_style": "serif/sans-serif/mixed"
                }}
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=30
                )
                response.raise_for_status()
                result = response.json().get("response", "")
                
                if "{" in result:
                    json_str = result[result.find("{"):result.rfind("}")+1]
                    return json.loads(json_str)
                    
            except Exception as e:
                logger.warning(f"[{self.name}] Style suggestion failed: {e}")
        
        return {
            "theme": "minimal",
            "color_mood": "dark and contemplative",
            "imagery_suggestions": ["abstract gradients", "subtle textures"],
            "typography_style": "sans-serif"
        }


if __name__ == "__main__":
    designer = Designer()
    
    # Test prompt generation
    prompt = designer.generate_image_prompt("Finding Peace in Digital Chaos")
    print("Image Prompt:", prompt)
    
    # Test image creation
    path = designer.create_placeholder_image(
        "test-image", 
        "The Art of Digital Minimalism"
    )
    print("Created:", path)
