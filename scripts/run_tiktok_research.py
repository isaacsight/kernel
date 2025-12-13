import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.researcher import Researcher

def main():
    print("Initializing Researcher...")
    researcher = Researcher()
    
    topic = "TikTok System Architecture Deep Dive"
    print(f"Starting research on: {topic}")
    
    # Run for 2 iterations for a balance of depth and speed
    result = researcher.iterative_research(topic, max_iterations=2)
    
    print("\nResult Status:", result["status"])
    if result["status"] == "success":
        print(f"Report saved to: {result['report_path']}")
        print("\n--- Report Preview ---\n")
        print(result["report"][:1000] + "...")
        print("\n----------------------\n")
    else:
        print("Research failed.")

if __name__ == "__main__":
    main()
