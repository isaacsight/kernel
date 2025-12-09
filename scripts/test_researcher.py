from admin.engineers.frontier_researcher import FrontierResearcher
from dotenv import load_dotenv
import os

load_dotenv()

# Force the correct node URL for the test since env might not pick up immediately in some shells
os.environ["STUDIO_NODE_URL"] = "http://192.168.1.2:5001"

print("🧪 Research Engineer entering the lab...")
researcher = FrontierResearcher()

topic = "The Future of Autonomous Coding Agents"
print(f"🧠 Brainstorming topic: {topic}")

result = researcher.brainstorm_ideas(topic)

print("\n--- RESULTS ---")
if "error" in result:
    print(f"❌ Error: {result['error']}")
else:
    print(f"✅ Source: {result['source']}")
    print(f"💡 Ideas:\n{result['ideas']}")
