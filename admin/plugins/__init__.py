class Plugin:
    """
    Base class for all Studio OS plugins.
    """
    def __init__(self, name):
        self.name = name

    def on_pre_build(self):
        """Called before the build process starts."""
        pass

    def on_post_process(self, post_metadata, content):
        """Called after a post is processed but before writing."""
        pass

    def on_post_build(self, output_dir):
        """Called after the build is complete."""
        pass
