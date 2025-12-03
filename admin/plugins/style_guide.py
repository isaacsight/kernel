from admin.plugins import Plugin
from admin.engineers.editor import Editor
import logging

logger = logging.getLogger("StyleGuidePlugin")

class StyleGuidePlugin(Plugin):
    def __init__(self):
        super().__init__("StyleGuidePlugin")
        self.editor = Editor()

    def on_post_process(self, post_metadata, content):
        """
        Audits the post content using The Editor.
        """
        slug = post_metadata.get('slug', 'unknown')
        title = post_metadata.get('title', 'Untitled')
        
        # Skip non-post pages if needed, but let's check everything for now
        if slug in ['about', 'consulting']:
            return

        issues = self.editor.audit(content)
        
        if issues:
            logger.warning(f"Style Violations in '{title}' ({slug}):")
            for issue in issues:
                logger.warning(f"  - {issue}")
        else:
            logger.info(f"'{title}' passed style audit.")
