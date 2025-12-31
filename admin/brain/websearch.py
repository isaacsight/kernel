import os
import requests
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("WebSearch")

class WebSearchClient:
    """
    Client for raw web search providers (Serper, Brave, etc.).
    Normalizes results into the Answer Engine schema.
    """
    
    def __init__(self, api_key: Optional[str] = None, provider: str = "serper"):
        self.provider = provider
        self.api_key = api_key or os.environ.get("SERPER_API_KEY") if provider == "serper" else os.environ.get("BRAVE_API_KEY")
        
    async def search(self, query: str, k: int = 8) -> List[Dict[str, Any]]:
        """
        Search the web and return normalized results.
        """
        if not self.api_key:
            logger.warning(f"No API key for search provider {self.provider}")
            return []

        if self.provider == "serper":
            return await self._search_serper(query, k)
        elif self.provider == "brave":
            return await self._search_brave(query, k)
        else:
            return []

    async def _search_serper(self, query: str, k: int) -> List[Dict[str, Any]]:
        url = "https://google.serper.dev/search"
        payload = {"q": query, "num": k}
        headers = {
            'X-API-KEY': self.api_key,
            'Content-Type': 'application/json'
        }
        
        try:
            # Using requests for simplicity in this utility
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            data = response.json()
            
            results = []
            for item in data.get("organic", []):
                results.append({
                    "url": item.get("link"),
                    "title": item.get("title"),
                    "snippet": item.get("snippet"),
                    "publisher": item.get("domain") or self._derive_domain(item.get("link")),
                    "published_at": item.get("date"),
                    "provider": "websearch:serper"
                })
            return results
        except Exception as e:
            logger.error(f"Serper search failed: {e}")
            return []

    async def _search_brave(self, query: str, k: int) -> List[Dict[str, Any]]:
        url = "https://api.search.brave.com/res/v1/web/search"
        headers = {"Accept": "application/json", "X-Subscription-Token": self.api_key}
        params = {"q": query, "count": k}
        
        try:
            response = requests.get(url, headers=headers, params=params, timeout=10)
            data = response.json()
            
            results = []
            for item in data.get("web", {}).get("results", []):
                results.append({
                    "url": item.get("url"),
                    "title": item.get("title"),
                    "snippet": item.get("description"),
                    "publisher": self._derive_domain(item.get("url")),
                    "published_at": None, # Brave requires extra steps for dates
                    "provider": "websearch:brave"
                })
            return results
        except Exception as e:
            logger.error(f"Brave search failed: {e}")
            return []

    def _derive_domain(self, url: str) -> str:
        try:
            return url.split("//")[-1].split("/")[0].replace("www.", "")
        except:
            return "Web"
