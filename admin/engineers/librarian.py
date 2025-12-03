import logging
import os
import json
import networkx as nx
from networkx.readwrite import json_graph

logger = logging.getLogger("Librarian")

class Librarian:
    """
    The Librarian (Data Scientist)
    
    Mission: Organize knowledge for discoverability and interconnectedness.
    
    Responsibilities:
    - Knowledge Graphs
    - Taxonomy Generation
    - Content Analytics
    """
    def __init__(self):
        self.name = "The Librarian"
        self.role = "Data Scientist"
        self.graph = nx.Graph()

    def build_graph(self, posts_metadata):
        """
        Constructs a knowledge graph from a list of post metadata.
        Nodes: Posts, Tags, Categories
        Edges: Post -> Tag, Post -> Category
        """
        logger.info(f"Building Knowledge Graph from {len(posts_metadata)} posts...")
        self.graph.clear()
        
        for post in posts_metadata:
            slug = post.get('slug')
            title = post.get('title', 'Untitled')
            category = post.get('category', 'General')
            tags = post.get('tags', [])
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(',') if t.strip()]
            elif not isinstance(tags, list):
                tags = []
            
            # Add Post Node
            self.graph.add_node(slug, type='post', title=title, label=title)
            
            # Add Category Node & Edge
            cat_id = f"cat:{category}"
            self.graph.add_node(cat_id, type='category', label=category)
            self.graph.add_edge(slug, cat_id)
            
            # Add Tag Nodes & Edges
            for tag in tags:
                tag = tag.strip()
                if not tag: continue
                tag_id = f"tag:{tag}"
                self.graph.add_node(tag_id, type='tag', label=tag)
                self.graph.add_edge(slug, tag_id)
                
        logger.info(f"Graph built: {self.graph.number_of_nodes()} nodes, {self.graph.number_of_edges()} edges.")

    def export_graph(self, output_path):
        """
        Exports the graph to a JSON file compatible with D3.js or similar.
        """
        data = json_graph.node_link_data(self.graph)
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
        logger.info(f"Knowledge Graph exported to {output_path}")