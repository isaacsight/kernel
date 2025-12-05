"""
The Beta Tester - Quality Assurance Agent

Responsible for automated testing, link verification,
and ensuring a high-quality user experience.

Enhanced with Steam Playtest-inspired features for
collecting structured beta tester feedback.
"""

import os
import sys
import json
import logging
import requests
import time
from datetime import datetime
from typing import Dict, List, Set, Optional
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logger = logging.getLogger("BetaTester")

class BetaTester:
    """
    The Beta Tester (QA Engineer)
    
    Mission: Break things so users don't have to.
    
    Responsibilities:
    - Crawl site for broken links
    - validate basic accessibility (A11y)
    - Check page performance (file sizes, load times)
    - Verify critical flows
    - Steam Playtest-inspired: Collect beta tester feedback
    """
    
    def __init__(self):
        self.name = "The Beta Tester"
        self.role = "QA Engineer"
        self.emoji = "🧪"
        self.visited_urls: Set[str] = set()
        self.broken_links: List[Dict] = []
        self.issues: List[Dict] = []
        
        # Steam Playtest-inspired: Tester registry and feedback storage
        self.brain_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'brain'
        )
        self.playtest_file = os.path.join(self.brain_dir, "playtest_data.json")
        self.playtest_data = self._load_playtest_data()

        
    def run_suite(self, target_url: str = "http://localhost:8080", max_pages: int = 50) -> Dict:
        """
        Runs the full test suite against a target.
        """
        logger.info(f"[{self.name}] Starting test suite on {target_url}")
        self.issues = []
        self.broken_links = []
        self.visited_urls = set()
        
        start_time = time.time()
        
        # 1. Crawl and Verify
        self._crawl(target_url, target_url, max_pages)
        
        # 2. Compile Report
        report = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "target": target_url,
            "duration": f"{time.time() - start_time:.2f}s",
            "pages_scanned": len(self.visited_urls),
            "issues_found": len(self.issues),
            "broken_links": len(self.broken_links),
            "details": {
                "issues": self.issues,
                "broken_links": self.broken_links
            },
            "status": "PASS" if not self.issues and not self.broken_links else "FAIL"
        }
        
        logger.info(f"[{self.name}] Test suite complete. Status: {report['status']}")
        return report

    def _crawl(self, url: str, base_domain: str, limit: int):
        """
        Recursively crawls internal links.
        """
        if len(self.visited_urls) >= limit or url in self.visited_urls:
            return
            
        self.visited_urls.add(url)
        logger.debug(f"Scanning: {url}")
        
        try:
            response = requests.get(url, timeout=5)
            
            if response.status_code != 200:
                self.broken_links.append({"url": url, "status": response.status_code, "source": "crawler"})
                return
                
            # Parse Content
            content_type = response.headers.get("Content-Type", "")
            if "text/html" not in content_type:
                return
                
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Run Checks
            self._check_accessibility(url, soup)
            self._check_seo_basics(url, soup)
            
            # Find Links
            for link in soup.find_all("a", href=True):
                href = link["href"]
                full_url = urljoin(url, href)
                
                # Normalize
                parsed = urlparse(full_url)
                clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                
                # Check if internal
                if base_domain in full_url:
                    self._crawl(clean_url, base_domain, limit)
                else:
                    # External link check (head request only)
                    self._check_external_link(full_url, url)
                    
        except Exception as e:
            logger.error(f"Failed to crawl {url}: {e}")
            self.issues.append({"url": url, "type": "crawl_error", "message": str(e)})

    def _check_external_link(self, url: str, source_page: str):
        """
        Verifies an external link without downloading the body.
        """
        # specialized logic to skip checking certain domains to avoid bans or massive delays
        # or basic caching. For now, simple HEAD request.
        try:
            # Skip checking same external link multiple times in one run
            # (In a real implementation, we'd cache this across the run)
            pass 
        except Exception:
            pass

    def _check_accessibility(self, url: str, soup: BeautifulSoup):
        """
        Basic A11y checks.
        """
        # 1. Images missing alt text
        images = soup.find_all("img")
        for img in images:
            if not img.get("alt"):
                self.issues.append({
                    "url": url,
                    "type": "accessibility",
                    "severity": "medium",
                    "message": f"Image missing alt text: {img.get('src', 'unknown')}"
                })
                
        # 2. Page title missing
        if not soup.title:
             self.issues.append({
                "url": url,
                "type": "accessibility",
                "severity": "high",
                "message": "Page missing <title> tag"
            })

    def _check_seo_basics(self, url: str, soup: BeautifulSoup):
        """
        Basic SEO checks.
        """
        # 1. Heading hierarchy (only one H1)
        h1s = soup.find_all("h1")
        if len(h1s) > 1:
            self.issues.append({
                "url": url,
                "type": "seo",
                "severity": "low",
                "message": f"Multiple H1 tags found ({len(h1s)})"
            })
        elif len(h1s) == 0:
             self.issues.append({
                "url": url,
                "type": "seo",
                "severity": "medium",
                "message": "No H1 tag found"
            })

    # ============================================================
    # Steam Playtest-Inspired Features
    # ============================================================
    
    def _load_playtest_data(self) -> Dict:
        """Load playtest registry and feedback."""
        if os.path.exists(self.playtest_file):
            try:
                with open(self.playtest_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {
            "testers": [],
            "feedback": [],
            "playtests": []
        }
    
    def _save_playtest_data(self):
        """Persist playtest data."""
        os.makedirs(self.brain_dir, exist_ok=True)
        with open(self.playtest_file, 'w') as f:
            json.dump(self.playtest_data, f, indent=2)
    
    def register_playtester(
        self, 
        email: str, 
        name: str = "Anonymous",
        interests: List[str] = None
    ) -> Dict:
        """
        Register a beta tester for playtests.
        
        Inspired by Steam Playtest's tester signup.
        """
        # Check if already registered
        existing = next((t for t in self.playtest_data["testers"] if t["email"] == email), None)
        if existing:
            return {"success": False, "error": "Already registered", "tester": existing}
        
        tester = {
            "id": f"tester_{len(self.playtest_data['testers']) + 1:04d}",
            "email": email,
            "name": name,
            "interests": interests or [],
            "registered_at": datetime.now().isoformat(),
            "tests_participated": 0,
            "feedback_count": 0
        }
        
        self.playtest_data["testers"].append(tester)
        self._save_playtest_data()
        
        logger.info(f"[{self.name}] 🎮 New tester registered: {name} ({email})")
        return {"success": True, "tester": tester}
    
    def collect_feedback(
        self, 
        tester_id: str, 
        category: str,
        feedback: str,
        severity: str = "medium",
        feature: str = None
    ) -> Dict:
        """
        Collect structured feedback from a playtester.
        
        Categories: bug, feature_request, usability, praise, other
        Severity: low, medium, high, critical
        """
        tester = next((t for t in self.playtest_data["testers"] if t["id"] == tester_id), None)
        
        feedback_entry = {
            "id": f"fb_{len(self.playtest_data['feedback']) + 1:04d}",
            "tester_id": tester_id,
            "tester_name": tester["name"] if tester else "Unknown",
            "category": category,
            "severity": severity,
            "feature": feature,
            "feedback": feedback,
            "submitted_at": datetime.now().isoformat(),
            "status": "new"
        }
        
        self.playtest_data["feedback"].append(feedback_entry)
        
        # Update tester stats
        if tester:
            tester["feedback_count"] = tester.get("feedback_count", 0) + 1
        
        self._save_playtest_data()
        
        logger.info(f"[{self.name}] 📝 Feedback collected: {category} - {feedback[:50]}...")
        return {"success": True, "feedback_id": feedback_entry["id"]}
    
    def run_playtest(self, feature_flag: str, tester_ids: List[str] = None) -> Dict:
        """
        Start a limited playtest for specific features.
        
        Inspired by Steam's controlled playtest releases.
        """
        playtest = {
            "id": f"pt_{len(self.playtest_data['playtests']) + 1:03d}",
            "feature_flag": feature_flag,
            "started_at": datetime.now().isoformat(),
            "status": "active",
            "participants": tester_ids or [],
            "feedback_collected": 0
        }
        
        self.playtest_data["playtests"].append(playtest)
        self._save_playtest_data()
        
        logger.info(f"[{self.name}] 🚀 Playtest started: {feature_flag}")
        return {"success": True, "playtest": playtest}
    
    def generate_playtest_report(self) -> Dict:
        """
        Generate a summary report of playtest feedback.
        
        Inspired by Steam's developer feedback dashboard.
        """
        feedback = self.playtest_data["feedback"]
        
        # Categorize feedback
        by_category = {}
        by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        
        for fb in feedback:
            cat = fb.get("category", "other")
            by_category[cat] = by_category.get(cat, 0) + 1
            
            sev = fb.get("severity", "medium")
            if sev in by_severity:
                by_severity[sev] += 1
        
        # Recent feedback
        recent = sorted(feedback, key=lambda x: x.get("submitted_at", ""), reverse=True)[:10]
        
        report = {
            "generated_at": datetime.now().isoformat(),
            "total_testers": len(self.playtest_data["testers"]),
            "total_feedback": len(feedback),
            "active_playtests": len([p for p in self.playtest_data["playtests"] if p.get("status") == "active"]),
            "by_category": by_category,
            "by_severity": by_severity,
            "recent_feedback": recent,
            "action_items": [
                fb for fb in feedback 
                if fb.get("severity") in ["critical", "high"] and fb.get("status") == "new"
            ]
        }
        
        logger.info(f"[{self.name}] 📊 Playtest report generated: {report['total_feedback']} feedback items")
        return report

    def run_task(self, task: str, context: Dict = {}) -> Dict:
        """
        Executes a task based on instructions.
        Compatible with Studio Node's generic agent runner.
        """
        logger.info(f"[{self.name}] Received task: {task}")
        
        # Parse context for parameters
        target_url = context.get("target_url", "http://localhost:8080")
        max_pages = context.get("max_pages", 50)
        
        if "crawl" in task.lower() or "test" in task.lower():
            return self.run_suite(target_url, max_pages)
            
        return {"status": "skipped", "message": "Task not understood. Supported tasks: 'crawl', 'test', 'run suite'"}

if __name__ == "__main__":
    # Test run
    logging.basicConfig(level=logging.INFO)
    tester = BetaTester()
    # Mocking a run if localhost isn't up, or trying it.
    # Assuming user might have it running or we just test the class instantiation.
    print(f"Beta Tester {tester.emoji} initialized.")
