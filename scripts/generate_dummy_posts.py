import os
import datetime
import random

CONTENT_DIR = 'content'

def generate_posts(count=100):
    print(f"Generating {count} dummy posts...")
    
    today = datetime.date.today()
    
    for i in range(count):
        title = f"Test Post {i+1} for RSS Load Test"
        slug = f"test-post-{i+1}-rss-load-test"
        filename = f"{slug}.md"
        filepath = os.path.join(CONTENT_DIR, filename)
        
        content = f"""---
title: {title}
date: {today}
category: Engineering
excerpt: This is a dummy post generated to test RSS feed chunking limits.
tags: [test, rss]
---

# {title}

This is test post number {i+1}. It was generated to ensure the RSS feed correctly chunks posts when the total count exceeds 500.

Auto-generated on {today}.
"""
        with open(filepath, 'w') as f:
            f.write(content)
            
    print("Done!")

if __name__ == "__main__":
    generate_posts()
