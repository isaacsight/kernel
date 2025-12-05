import os
import random
import datetime

CONTENT_DIR = 'content'
NUM_POSTS = 100

def generate_posts():
    print(f"Generating {NUM_POSTS} dummy posts...")
    
    topics = [
        "AI Agents", "Computer Vision", "Generative Audio", "Neural NeRFs", 
        "Latent Space", "Transformer Architecture", "Reinforcement Learning",
        "Video Synthesis", "Prompt Engineering", "Dataset Curation"
    ]
    
    types = ["Experiment", "Workshop", "Note", "Failure", "Success"]
    
    start_date = datetime.date(2024, 1, 1)
    
    for i in range(NUM_POSTS):
        topic = random.choice(topics)
        post_type = random.choice(types)
        day_offset = random.randint(0, 365 * 2)
        date = start_date + datetime.timedelta(days=day_offset)
        
        title = f"AI: {post_type} on {topic} #{random.randint(100, 999)}"
        slug = f"ai-{post_type.lower()}-{topic.lower().replace(' ', '-')}-{i}".replace(':', '')
        
        content = f"""---
title: {title}
date: {date}
excerpt: Automated generation of a test post regarding {topic}.
category: Experiments
tags: {topic}, AI, {post_type}, Generated
featured: false
---

# {title}

This is a generated post to test the scalability of the blog engine.

## Hypothesis
We believe that {topic} will revolutionized the way we interact with computers.

## Method
Running simulation #{i} with parameters set to random.

## Result
Outcome was {random.choice(['successful', 'inconclusive', 'failed'])}.

> Note: This content is auto-generated for stress testing.
"""
        
        filename = os.path.join(CONTENT_DIR, f"{slug}.md")
        with open(filename, 'w') as f:
            f.write(content)
            
    print("Done.")

if __name__ == "__main__":
    generate_posts()
