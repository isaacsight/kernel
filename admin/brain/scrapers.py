
import os
import sys
import requests
from bs4 import BeautifulSoup
import logging
import json

# Add parent directory to path to allow imports if run directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from admin.brain.agent_presence import AgentTask
except ImportError:
    # Fallback for relative import
    from agent_presence import AgentTask

logger = logging.getLogger("Scrapers")

class AIWebScraper:
    """
    The Harvester agent - Scrapes general web content.
    """
    def __init__(self):
        self.name = "Harvester"
        self.ua = "Studio-OS-Harvester/1.0"

    def scrape(self, url):
        """Scrape a website for content."""
        print(f"[{self.name}] Starting scrape of {url}...")
        with AgentTask(self.name, f"Scraping {url}"):
            try:
                response = requests.get(url, headers={"User-Agent": self.ua}, timeout=10)
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Extract some basic metadata
                    data = {
                        "url": url,
                        "title": soup.title.string if soup.title else "No Title",
                        "description": "",
                        "internal_links": 0,
                        "external_links": 0
                    }
                    
                    # Get meta description
                    meta_desc = soup.find("meta", attrs={"name": "description"})
                    if meta_desc:
                        data["description"] = meta_desc.get("content", "")
                        
                    # Count links
                    links = soup.find_all("a", href=True)
                    for link in links:
                        href = link["href"]
                        if href.startswith("/") or url in href:
                            data["internal_links"] += 1
                        else:
                            data["external_links"] += 1
                            
                    print(f"[{self.name}] Successfully scraped {url}")
                    return data
                else:
                    return {"error": f"Status {response.status_code}"}
            except Exception as e:
                logger.error(f"Scrape failed: {e}")
                return {"error": str(e)}

class AIScraper:
    """
    The Collector agent - Specialized in finding AI/Agent specific info.
    """
    def __init__(self):
        self.name = "Collector"

    def scan_for_agents(self, source_url):
        """Scan a source for AI agent definitions or configs."""
        with AgentTask(self.name, f"Scanning {source_url} for agents"):
            # This would realistically parse specific repositories or directories
            # For now, it's a simulated scan aimed at the user's requested "scrape agents" functionality
            
            findings = []
            
            # Simulated logic for demonstration
            if "github" in source_url:
                findings.append({"type": "possibility", "confidence": "high", "note": "GitHub repo detected"})
            
            return {
                "source": source_url,
                "agent_signatures_found": findings,
                "status": "scanned"
            }

if __name__ == "__main__":
    # Test the scrapers
    harvester = AIWebScraper()
    result = harvester.scrape("https://example.com")
    print(json.dumps(result, indent=2))
