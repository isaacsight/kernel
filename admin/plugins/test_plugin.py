from admin.plugins import Plugin
import logging

logger = logging.getLogger("TestPlugin")

class TestPlugin(Plugin):
    def __init__(self):
        super().__init__("TestPlugin")

    def on_pre_build(self):
        print("[TestPlugin] Pre-build hook fired!")

    def on_post_process(self, post_metadata, content):
        # Only print for one post to avoid spam
        if post_metadata.get('slug') == 'about':
            print(f"[TestPlugin] Processed post: {post_metadata.get('title')}")

    def on_post_build(self, output_dir):
        print(f"[TestPlugin] Post-build hook fired! Output dir: {output_dir}")
