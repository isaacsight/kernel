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
        Generates topics (seeds) for the forest.
        For now, we'll use a mix of preset and AI-generated seeds.
        """
        base_seeds = [
            "The Psychology of Waiting for AI",
            "Why Local LLMs Feel More Personal",
            "Designing Interfaces for Non-Human Intelligence",
            "The Silence of a Turned-Off Server",
            "Digital Gardening vs Digital Farming"
        ]
        
        # If we need more, we could ask the Alchemist to brainstorm, 
        # but let's stick to a robust list for the first run or repeat/vary them.
        seeds = base_seeds
        while len(seeds) < count:
            seeds.append(f"Reflection on Digital Existence {len(seeds) + 1}")
            
        return seeds[:count]

    def plant_tree(self, topic):
        """
        Generates a single post (tree) using the remote node.
        """
        print(f"🌱 Planting: '{topic}'...")
        try:
            # Explicitly request remote provider
            content = self.alchemist.generate(
                topic=topic,
                doctrine="Focus on the feeling of technology, not just the function.",
                provider="remote"
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
