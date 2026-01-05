import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.youtube_transcript_agent import YouTubeTranscriptAgent


async def test_agent():
    print("🚀 Initializing YouTube Transcript Agent...")
    agent = YouTubeTranscriptAgent()

    # Example video: Lex Fridman #488 (Joel David Hamkins)
    url = "https://www.youtube.com/watch?v=14OPT6CcsH4"
    print(f"🎬 Fetching transcript for: {url}...")

    try:
        result = await agent.execute("get_transcript", url=url)

        if result["status"] == "success":
            print(f"✅ SUCCESS! Method used: {result['method']}")
            print("\n--- Transcript Preview ---")
            print(result["transcript"][:1000] + "...")
        else:
            print(f"❌ FAILED: {result['message']}")

    except Exception as e:
        print(f"💥 ERROR during test: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_agent())
