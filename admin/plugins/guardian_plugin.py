from admin.plugins import Plugin
from admin.engineers.guardian import Guardian
import logging

logger = logging.getLogger("GuardianPlugin")

class GuardianPlugin(Plugin):
    def __init__(self):
        super().__init__("GuardianPlugin")
        self.guardian = Guardian()

    def on_post_process(self, post_metadata, content):
        """
        Audits the post content for safety.
        """
        title = post_metadata.get('title', 'Untitled')
        issues = self.guardian.audit_content(content)
        
        for issue in issues:
            msg = f"Safety Issue in '{title}': {issue['message']}"
            if issue['level'] == 'CRITICAL':
                logger.error(msg)
                # In a real scenario, we might raise an exception to stop the build
                # raise Exception(msg) 
            else:
                logger.warning(msg)

    def on_post_build(self, output_dir):
        """
        Audits build artifacts (e.g. feed.xml).
        """
        import os
        
        # Audit RSS Feed
        feed_path = os.path.join(output_dir, 'feed.xml')
        if os.path.exists(feed_path):
            with open(feed_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            issues = self.guardian.audit_xml(content)
            for issue in issues:
                msg = f"Guardian Validation Failed for feed.xml: {issue['message']}"
                logger.error(msg)
                # Fail the build if XML is invalid
                raise Exception(msg)
        else:
             logger.warning("Guardian could not find feed.xml to validate.")
