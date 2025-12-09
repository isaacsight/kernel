
import os
import sys

# Set environment variables for testing
os.environ["STUDIO_NODE_URL"] = "http://100.98.193.42:52415"
# Dummy key for Gemini init (required by constructor even if not used for remote)
if not os.environ.get("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = "dummy_key"

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.alchemist import Alchemist

def test_remote_generation():
    print("Initializing Alchemist...")
    alchemist = Alchemist()
    
    print("\nStarting generation test with provider='remote'...")
    topic = "The importance of small steps in progress"
    doctrine = "Progress is not linear. It is iterative and messy."
    
    try:
        content, context = alchemist.generate(topic, doctrine, provider="remote")
        
        print("\n--- GENERATION SUCCESSFUL ---")
        print(f"Content length: {len(content)} chars")
        print("First 200 chars:")
        print(content[:200])
        print("-----------------------------")
        
        if "qwen" in content.lower() or len(content) > 100:
             print("Verification Passed: Content generated.")
        else:
             print("Verification Warning: Content seems short or generic.")
             
    except Exception as e:
        print(f"\n--- GENERATION FAILED ---")
        print(e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_remote_generation()
