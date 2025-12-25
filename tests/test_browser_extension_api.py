import requests
import json
import unittest

BASE_URL = "http://localhost:8000"

class TestBrowserAPI(unittest.TestCase):
    def test_ingest_research_request(self):
        """Test that a research request from the extension is correctly ingested."""
        payload = {
            "user_id": "anon_abc123",
            "event_type": "research_request",
            "context": {
                "topic": "Future of Agentic Systems",
                "source": "test_script"
            }
        }
        response = requests.post(f"{BASE_URL}/v1/ingest", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "research_started")
        self.assertTrue("topic" in data)

    def test_browser_analyze(self):
        """Test the deep analysis endpoint."""
        payload = {
            "user_id": "anon_abc123",
            "context": {
                "url": "https://example.com",
                "title": "Example Domain",
                "wordCount": 1200
            }
        }
        response = requests.post(f"{BASE_URL}/api/browser/analyze", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue("directive" in data or "status" in data)

    def test_update_focus(self):
        """Test the focus update endpoint."""
        payload = {
            "user_id": "anon_abc123",
            "focus": "Building Super-Agency"
        }
        response = requests.post(f"{BASE_URL}/api/browser/focus", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["focus"], "Building Super-Agency")

    def test_gemini_sync(self):
        """Test the gemini sync endpoint."""
        payload = {
            "prompt": "What is Active Inference?",
            "response": "Active inference is a way of understanding sentient behavior..."
        }
        response = requests.post(f"{BASE_URL}/api/browser/gemini_sync", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "synced")
        self.assertTrue("sovereign_opinion" in data)

if __name__ == "__main__":
    # Note: This requires the API server to be running.
    # In a real environment, we would use a mock or a test client.
    print("Testing Studio OS Browser Integration...")
    try:
        unittest.main()
    except SystemExit:
        pass
