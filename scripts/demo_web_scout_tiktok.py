
import os
import sys
# Add the project root to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.web_scout import get_web_scout

def demo_tiktok_capabilities():
    scout = get_web_scout()
    print("=== Web Scout TikTok Capabilities ===\n")
    
    # 1. Trending
    print("1. Fetching Trending Videos...")
    try:
        trends = scout.get_tiktok_trends(count=3)
        for i, vid in enumerate(trends, 1):
            print(f"   {i}. {vid['author']}: {vid['desc'][:50]}... (Likes: {vid['likes']})")
    except Exception as e:
        print(f"   Error: {e}")
        
    print("\n2. Searching for 'AI'...")
    try:
        search_results = scout.search_tiktok("artificial intelligence", count=3)
        for i, vid in enumerate(search_results, 1):
            print(f"   {i}. {vid['author']}: {vid['desc'][:50]}... (Plays: {vid['plays']})")
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    demo_tiktok_capabilities()
