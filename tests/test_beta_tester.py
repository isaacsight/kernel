import sys
import os
import logging
from unittest.mock import MagicMock, patch

# Add project root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.beta_tester import BetaTester

def test_beta_tester_instantiation():
    """Test that the agent can be instantiated."""
    tester = BetaTester()
    assert tester.name == "The Beta Tester"
    print("✅ Instantiation successful")

@patch('requests.get')
def test_crawl(mock_get):
    """Test the crawl functionality with mocked requests."""
    # Setup mock
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"Content-Type": "text/html"}
    mock_response.text = """
    <html>
        <head><title>Test Page</title></head>
        <body>
            <h1>Hello</h1>
            <a href="/about">About</a>
            <img src="test.jpg" alt="test image">
            <img src="bad.jpg">
        </body>
    </html>
    """
    mock_get.return_value = mock_response
    
    tester = BetaTester()
    report = tester.run_suite("http://test.local", max_pages=1)
    
    # Assertions
    assert report["status"] == "FAIL" # Should fail due to missing alt on bad.jpg
    assert len(tester.issues) > 0
    print("✅ Crawl test successful (Issues found as expected)")
    print(f"   Issues: {tester.issues}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.ERROR)
    print("Running Beta Tester tests...")
    test_beta_tester_instantiation()
    test_crawl()
