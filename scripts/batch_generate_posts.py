import sys
import os
import json
import time
import argparse
from datetime import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
import admin.core as core

def batch_generate(limit=None):
    topics_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '../admin/proposed_topics.json'))
    
    if not os.path.exists(topics_file):
        print(f"Error: Topics file not found at {topics_file}")
        return

    with open(topics_file, 'r') as f:
        topics = json.load(f)
        
    if limit:
        topics = topics[:limit]
        
    print(f"Starting batch generation for {len(topics)} posts...")
    
    successful = 0
    failed = 0
    
    for i, topic in enumerate(topics):
        print(f"\n--- Processing {i+1}/{len(topics)}: {topic} ---")
        try:
            # Check if post already exists (simple check by slug)
            slug = topic.lower().replace(' ', '-')
            expected_filename = f"ai-{slug}.md"
            if os.path.exists(os.path.join(core.CONTENT_DIR, expected_filename)):
                print(f"Skipping {topic} (already exists)")
                continue

            filename = core.generate_ai_post(topic)
            print(f"SUCCESS: Generated {filename}")
            successful += 1
            
            # Sleep to be polite to APIs
            time.sleep(2)
            
        except Exception as e:
            print(f"FAILURE: Could not generate post for '{topic}': {e}")
            failed += 1
            
    print(f"\nBatch generation complete.")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch generate blog posts.")
    parser.add_argument("--limit", type=int, help="Limit the number of posts to generate")
    args = parser.parse_args()
    
    batch_generate(limit=args.limit)
