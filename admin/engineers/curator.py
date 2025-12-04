"""
The Curator - Content Curator Agent

Organizes content into collections, suggests related posts, and maintains content cohesion.
"""

import os
import sys
import json
import logging
from typing import Dict, List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from config import config

logger = logging.getLogger("Curator")


class Curator:
    """
    The Curator (Content Curator)
    
    Mission: Organize and connect content for maximum discoverability.
    
    Responsibilities:
    - Create and manage content collections
    - Suggest related posts
    - Maintain content taxonomy
    - Identify content gaps
    """
    
    def __init__(self):
        self.name = "The Curator"
        self.role = "Content Curator"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.node_url = config.STUDIO_NODE_URL
        self.content_dir = config.CONTENT_DIR
        self.collections_file = os.path.join(
            os.path.dirname(__file__), '..', 'brain', 'collections.json'
        )
        self.collections = self._load_collections()
        
    def _load_collections(self) -> Dict:
        """Load existing collections."""
        if os.path.exists(self.collections_file):
            try:
                with open(self.collections_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {"collections": {}, "suggested_series": []}
    
    def _save_collections(self):
        """Save collections to disk."""
        with open(self.collections_file, 'w') as f:
            json.dump(self.collections, f, indent=2)
    
    def create_collection(self, name: str, description: str, posts: List[str]) -> Dict:
        """
        Creates a new content collection.
        """
        collection = {
            "name": name,
            "description": description,
            "posts": posts,
            "created_at": __import__('datetime').datetime.now().isoformat()
        }
        
        self.collections["collections"][name] = collection
        self._save_collections()
        
        self.metrics.track_agent_action(self.name, 'create_collection', True, 0)
        logger.info(f"[{self.name}] Created collection: {name}")
        
        return collection
    
    def find_related_posts(self, post_slug: str, limit: int = 5) -> List[Dict]:
        """
        Finds posts related to a given post using the Studio Node.
        """
        import frontmatter
        
        logger.info(f"[{self.name}] Finding posts related to: {post_slug}")
        
        # Load the source post
        source_path = os.path.join(self.content_dir, f"{post_slug}.md")
        if not os.path.exists(source_path):
            return []
        
        with open(source_path, 'r') as f:
            source = frontmatter.load(f)
        
        source_tags = set(source.get('tags', []))
        source_category = source.get('category', '')
        source_excerpt = source.content[:500]
        
        # Load all posts
        all_posts = []
        for filename in os.listdir(self.content_dir):
            if filename.endswith('.md') and filename != f"{post_slug}.md":
                try:
                    with open(os.path.join(self.content_dir, filename), 'r') as f:
                        post = frontmatter.load(f)
                    all_posts.append({
                        'slug': filename.replace('.md', ''),
                        'title': post.get('title', 'Untitled'),
                        'tags': set(post.get('tags', [])),
                        'category': post.get('category', ''),
                        'excerpt': post.content[:200]
                    })
                except:
                    continue
        
        # Score posts by relevance
        scored = []
        for post in all_posts:
            score = 0
            # Tag overlap
            tag_overlap = len(source_tags.intersection(post['tags']))
            score += tag_overlap * 2
            # Same category
            if post['category'] == source_category:
                score += 3
            
            scored.append((score, post))
        
        # Sort by score and return top matches
        scored.sort(key=lambda x: x[0], reverse=True)
        related = [{'slug': p['slug'], 'title': p['title'], 'score': s} 
                   for s, p in scored[:limit] if s > 0]
        
        self.metrics.track_agent_action(self.name, 'find_related', True, 0)
        return related
    
    def suggest_series(self) -> List[Dict]:
        """
        Analyzes content to suggest post series.
        """
        import frontmatter
        
        logger.info(f"[{self.name}] Analyzing content for series opportunities...")
        
        # Group posts by category and tags
        by_category = {}
        by_theme = {}
        
        for filename in os.listdir(self.content_dir):
            if filename.endswith('.md'):
                try:
                    with open(os.path.join(self.content_dir, filename), 'r') as f:
                        post = frontmatter.load(f)
                    
                    cat = post.get('category', 'Uncategorized')
                    if cat not in by_category:
                        by_category[cat] = []
                    by_category[cat].append(post.get('title', filename))
                    
                    for tag in post.get('tags', []):
                        if tag not in by_theme:
                            by_theme[tag] = []
                        by_theme[tag].append(post.get('title', filename))
                except:
                    continue
        
        # Suggest series from categories with 3+ posts
        suggestions = []
        for cat, posts in by_category.items():
            if len(posts) >= 3:
                suggestions.append({
                    'series_name': f"Deep Dive: {cat}",
                    'based_on': 'category',
                    'post_count': len(posts),
                    'sample_posts': posts[:3]
                })
        
        # Suggest series from themes with 3+ posts
        for theme, posts in by_theme.items():
            if len(posts) >= 3:
                suggestions.append({
                    'series_name': f"Exploring {theme.title()}",
                    'based_on': 'tag',
                    'post_count': len(posts),
                    'sample_posts': posts[:3]
                })
        
        self.collections["suggested_series"] = suggestions
        self._save_collections()
        
        return suggestions[:10]  # Top 10 suggestions
    
    def get_content_gaps(self) -> List[str]:
        """
        Uses Studio Node to identify content gaps.
        """
        import frontmatter
        
        # Get existing topics
        existing = []
        for filename in os.listdir(self.content_dir):
            if filename.endswith('.md'):
                try:
                    with open(os.path.join(self.content_dir, filename), 'r') as f:
                        post = frontmatter.load(f)
                    existing.append(post.get('title', ''))
                except:
                    continue
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Given these existing blog post titles:
                {existing[:20]}
                
                What topics are MISSING that would complete this content library?
                Return ONLY a JSON array of 5 suggested topics.
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=30
                )
                response.raise_for_status()
                result = response.json().get("response", "")
                
                if "[" in result and "]" in result:
                    json_str = result[result.find("["):result.rfind("]")+1]
                    return json.loads(json_str)
                    
            except Exception as e:
                logger.warning(f"[{self.name}] Studio Node request failed: {e}")
        
        return ["Consider adding more diverse topics"]


if __name__ == "__main__":
    curator = Curator()
    print("Suggested Series:", curator.suggest_series())
