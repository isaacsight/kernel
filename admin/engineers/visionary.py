import logging
import os
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger("Visionary")

class Visionary:
    """
    The Visionary (Computer Vision Engineer)
    
    Mission: Ensure visual excellence and handle multimodal content.
    
    Responsibilities:
    - Visual Regression Testing
    - Image Generation (Open Graph)
    - Design System Analysis
    """
    def __init__(self):
        self.name = "The Visionary"
        self.role = "Computer Vision Engineer"
        self.static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../static'))
        self.og_dir = os.path.join(self.static_dir, 'images', 'og')
        os.makedirs(self.og_dir, exist_ok=True)

    def generate_og_image(self, title, slug):
        """
        Generates a branded Open Graph image for the post.
        """
        output_path = os.path.join(self.og_dir, f"{slug}.jpg")
        
        # Skip if exists (for now)
        if os.path.exists(output_path):
            return f"static/images/og/{slug}.jpg"

        logger.info(f"Generating OG image for: {title}")
        
        # Create base image (1200x630 is standard for OG)
        width, height = 1200, 630
        # Use a nice dark background color from the theme
        bg_color = (20, 20, 20) # #141414
        image = Image.new('RGB', (width, height), bg_color)
        draw = ImageDraw.Draw(image)
        
        # Draw some "Studio" accents
        # A subtle border
        draw.rectangle([20, 20, width-20, height-20], outline=(50, 50, 50), width=2)
        
        # Add Title
        # Try to load a font, fallback to default
        try:
            # Try to find a system font or use a default
            font = ImageFont.truetype("Arial.ttf", 60)
        except:
            font = ImageFont.load_default()
            
        # Wrap text
        lines = []
        words = title.split()
        current_line = []
        for word in words:
            current_line.append(word)
            # Simple length check (approximate)
            if len(" ".join(current_line)) > 25: 
                lines.append(" ".join(current_line[:-1]))
                current_line = [word]
        lines.append(" ".join(current_line))
        
        # Draw text centered
        y = 200
        for line in lines:
            # Calculate text width (approximate for default font)
            # For TrueType we would use font.getlength(line)
            # Let's just left align with padding for safety
            draw.text((100, y), line, font=font, fill=(255, 255, 255))
            y += 80
            
        # Add Brand
        draw.text((100, height - 100), "DOES THIS FEEL RIGHT?", font=font, fill=(150, 150, 150))

        # Save
        image.save(output_path, quality=90)
        return f"static/images/og/{slug}.jpg"

    def audit_visuals(self, html_content):
        """
        Checks for broken images or missing alt text.
        """
        issues = []
        if "<img" in html_content and "alt=" not in html_content:
             issues.append("Found images without alt text.")
        return issues

    def dream(self):
        """
        Analyzes the system and proposes a high-level 'Mission' for evolution.
        """
        logger.info("Dreaming of a better future...")
        
        # In a real system, this would analyze logs, user feedback, and code stats.
        # For now, we will simulate this by picking from a list of potential improvements.
        import random
        
        potential_missions = [
            "Refactor admin/core.py to improve readability and modularity.",
            "Add a new API endpoint to admin/api/main.py for retrieving system health stats.",
            "Optimize the image generation process in admin/engineers/visionary.py.",
            "Enhance the logging format in admin/engineers/operator.py for better debugging.",
            "Add a new safety check to admin/engineers/guardian.py for SQL injection prevention."
        ]
        
        mission = random.choice(potential_missions)
        logger.info(f"Proposed Mission: {mission}")
        return mission