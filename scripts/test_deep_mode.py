
import asyncio
import sys
import os

# Add root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

from admin.engineers.alchemist import Alchemist
from admin.core import get_doctrine

async def test_deep_mode():
    print("Initializing Alchemist...")
    alchemist = Alchemist()
    doctrine = get_doctrine()
    
    topic = "The hidden cost of rushing"
    print(f"Testing Deep Mode generation for topic: '{topic}'")
    
    # We will invoke generate directly to see logs in stdout
    # In a real scenario, this is called via alchemist.execute->generate
    
    content, context = alchemist.generate(
        topic=topic, 
        doctrine=doctrine, 
        deep_mode=True  # The flag we added
    )
    
    print("\n--- GENERATION COMPLETE ---")
    print(f"Content Length: {len(content)}")
    print("Preview:")
    print(content[:500] + "...")
    
    if "Analyze" in content or "Plan" in content:
        # Notes: The prompt asks NOT to show reasoning, but if the model fails to hide it, we might see it.
        # Ideally we want to see high quality output.
        pass

if __name__ == "__main__":
    asyncio.run(test_deep_mode())
