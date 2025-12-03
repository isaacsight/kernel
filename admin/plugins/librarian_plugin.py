from admin.plugins import Plugin
from admin.engineers.librarian import Librarian
import logging
import os

logger = logging.getLogger("LibrarianPlugin")

class LibrarianPlugin(Plugin):
    def __init__(self):
        super().__init__("LibrarianPlugin")
        self.librarian = Librarian()
        self.posts_metadata = []

    def on_post_process(self, post_metadata, content):
        """
        Collects metadata for the graph.
        """
        # Only collect actual posts
        if 'slug' in post_metadata and post_metadata['slug'] not in ['about', 'consulting']:
            self.posts_metadata.append(post_metadata)

    def on_post_build(self, output_dir):
        """
        Builds and exports the Knowledge Graph.
        """
        self.librarian.build_graph(self.posts_metadata)
        
        # Save to static/graph.json
        # output_dir is 'docs'
        graph_path = os.path.join(output_dir, 'static', 'graph.json')
        self.librarian.export_graph(graph_path)
