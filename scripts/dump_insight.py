import sys
import os
import json
sys.path.append(os.getcwd())
from admin.brain.memory_store import get_memory_store

mem = get_memory_store()
insights = mem.get_insights("deep_reasoning", min_confidence=0.9)

if insights:
    print(json.dumps(insights[0]['data']['council_output'], indent=2))
else:
    print("No insights found.")
