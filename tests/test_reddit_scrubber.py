
import unittest
from unittest.mock import MagicMock, patch
import sys
import os
import asyncio

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.reddit_scrubber import RedditScrubber

class TestRedditScrubber(unittest.TestCase):
    def setUp(self):
        self.scrubber = RedditScrubber()
        # Mock WebScout
        self.scrubber.web_scout = MagicMock()
        # Mock LLM call
        self.scrubber._simple_llm_call = MagicMock(return_value="# Mock Report\n\n- Insight 1")

    def test_scrub_success(self):
        # Setup mock return for search
        self.scrubber.web_scout.search.return_value = [
            {"title": "Thread 1", "snippet": "Snippet 1", "url": "http://reddit.com/r/1"},
            {"title": "Thread 2", "snippet": "Snippet 2", "url": "http://reddit.com/r/2"}
        ]
        
        result = self.scrubber.scrub("AI Engineering", limit=1)
        
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["source_count"], 2) # Unique
        self.assertIn("# Mock Report", result["report"])
        
    def test_scrub_no_results(self):
        self.scrubber.web_scout.search.return_value = []
        
        result = self.scrubber.scrub("Nonexistent Topic", limit=1)
        
        self.assertEqual(result["status"], "no_results")

if __name__ == "__main__":
    unittest.main()
