#!/usr/bin/env python3
"""
Mass Blog Post Generator - Creates 100 new posts using the AI team.

Uses the Alchemist with Studio Node for generation.
"""

import os
import sys
import time
import random
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from admin.engineers import Alchemist, Researcher, CreativeDirector
from admin.brain import get_collective_intelligence

# Topics to generate posts about
TOPICS = [
    # Self-awareness & Growth
    "The moment before clarity arrives",
    "Why we resist what we need most",
    "Learning to trust your own judgment",
    "The difference between patience and avoidance",
    "What your recurring thoughts are trying to tell you",
    "The art of sitting with discomfort",
    "When self-improvement becomes self-rejection",
    "The courage to be mediocre at something new",
    "Why we fear our own potential",
    "The weight of unspoken words",
    
    # Relationships & Connection
    "Loving someone without losing yourself",
    "The conversations we avoid having",
    "When distance brings clarity",
    "The difference between being heard and being understood",
    "Why vulnerability feels like weakness but isn't",
    "Learning to hold space without fixing",
    "The friends we outgrow",
    "When silence speaks louder than words",
    "The art of apologizing without explaining",
    "Why we attract what we're not ready for",
    
    # Digital Life & Modern Existence
    "The cost of constant availability",
    "When your online self feels more real",
    "Finding presence in a distracted world",
    "The exhaustion of endless optimization",
    "Why we scroll when we should sleep",
    "The illusion of productivity",
    "When connection breeds loneliness",
    "The art of being unreachable",
    "Why we document instead of experience",
    "The weight of unopened notifications",
    
    # Meaning & Purpose
    "The pressure to have a passion",
    "When meaning finds you instead",
    "The beauty of purposeless pursuits",
    "Why we chase goals that don't matter",
    "The difference between busy and fulfilled",
    "Learning to want what you have",
    "When ambition becomes escape",
    "The freedom of lowered expectations",
    "Why we fear empty time",
    "The art of doing nothing well",
    
    # Emotions & Inner Life
    "The anger underneath the sadness",
    "When happiness feels suspicious",
    "Learning to grieve small losses",
    "The emotion that has no name",
    "Why we cry at unexpected moments",
    "The comfort of melancholy",
    "When numbness is the loudest feeling",
    "The fear behind the frustration",
    "Why we push away what we need",
    "The art of feeling without fixing",
    
    # Time & Change
    "The versions of yourself you've left behind",
    "When nostalgia lies to us",
    "Learning to let chapters end",
    "The unbearable weight of potential",
    "Why we romanticize the past",
    "The art of starting again",
    "When change happens without permission",
    "The future we're afraid to want",
    "Why we mourn who we used to be",
    "The time between who you were and who you're becoming",
    
    # Authenticity & Truth
    "The exhaustion of performing yourself",
    "When honesty requires courage",
    "Learning to disappoint people gracefully",
    "The masks we forgot we're wearing",
    "Why we fear being truly known",
    "The art of saying no without guilt",
    "When authenticity meets rejection",
    "The version of you others need you to be",
    "Why we edit our true feelings",
    "The freedom of being disliked",
    
    # Wisdom & Acceptance
    "The lessons that take years to land",
    "When advice you gave comes back for you",
    "Learning to hold contradictions",
    "The humility of not knowing",
    "Why the same lesson keeps returning",
    "The art of being wrong gracefully",
    "When understanding arrives too late",
    "The questions that have no answers",
    "Why wisdom often feels like loss",
    "The peace on the other side of acceptance",
]

def create_slug(title: str) -> str:
    """Create URL-friendly slug from title."""
    slug = title.lower()
    slug = ''.join(c if c.isalnum() or c == ' ' else '' for c in slug)
    slug = '-'.join(slug.split())
    return slug[:50]

def generate_posts(count: int = 100):
    """Generate multiple blog posts."""
    print("=" * 60)
    print(f"    MASS CONTENT GENERATION - {count} POSTS")
    print("=" * 60)
    print()
    
    # Initialize
    alchemist = Alchemist()
    collective = get_collective_intelligence()
    
    # Get the doctrine
    doctrine = """
    We value emotional honesty over intellectual performance.
    We trust sensation over analysis.
    We write like a friend speaking truth gently.
    We end with the question: Does this feel true?
    """
    
    content_dir = os.path.join(os.path.dirname(__file__), 'content')
    os.makedirs(content_dir, exist_ok=True)
    
    # Track progress
    created = 0
    failed = 0
    
    # Use first 100 topics (or repeat if needed)
    topics_to_use = TOPICS[:count]
    if len(topics_to_use) < count:
        topics_to_use = (TOPICS * (count // len(TOPICS) + 1))[:count]
    
    # Generate dates spread over past months
    base_date = datetime.now()
    
    for i, topic in enumerate(topics_to_use):
        print(f"\n[{i+1}/{count}] Generating: {topic}")
        
        try:
            # Generate content
            content = alchemist.generate(topic, doctrine, provider="auto")
            
            if not content or len(content) < 100:
                print(f"  ✗ Content too short, skipping")
                failed += 1
                continue
            
            # Create slug and filename
            slug = create_slug(topic)
            
            # Add date variation (spread posts over time)
            days_ago = random.randint(0, 180)
            post_date = base_date - timedelta(days=days_ago)
            
            # Categories
            categories = ["Reflections", "Inner Work", "Modern Life", "Growth", "Connection"]
            category = random.choice(categories)
            
            # Create frontmatter - clean, no AI indicators
            frontmatter = f"""---
title: "{topic}"
date: {post_date.strftime('%Y-%m-%d')}
category: "{category}"
tags: ["reflection", "growth", "self-awareness"]
---

"""
            
            # Write file - clean filename, blends with existing posts
            filename = f"{slug}.md"
            filepath = os.path.join(content_dir, filename)
            
            with open(filepath, 'w') as f:
                f.write(frontmatter + content)
            
            print(f"  ✓ Created: {filename}")
            created += 1
            
            # Share insight with collective
            collective.share_insight(
                "Alchemist", "content_generated",
                {"topic": topic, "category": category},
                0.7
            )
            
            # Small delay to avoid rate limits
            time.sleep(2)
            
        except Exception as e:
            print(f"  ✗ Error: {e}")
            failed += 1
            time.sleep(5)  # Longer delay on error
    
    print()
    print("=" * 60)
    print(f"    GENERATION COMPLETE")
    print(f"    Created: {created} | Failed: {failed}")
    print("=" * 60)
    
    return created, failed


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate blog posts")
    parser.add_argument("--count", type=int, default=100, help="Number of posts")
    args = parser.parse_args()
    
    generate_posts(args.count)
