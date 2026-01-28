
import sys
import os
# Add root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.engineers.revenue_agent import RevenueAgent

agent = RevenueAgent()
target_file = "content/decoding-tiktok-architecture.md"

if os.path.exists(target_file):
    print(f"Analyzing {target_file}...")
    offering = agent.generate_offering(target_file)
    import json
    print(json.dumps(offering, indent=2))
else:
    print(f"File {target_file} not found.")
