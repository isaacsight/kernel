from admin.plugins import Plugin
from admin.engineers.visionary import Visionary
import logging

logger = logging.getLogger("VisualQAPlugin")

class VisualQAPlugin(Plugin):
    def __init__(self):
        super().__init__("VisualQAPlugin")
        self.visionary = Visionary()

    def on_post_process(self, post_metadata, content):
        """
        Checks for visual assets and generates them if missing.
        """
        slug = post_metadata.get('slug')
        title = post_metadata.get('title', 'Untitled')
        
        # Check if OG image exists in metadata
        if 'image' not in post_metadata or not post_metadata['image']:
            logger.info(f"Missing OG image for '{title}'. Requesting generation...")
            try:
                image_path = self.visionary.generate_og_image(title, slug)
                post_metadata['image'] = image_path # Update metadata in memory for the build
                logger.info(f"Generated: {image_path}")
            except Exception as e:
                logger.error(f"Failed to generate image for '{title}': {e}")

        # Audit content
        issues = self.visionary.audit_visuals(content)
        for issue in issues:
            logger.warning(f"Visual Issue in '{title}': {issue}")
