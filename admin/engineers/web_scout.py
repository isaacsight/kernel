"""
Web Scout - Real-Time Web Research and Fact Checking

Inspired by Replit's Web Search feature.
Enables agents to access current information from the web.
"""

import os
import json
import logging
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any
from urllib.parse import quote_plus

logger = logging.getLogger("WebScout")


class WebScout:
    """
    The Web Scout (Research Intelligence)
    
    Mission: Provide real-time web research capabilities to the agent team.
    
    Inspired by Replit's Web Search feature that overcomes knowledge cutoffs.
    
    Responsibilities:
    - Search the web for current information
    - Fact-check claims in content
    - Research trending topics
    - Find relevant documentation and APIs
    """
    
    def __init__(self):
        self.name = "The Web Scout"
        self.role = "Research Intelligence"
        self.emoji = "🌐"
        
        # API configurations
        self.serper_key = os.environ.get("SERPER_API_KEY")
        self.brave_key = os.environ.get("BRAVE_API_KEY")
        
        # Cache for recent searches
        self.cache_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'brain', 'web_cache.json'
        )
        self.cache = self._load_cache()
        
        logger.info(f"[{self.name}] Initialized")
    
    def _load_cache(self) -> Dict:
        """Load search cache from disk."""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {"searches": {}, "facts": {}}
    
    def _save_cache(self):
        """Save cache to disk."""
        # Keep only recent entries
        if len(self.cache["searches"]) > 100:
            keys = sorted(self.cache["searches"].keys())
            for key in keys[:-100]:
                del self.cache["searches"][key]
        
        os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)
        with open(self.cache_file, 'w') as f:
            json.dump(self.cache, f, indent=2)
    
    def search(
        self,
        query: str,
        num_results: int = 5,
        search_type: str = "search"
    ) -> List[Dict]:
        """
        Search the web for information.
        
        Args:
            query: Search query
            num_results: Number of results to return
            search_type: "search", "news", or "images"
            
        Returns: List of search results
        """
        cache_key = f"{query}:{search_type}"
        
        # Check cache first
        if cache_key in self.cache["searches"]:
            cached = self.cache["searches"][cache_key]
            # Use cache if less than 1 hour old
            cached_time = datetime.fromisoformat(cached["timestamp"])
            if (datetime.now() - cached_time).seconds < 3600:
                return cached["results"]
        
        results = []
        
        # Try Serper API (Google Search)
        if self.serper_key:
            results = self._search_serper(query, num_results, search_type)
        
        # Fallback to Brave API
        elif self.brave_key:
            results = self._search_brave(query, num_results)
        
        # Fallback to DuckDuckGo (no API key needed)
        else:
            results = self._search_duckduckgo(query, num_results)
        
        # Cache results
        self.cache["searches"][cache_key] = {
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
        self._save_cache()
        
        logger.info(f"[{self.name}] Found {len(results)} results for '{query}'")
        return results
    
    def _search_serper(self, query: str, num: int, search_type: str) -> List[Dict]:
        """Search using Serper (Google) API."""
        try:
            url = "https://google.serper.dev/search"
            if search_type == "news":
                url = "https://google.serper.dev/news"
            
            response = requests.post(
                url,
                headers={"X-API-KEY": self.serper_key},
                json={"q": query, "num": num},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("organic", [])[:num]:
                results.append({
                    "title": item.get("title"),
                    "url": item.get("link"),
                    "snippet": item.get("snippet"),
                    "source": "google"
                })
            
            return results
        except Exception as e:
            logger.warning(f"[{self.name}] Serper search failed: {e}")
            return []
    
    def _search_brave(self, query: str, num: int) -> List[Dict]:
        """Search using Brave API."""
        try:
            response = requests.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={"X-Subscription-Token": self.brave_key},
                params={"q": query, "count": num},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("web", {}).get("results", [])[:num]:
                results.append({
                    "title": item.get("title"),
                    "url": item.get("url"),
                    "snippet": item.get("description"),
                    "source": "brave"
                })
            
            return results
        except Exception as e:
            logger.warning(f"[{self.name}] Brave search failed: {e}")
            return []
    
    def _search_duckduckgo(self, query: str, num: int) -> List[Dict]:
        """Search using DuckDuckGo HTML (no API key needed)."""
        try:
            # Use DuckDuckGo instant answer API
            response = requests.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": query,
                    "format": "json",
                    "no_redirect": 1,
                    "no_html": 1
                },
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            results = []
            
            # Add abstract if available
            if data.get("Abstract"):
                results.append({
                    "title": data.get("Heading", query),
                    "url": data.get("AbstractURL", ""),
                    "snippet": data.get("Abstract"),
                    "source": "duckduckgo"
                })
            
            # Add related topics
            for topic in data.get("RelatedTopics", [])[:num]:
                if isinstance(topic, dict) and topic.get("Text"):
                    results.append({
                        "title": topic.get("Text", "")[:100],
                        "url": topic.get("FirstURL", ""),
                        "snippet": topic.get("Text"),
                        "source": "duckduckgo"
                    })
            
            return results[:num]
        except Exception as e:
            logger.warning(f"[{self.name}] DuckDuckGo search failed: {e}")
            return []
    
    def research_topic(self, topic: str) -> Dict:
        """
        Comprehensive research on a topic.
        
        Returns: Dictionary with various research findings
        """
        logger.info(f"[{self.name}] Researching topic: {topic}")
        
        # General search
        general = self.search(topic, num_results=5)
        
        # Recent news
        news = self.search(f"{topic} latest news 2024", num_results=3, search_type="news")
        
        # Statistics/data
        stats = self.search(f"{topic} statistics data", num_results=3)
        
        return {
            "topic": topic,
            "researched_at": datetime.now().isoformat(),
            "general_results": general,
            "recent_news": news,
            "statistics": stats,
            "total_sources": len(general) + len(news) + len(stats)
        }
    
    def verify_claim(self, claim: str) -> Dict:
        """
        Attempt to verify a factual claim.
        
        Returns: Verification result with sources
        """
        logger.info(f"[{self.name}] Verifying claim: {claim[:50]}...")
        
        # Search for fact-checking results
        fact_check = self.search(f'"{claim}" fact check', num_results=3)
        
        # Search for supporting/contradicting info
        general = self.search(claim, num_results=5)
        
        # Simple heuristic for verification status
        status = "unverified"
        if any("true" in r.get("snippet", "").lower() for r in fact_check):
            status = "likely_true"
        elif any("false" in r.get("snippet", "").lower() for r in fact_check):
            status = "likely_false"
        elif len(general) > 3:
            status = "plausible"
        
        result = {
            "claim": claim,
            "status": status,
            "confidence": 0.5 if status == "unverified" else 0.7,
            "fact_check_sources": fact_check,
            "supporting_sources": general,
            "verified_at": datetime.now().isoformat()
        }
        
        # Cache the fact check
        claim_hash = hash(claim) % 10000
        self.cache["facts"][str(claim_hash)] = result
        self._save_cache()
        
        return result
    
    def find_documentation(self, technology: str) -> List[Dict]:
        """Find official documentation for a technology."""
        return self.search(f"{technology} official documentation", num_results=5)
    
    def get_trending(self, category: str = "technology") -> List[Dict]:
        """Get trending topics in a category."""
        queries = {
            "technology": "trending technology 2024",
            "ai": "trending AI artificial intelligence 2024",
            "design": "trending web design 2024",
            "writing": "trending content writing topics 2024"
        }
        query = queries.get(category, f"trending {category} 2024")
        return self.search(query, num_results=10, search_type="news")
    
    def summarize_results(self, results: List[Dict]) -> str:
        """Create a summary from search results."""
        if not results:
            return "No results found."
        
        lines = [f"Found {len(results)} results:\n"]
        for i, r in enumerate(results[:5], 1):
            lines.append(f"{i}. **{r.get('title', 'Untitled')}**")
            lines.append(f"   {r.get('snippet', 'No description')[:150]}...")
            lines.append(f"   Source: {r.get('url', 'Unknown')}\n")
        
        return "\n".join(lines)


# Singleton instance
_web_scout = None

def get_web_scout() -> WebScout:
    """Get the global web scout instance."""
    global _web_scout
    if _web_scout is None:
        _web_scout = WebScout()
    return _web_scout


if __name__ == "__main__":
    scout = WebScout()
    
    print("=== Web Scout Test ===\n")
    
    # Test search
    print("Searching for 'AI ethics 2024'...")
    results = scout.search("AI ethics 2024", num_results=3)
    print(scout.summarize_results(results))
    
    print("\nSearching for trending AI topics...")
    trending = scout.get_trending("ai")
    for t in trending[:3]:
        print(f"  - {t.get('title', 'Untitled')}")
