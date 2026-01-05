import logging
import os
import subprocess
import asyncio
import re
from typing import Dict, Any, List, Optional
from admin.brain.agent_base import BaseAgent
from admin.brain.model_router import get_model_router, TaskType
from config import config

logger = logging.getLogger("YouTubeTranscriptAgent")


class YouTubeTranscriptAgent(BaseAgent):
    """
    YouTube Transcript Agent

    Mission: Retrieve textual transcripts from YouTube videos for further analysis.
    Supports api extraction via youtube-transcript-api, CLI via yt-dlp
    and browser-based extraction via Playwright.
    """

    def __init__(self):
        super().__init__(agent_id="youtube_transcript")
        self.name = "YouTube Transcript Agent"
        self.role = "Intelligence Scraper"

    async def execute(self, action: str, **params) -> Dict[str, Any]:
        """
        Standard Agentic Interface
        """
        if action == "get_transcript":
            url = params.get("url")
            if not url:
                raise ValueError("YouTube URL is required.")
            return await self.get_transcript(url)
        else:
            raise NotImplementedError(f"Action {action} not supported.")

    async def get_transcript(self, url: str) -> Dict[str, Any]:
        """
        Fetches the transcript.
        """
        logger.info(f"[{self.name}] Fetching transcript for: {url}")
        video_id = self._extract_video_id(url)
        if not video_id:
            return {"status": "error", "message": "Invalid YouTube URL."}

        # 1. Try youtube-transcript-api (Fastest, cleanest)
        transcript = self._try_api(video_id)
        if transcript:
            return {"status": "success", "method": "api", "transcript": transcript}

        # 2. Try yt-dlp (Strong CLI fallback)
        transcript = self._try_yt_dlp(url)
        if transcript:
            return {"status": "success", "method": "yt-dlp", "transcript": transcript}

        # 3. Fallback to Playwright (GUI scraping fallback)
        logger.info(f"[{self.name}] Falling back to Playwright scraper...")
        transcript = await self._scrape_with_playwright(url)
        if transcript:
            return {"status": "success", "method": "playwright", "transcript": transcript}

        return {"status": "error", "message": "Failed to retrieve transcript via all methods."}

    def _extract_video_id(self, url: str) -> Optional[str]:
        """Extracts video ID from various YouTube URL formats."""
        patterns = [
            r"(?:v=|\/)([0-9A-Za-z_-]{11}).*",
            r"youtu\.be\/([0-9A-Za-z_-]{11})",
            r"embed\/([0-9A-Za-z_-]{11})",
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    def _try_api(self, video_id: str) -> Optional[str]:
        """Attempts to use youtube-transcript-api."""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            return " ".join([segment["text"] for segment in transcript_list])
        except Exception as e:
            logger.debug(f"API attempt failed for {video_id}: {e}")
        return None

    def _try_yt_dlp(self, url: str) -> Optional[str]:
        """Attempts to use yt-dlp to get subtitles."""
        try:
            # We use --get-subs and --skip-download to just get the text if possible
            temp_dir = "tmp/transcripts"
            os.makedirs(temp_dir, exist_ok=True)
            video_id = self._extract_video_id(url)

            # Command to get auto-subs only
            cmd = [
                "yt-dlp",
                "--write-auto-subs",
                "--skip-download",
                "--sub-format",
                "vtt",
                "--output",
                f"{temp_dir}/%(id)s",
                url,
            ]

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                vtt_path = f"{temp_dir}/{video_id}.en.vtt"
                if os.path.exists(vtt_path):
                    with open(vtt_path, "r", encoding="utf-8") as f:
                        # Simple cleaning of VTT to text
                        content = f.read()
                        # Remove timestamps and headers
                        lines = content.split("\n")
                        clean_lines = []
                        for line in lines:
                            if (
                                "-->" not in line
                                and not line.strip().isdigit()
                                and line.strip() != "WEBVTT"
                                and line.strip()
                            ):
                                clean_lines.append(line.strip())
                        return " ".join(clean_lines)
        except Exception as e:
            logger.debug(f"yt-dlp attempt failed: {e}")

        return None

    async def _scrape_with_playwright(self, url: str) -> Optional[str]:
        """Uses Playwright to scrape the transcript from the YouTube UI."""
        try:
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.goto(url)

                # Look for 'Show transcript' button
                transcript_btn = page.locator("text='Show transcript'")
                if await transcript_btn.count() > 0:
                    await transcript_btn.first.click()
                    await page.wait_for_selector("ytd-transcript-segment-renderer", timeout=10000)

                    segments = await page.query_selector_all("ytd-transcript-segment-renderer")
                    text_parts = []
                    for segment in segments:
                        text = await segment.inner_text()
                        text_parts.append(text.replace("\n", " "))

                    await browser.close()
                    return "\n".join(text_parts)

                await browser.close()
        except Exception as e:
            logger.error(f"Playwright scraping failed: {e}")

        return None


if __name__ == "__main__":
    # Test run
    import asyncio

    agent = YouTubeTranscriptAgent()
    # result = asyncio.run(agent.get_transcript("https://www.youtube.com/watch?v=14OPT6CcsH4"))
    # print(result.get("transcript")[:500])
