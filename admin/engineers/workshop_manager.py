"""
Workshop Manager - Shareable Templates and Configurations

Inspired by Steam Workshop.
Manages shareable prompt templates, agent configs, and workflows.
"""

import os
import json
import logging
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Any

logger = logging.getLogger("WorkshopManager")


class WorkshopManager:
    """
    The Workshop Manager (Template Curator)
    
    Mission: Enable creation, sharing, and usage of templates,
    configurations, and workflows.
    
    Inspired by Steam Workshop's user-generated content system.
    
    Content Types:
    - Prompt Templates (for The Alchemist)
    - Agent Personas (custom configurations)
    - Workflows (multi-agent pipelines)
    - Themes (CSS/design presets)
    """
    
    def __init__(self):
        self.name = "The Workshop Manager"
        self.role = "Template Curator"
        self.emoji = "🛠️"
        
        # Storage paths
        self.workshop_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'workshop'
        )
        
        # Subdirectories for different content types
        self.dirs = {
            "prompts": os.path.join(self.workshop_dir, "prompts"),
            "personas": os.path.join(self.workshop_dir, "personas"),
            "workflows": os.path.join(self.workshop_dir, "workflows"),
            "themes": os.path.join(self.workshop_dir, "themes")
        }
        
        # Ensure directories exist
        for dir_path in self.dirs.values():
            os.makedirs(dir_path, exist_ok=True)
        
        # Subscriptions/favorites
        self.subs_file = os.path.join(self.workshop_dir, "subscriptions.json")
        self.subscriptions = self._load_subscriptions()
        
        logger.info(f"[{self.name}] Initialized with {sum(self._count_items().values())} workshop items")
    
    def _load_subscriptions(self) -> Dict:
        """Load subscription data."""
        if os.path.exists(self.subs_file):
            try:
                with open(self.subs_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {"subscribed": [], "favorites": []}
    
    def _save_subscriptions(self):
        """Save subscription data."""
        with open(self.subs_file, 'w') as f:
            json.dump(self.subscriptions, f, indent=2)
    
    def _count_items(self) -> Dict[str, int]:
        """Count items in each category."""
        counts = {}
        for category, path in self.dirs.items():
            if os.path.exists(path):
                counts[category] = len([f for f in os.listdir(path) if f.endswith('.json')])
            else:
                counts[category] = 0
        return counts
    
    def publish(
        self,
        item_type: str,
        name: str,
        content: Dict,
        description: str = "",
        tags: List[str] = None,
        author: str = "anonymous"
    ) -> Dict:
        """
        Publish an item to the workshop.
        
        Args:
            item_type: One of 'prompts', 'personas', 'workflows', 'themes'
            name: Display name
            content: The actual content/configuration
            description: Description of what it does
            tags: Searchable tags
            author: Author name
            
        Returns: Published item metadata
        """
        if item_type not in self.dirs:
            return {"success": False, "error": f"Invalid item type: {item_type}"}
        
        # Generate ID
        item_id = hashlib.md5(f"{name}{datetime.now().isoformat()}".encode()).hexdigest()[:12]
        
        # Create item
        item = {
            "id": item_id,
            "type": item_type,
            "name": name,
            "description": description,
            "tags": tags or [],
            "author": author,
            "content": content,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "downloads": 0,
            "rating": 0,
            "ratings_count": 0
        }
        
        # Save to file
        file_path = os.path.join(self.dirs[item_type], f"{item_id}.json")
        with open(file_path, 'w') as f:
            json.dump(item, f, indent=2)
        
        logger.info(f"[{self.name}] Published '{name}' ({item_type})")
        
        return {
            "success": True,
            "id": item_id,
            "path": file_path,
            "item": item
        }
    
    def get_item(self, item_type: str, item_id: str) -> Optional[Dict]:
        """Get a specific workshop item."""
        if item_type not in self.dirs:
            return None
        
        file_path = os.path.join(self.dirs[item_type], f"{item_id}.json")
        
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                return json.load(f)
        
        return None
    
    def list_items(
        self,
        item_type: str = None,
        tags: List[str] = None,
        search: str = None,
        sort_by: str = "created_at"
    ) -> List[Dict]:
        """
        List workshop items with optional filters.
        
        Args:
            item_type: Filter by type
            tags: Filter by tags
            search: Search in name/description
            sort_by: Sort field
        """
        items = []
        
        types_to_search = [item_type] if item_type else self.dirs.keys()
        
        for t in types_to_search:
            dir_path = self.dirs.get(t)
            if not dir_path or not os.path.exists(dir_path):
                continue
            
            for filename in os.listdir(dir_path):
                if not filename.endswith('.json'):
                    continue
                
                file_path = os.path.join(dir_path, filename)
                try:
                    with open(file_path, 'r') as f:
                        item = json.load(f)
                    
                    # Apply filters
                    if tags:
                        if not any(t in item.get("tags", []) for t in tags):
                            continue
                    
                    if search:
                        search_lower = search.lower()
                        if (search_lower not in item.get("name", "").lower() and
                            search_lower not in item.get("description", "").lower()):
                            continue
                    
                    items.append(item)
                except:
                    continue
        
        # Sort
        items.sort(key=lambda x: x.get(sort_by, ""), reverse=True)
        
        return items
    
    def subscribe(self, item_id: str) -> bool:
        """Subscribe to a workshop item."""
        if item_id not in self.subscriptions["subscribed"]:
            self.subscriptions["subscribed"].append(item_id)
            self._save_subscriptions()
            return True
        return False
    
    def unsubscribe(self, item_id: str) -> bool:
        """Unsubscribe from a workshop item."""
        if item_id in self.subscriptions["subscribed"]:
            self.subscriptions["subscribed"].remove(item_id)
            self._save_subscriptions()
            return True
        return False
    
    def favorite(self, item_id: str) -> bool:
        """Add item to favorites."""
        if item_id not in self.subscriptions["favorites"]:
            self.subscriptions["favorites"].append(item_id)
            self._save_subscriptions()
            return True
        return False
    
    def get_subscribed(self) -> List[Dict]:
        """Get all subscribed items."""
        items = []
        for item_id in self.subscriptions["subscribed"]:
            # Search all types
            for item_type in self.dirs.keys():
                item = self.get_item(item_type, item_id)
                if item:
                    items.append(item)
                    break
        return items
    
    def use_prompt_template(self, item_id: str, variables: Dict = None) -> str:
        """
        Use a prompt template with variable substitution.
        
        Args:
            item_id: Template ID
            variables: Dict of variable substitutions
            
        Returns: Rendered prompt
        """
        item = self.get_item("prompts", item_id)
        if not item:
            return None
        
        template = item.get("content", {}).get("template", "")
        
        if variables:
            for key, value in variables.items():
                template = template.replace(f"{{{{{key}}}}}", str(value))
        
        # Increment downloads
        self._increment_downloads("prompts", item_id)
        
        return template
    
    def apply_persona(self, item_id: str) -> Dict:
        """
        Get a persona configuration to apply to an agent.
        """
        item = self.get_item("personas", item_id)
        if not item:
            return None
        
        self._increment_downloads("personas", item_id)
        return item.get("content", {})
    
    def _increment_downloads(self, item_type: str, item_id: str):
        """Increment download count for an item."""
        file_path = os.path.join(self.dirs[item_type], f"{item_id}.json")
        
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                item = json.load(f)
            
            item["downloads"] = item.get("downloads", 0) + 1
            
            with open(file_path, 'w') as f:
                json.dump(item, f, indent=2)
    
    # ============================================================
    # Steam-Inspired Community Features
    # ============================================================
    
    def rate_item(self, item_id: str, rating: int, reviewer: str = "anonymous") -> Dict:
        """
        Rate a workshop item (1-5 stars).
        
        Inspired by Steam's rating system.
        """
        if rating < 1 or rating > 5:
            return {"success": False, "error": "Rating must be 1-5"}
        
        # Find the item across all types
        for item_type in self.dirs.keys():
            item = self.get_item(item_type, item_id)
            if item:
                file_path = os.path.join(self.dirs[item_type], f"{item_id}.json")
                
                # Initialize ratings list if needed
                if "ratings" not in item:
                    item["ratings"] = []
                
                # Add or update rating
                existing = next((r for r in item["ratings"] if r["reviewer"] == reviewer), None)
                if existing:
                    existing["rating"] = rating
                    existing["updated_at"] = datetime.now().isoformat()
                else:
                    item["ratings"].append({
                        "reviewer": reviewer,
                        "rating": rating,
                        "created_at": datetime.now().isoformat()
                    })
                
                # Recalculate average
                total = sum(r["rating"] for r in item["ratings"])
                item["rating"] = round(total / len(item["ratings"]), 2)
                item["ratings_count"] = len(item["ratings"])
                
                with open(file_path, 'w') as f:
                    json.dump(item, f, indent=2)
                
                logger.info(f"[{self.name}] ⭐ {reviewer} rated '{item['name']}' {rating}/5")
                return {"success": True, "new_average": item["rating"], "total_ratings": item["ratings_count"]}
        
        return {"success": False, "error": "Item not found"}
    
    def add_comment(self, item_id: str, comment: str, author: str = "anonymous") -> Dict:
        """
        Add a comment/discussion to a workshop item.
        
        Inspired by Steam Workshop discussions.
        """
        for item_type in self.dirs.keys():
            item = self.get_item(item_type, item_id)
            if item:
                file_path = os.path.join(self.dirs[item_type], f"{item_id}.json")
                
                if "comments" not in item:
                    item["comments"] = []
                
                comment_id = hashlib.md5(f"{comment}{datetime.now().isoformat()}".encode()).hexdigest()[:8]
                
                item["comments"].append({
                    "id": comment_id,
                    "author": author,
                    "text": comment,
                    "created_at": datetime.now().isoformat(),
                    "helpful_votes": 0
                })
                
                with open(file_path, 'w') as f:
                    json.dump(item, f, indent=2)
                
                logger.info(f"[{self.name}] 💬 {author} commented on '{item['name']}'")
                return {"success": True, "comment_id": comment_id, "total_comments": len(item["comments"])}
        
        return {"success": False, "error": "Item not found"}
    
    def get_popular(self, limit: int = 10) -> List[Dict]:
        """
        Get trending/popular workshop items by downloads and rating.
        
        Inspired by Steam's Popular/Trending section.
        """
        all_items = self.list_items()
        
        # Score = downloads * rating (weighted popularity)
        for item in all_items:
            downloads = item.get("downloads", 0)
            rating = item.get("rating", 0)
            item["_popularity_score"] = downloads * (rating if rating > 0 else 1)
        
        all_items.sort(key=lambda x: x.get("_popularity_score", 0), reverse=True)
        
        # Clean up temp score
        for item in all_items[:limit]:
            item.pop("_popularity_score", None)
        
        return all_items[:limit]
    
    def get_featured(self) -> List[Dict]:
        """
        Get curated/featured workshop items.
        
        Returns items with high ratings (4+) and multiple downloads.
        """
        all_items = self.list_items()
        
        featured = [
            item for item in all_items
            if item.get("rating", 0) >= 4 and item.get("downloads", 0) >= 3
        ]
        
        return featured[:5]  # Top 5 featured
    
    def get_item_stats(self, item_id: str) -> Optional[Dict]:
        """
        Get detailed stats for a workshop item.
        """
        for item_type in self.dirs.keys():
            item = self.get_item(item_type, item_id)
            if item:
                return {
                    "name": item.get("name"),
                    "downloads": item.get("downloads", 0),
                    "rating": item.get("rating", 0),
                    "ratings_count": item.get("ratings_count", 0),
                    "comments_count": len(item.get("comments", [])),
                    "created_at": item.get("created_at"),
                    "author": item.get("author")
                }
        return None


    def create_default_templates(self):
        """Create default workshop templates."""
        # Blog post prompt template
        self.publish(
            "prompts",
            "Reflective Blog Post",
            {
                "template": """Write a reflective blog post about {{topic}}.

Tone: Calm, warm, introspective
Style: Personal essay, first-person
Length: 800-1200 words

Structure:
1. Opening hook (personal observation)
2. Main insight
3. Supporting examples
4. Reflection on meaning
5. Question for the reader""",
                "variables": ["topic"]
            },
            description="A template for thoughtful, personal blog posts",
            tags=["blog", "personal", "reflective"],
            author="Studio OS"
        )
        
        # Technical post template
        self.publish(
            "prompts",
            "Technical How-To",
            {
                "template": """Write a technical guide about {{topic}}.

Audience: {{audience}}
Skill Level: {{skill_level}}

Structure:
1. What we're solving
2. Prerequisites
3. Step-by-step instructions
4. Code examples if applicable
5. Common pitfalls
6. Conclusion and next steps""",
                "variables": ["topic", "audience", "skill_level"]
            },
            description="Template for technical tutorials and guides",
            tags=["technical", "tutorial", "how-to"],
            author="Studio OS"
        )
        
        # Calm persona
        self.publish(
            "personas",
            "The Calm Observer",
            {
                "voice": "calm, measured, observational",
                "tone": "warm but not effusive",
                "perspective": "third-person observer with gentle insights",
                "avoid": ["exclamation marks", "urgency", "judgment"],
                "signature": "End with a gentle question"
            },
            description="A calm, observational persona for reflective writing",
            tags=["calm", "reflective", "gentle"],
            author="Studio OS"
        )
        
        logger.info(f"[{self.name}] Created default templates")
    
    def get_summary(self) -> Dict:
        """Get workshop summary."""
        counts = self._count_items()
        return {
            "total_items": sum(counts.values()),
            "by_type": counts,
            "subscribed": len(self.subscriptions["subscribed"]),
            "favorites": len(self.subscriptions["favorites"])
        }


# Singleton
_manager = None

def get_workshop_manager() -> WorkshopManager:
    """Get the global workshop manager instance."""
    global _manager
    if _manager is None:
        _manager = WorkshopManager()
    return _manager


if __name__ == "__main__":
    manager = WorkshopManager()
    
    print("=== Workshop Manager Test ===\n")
    print(f"Summary: {manager.get_summary()}")
    
    # Create defaults if empty
    if manager.get_summary()["total_items"] == 0:
        print("\nCreating default templates...")
        manager.create_default_templates()
    
    print(f"\nPrompts:")
    for item in manager.list_items("prompts"):
        print(f"  - {item['name']}: {item['description']}")
    
    print(f"\nPersonas:")
    for item in manager.list_items("personas"):
        print(f"  - {item['name']}: {item['description']}")
