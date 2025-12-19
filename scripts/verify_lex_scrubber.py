
import sys
import os
import logging

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.lex_scrubber import LexScrubber

def test_lex_scrubber():
    print("Initializing Lex Scrubber...")
    scrubber = LexScrubber()
    
    topic = "Artificial General Intelligence"
    print(f"Scrubbing for topic: {topic}...")
    
    try:
        result = scrubber.scrub(topic, limit=3)
        
        if result['status'] == 'success':
            print("\n--- Scrub Comparison Success ---")
            print(f"Found {result['source_count']} sources.")
            print("\n--- Report ---")
            print(result['report'])
            print("\n--- Sources ---")
            for source in result['sources']:
                print(f"- {source['title']} ({source['url']})")
        else:
            print(f"Scrub returned status: {result['status']}")
            
    except Exception as e:
        print(f"Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Configure basic logging
    logging.basicConfig(level=logging.INFO)
    test_lex_scrubber()
