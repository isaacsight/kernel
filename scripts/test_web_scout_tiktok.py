
import asyncio
import os
import sys
from TikTokApi import TikTokApi

# Ensure we can find the modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def test_trending():
    print("Initializing TikTokApi...")
    ms_token = os.environ.get("ms_token", None) 
    
    try:
        async with TikTokApi() as api:
            print("Creating session...")
            await api.create_sessions(ms_tokens=[ms_token], num_sessions=1, sleep_after=3, browser='webkit')
            
            print("Fetching trending videos...")
            count = 0
            async for video in api.trending.videos(count=5):
                count += 1
                print(f"\nVideo {count}:")
                try:
                    # Accessing properties safely
                    data = video.as_dict
                    desc = data.get('desc', 'No description')
                    author = data.get('author', {}).get('nickname', 'Unknown Author')
                    stats = data.get('stats', {})
                    likes = stats.get('diggCount', 0)
                    play_count = stats.get('playCount', 0)
                    
                    print(f"  Author: {author}")
                    print(f"  Description: {desc}")
                    print(f"  Likes: {likes}")
                    print(f"  Plays: {play_count}")
                    print(f"  URL: https://www.tiktok.com/@{data.get('author', {}).get('uniqueId')}/video/{data.get('id')}")
                    
                except Exception as e:
                    print(f"  Error parsing video data: {e}")
            
            if count == 0:
                print("No videos found. This might be due to bot detection or empty response.")
                
    except Exception as e:
        print(f"Critical Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_trending())
