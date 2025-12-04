from admin.engineers.alchemist import Alchemist
from config import config
import logging

# Enable logging to see what's happening
logging.basicConfig(level=logging.INFO)

print(f"Testing Alchemist with Remote Node: {config.STUDIO_NODE_URL}")

alchemist = Alchemist()
try:
    response = alchemist.generate(
        topic="Test Topic", 
        doctrine="Be concise.", 
        provider="remote"
    )
    print("\n--- SUCCESS ---")
    print(response[:100] + "...")
except Exception as e:
    print("\n--- FAILED ---")
    print(e)
