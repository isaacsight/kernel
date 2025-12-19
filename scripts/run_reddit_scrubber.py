
import argparse
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.reddit_scrubber import RedditScrubber

def main():
    parser = argparse.ArgumentParser(description="Run the Reddit Scrubber Agent")
    parser.add_argument("--topic", type=str, default="AI Engineering", help="Topic to scrub")
    parser.add_argument("--limit", type=int, default=5, help="Number of results per query")
    
    args = parser.parse_args()
    
    print(f"🤖 Starting Reddit Scrubber on topic: '{args.topic}'...")
    
    scrubber = RedditScrubber()
    result = scrubber.scrub(args.topic, limit=args.limit)
    
    if result["status"] == "success":
        print("\n✅ Analysis Complete!\n")
        print("="*60)
        print(result["report"])
        print("="*60)
        print(f"\nAnalyzed {result['source_count']} unique threads.")
    else:
        print(f"\n❌ Failed to scrub: {result.get('status')}")

if __name__ == "__main__":
    main()
