
import sys
import os
import argparse
import logging
from pprint import pprint

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.lex_scrubber import LexScrubber

def consult_lex(topic, limit=5):
    print(f"--- Consulting Lex Fridman Agent ---")
    print(f"Topic: {topic}")
    print(f"Limit: {limit} sources")
    print("------------------------------------")
    
    scrubber = LexScrubber()
    
    try:
        result = scrubber.scrub(topic, limit=limit)
        
        if result['status'] == 'success':
            print("\n>>> INSIGHTS REPORT <<<")
            print(result['report'])
            print("\n>>> SOURCES <<<")
            for source in result['sources']:
                print(f"- {source['title']}")
                print(f"  Url: {source['url']}")
        else:
            print(f"Scrub returned status: {result['status']}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrub Lex Fridman transcripts for a topic.")
    parser.add_argument("topic", help="The topic to search for")
    parser.add_argument("--limit", type=int, default=5, help="Number of sources to check")
    
    args = parser.parse_args()
    
    # Configure logging to show less noise
    logging.basicConfig(level=logging.WARNING)
    
    consult_lex(args.topic, args.limit)
