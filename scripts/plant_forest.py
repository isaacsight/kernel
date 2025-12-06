import sys
import os
import time
import argparse
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
from admin.engineers.alchemist import Alchemist
from config import config

class ForestPlanter:
    def __init__(self, trees_to_plant=5, max_workers=2):
        self.alchemist = Alchemist()
        self.trees = trees_to_plant
        self.max_workers = max_workers
        self.seeds = self._generate_seeds(trees_to_plant)

    def _generate_seeds(self, count):
        """
        Generates 100 unique topics based on recent engineering and design work.
        """
        import random
        
        themes = [
            "The Geometry of Perspective", "Automating the Soul", "The Invisible Architects",
            "Responsive Realities", "Margins of Error", "The Hexagon vs The Gateway",
            "Digital Gardening", "Code as Poetry", "The Ethics of Automation",
            "Designing for Silence", "The Weight of pixels", "Algorithmic Serendipity",
            "Brutalist Web Design", "The Human in the Loop", "Caching Consciousness",
            "Visual Hierarchy", "The Sidebar Paradox", "Gateway D", "CSS Variables as DNA",
            "The Purpose of Padding"
        ]
        
        adjectives = [
            "Hidden", "Silent", "Recursive", "Iterative", "Broken", "Perfect", "Human",
            "Artificial", "Organic", "Structural", "Fluid", "Static", "Dynamic", "Lost"
        ]
        
        nouns = [
            "Systems", "Interfaces", "loops", "Nodes", "Artifacts", "Memories", "Gaps",
            "Spaces", "Connections", "Reflections", "Shadows", "Signals", "Noise"
        ]
        
        seeds = []
        
        # 1. Add specific recent work topics
        core_topics = [
            "Why We Abandoned the Hexagon",
            "Fixing the 72px Gap",
            "The Footer That Vanished",
            "Designing the Gateway Logo",
            "100 Posts in 1 Minute",
            "The Alchemist's Perspective",
            "When width: 100% is a Lie",
            "Responsive Design is a Dialogue",
            "The Studio Node Connection",
            "Batch Processing Creativity"
        ]
        seeds.extend(core_topics)
        
        # 2. Generate variations
        while len(seeds) < count:
            theme = random.choice(themes)
            adj = random.choice(adjectives)
            noun = random.choice(nouns)
            
            formats = [
                f"{theme}: {adj} {noun}",
                f"The {adj} {noun} of {theme}",
                f"Why {theme} Matters",
                f"Meditations on {theme}",
                f"The {adj} Nature of {noun}"
            ]
            
            title = random.choice(formats)
            if title not in seeds:
                seeds.append(title)
            
        return seeds[:count]

    def plant_tree(self, topic):
        """
        Generates a single post (tree) using the remote node.
        """
        print(f"🌱 Planting: '{topic}'...")
        try:
            # Auto-select best provider (Remote vs Gemini)
            content = self.alchemist.generate(
                topic=topic,
                doctrine="Focus on the feeling of technology, not just the function. Be brief but profound.",
                provider="auto"
            )
            return f"✅ Grew: '{topic}' ({len(content)} chars)"
        except Exception as e:
            return f"❌ Failed '{topic}': {e}"

    def grow_forest(self):
        print(f"🌲 Starting Forest Plantation Protocol (Target: {self.trees} trees)")
        print(f"🔌 Remote Node: {config.STUDIO_NODE_URL}")
        
        start_time = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_topic = {executor.submit(self.plant_tree, topic): topic for topic in self.seeds}
            
            for future in as_completed(future_to_topic):
                topic = future_to_topic[future]
                try:
                    result = future.result()
                    print(result)
                    results.append(result)
                except Exception as e:
                    print(f"💥 Exception for '{topic}': {e}")
        
        duration = time.time() - start_time
        print(f"\n🏁 Forest planted in {duration:.2f} seconds.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Plant a forest of content on the remote node.")
    parser.add_argument("--trees", type=int, default=5, help="Number of posts to generate")
    parser.add_argument("--workers", type=int, default=2, help="Parallel workers (be careful not to DDoS the node)")
    
    args = parser.parse_args()
    
    planter = ForestPlanter(trees_to_plant=args.trees, max_workers=args.workers)
    planter.grow_forest()
