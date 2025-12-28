import os
import json
import time
import requests
import logging
from typing import Dict, Optional

logger = logging.getLogger("FigmaScout")

class FigmaScout:
    """
    Connects to Figma API to extract design tokens with rate limit awareness.
    """
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("FIGMA_API_KEY")
        self.base_url = "https://api.figma.com/v1"
        self.cache_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'brain', 'figma_cache.json'
        )
        
    def _load_cache(self) -> Dict:
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {}

    def _save_cache(self, data: Dict):
        os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)
        with open(self.cache_file, 'w') as f:
            json.dump(data, f, indent=2)

    def get_file_styles(self, file_key: str, force_refresh: bool = False) -> Dict:
        """
        Extracts styles (colors, type) from a Figma file.
        Uses local cache to avoid hitting rate limits.
        """
        if not self.api_key:
            return {"error": "No Figma API Key provided. Set FIGMA_API_KEY."}

        # Check cache
        cache = self._load_cache()
        cache_key = f"styles_{file_key}"
        
        if not force_refresh and cache_key in cache:
            cached_time = cache[cache_key].get("timestamp", 0)
            # Cache for 24 hours to be safe with rate limits
            if time.time() - cached_time < 86400:
                logger.info(f"[{self.base_url}] Using cached Figma styles (Rate Limit Protection)")
                return cache[cache_key]["data"]

        logger.info(f"Fetching fresh data from Figma: {file_key}")
        try:
            headers = {"X-Figma-Token": self.api_key}
            response = requests.get(
                f"{self.base_url}/files/{file_key}/styles",
                headers=headers,
                timeout=10
            )
            
            # Check for Rate Limits
            remaining = response.headers.get('X-RateLimit-Remaining')
            if remaining and int(remaining) < 5:
                logger.warning(f"Figma Rate Limit Warning: Only {remaining} requests remaining!")

            response.raise_for_status()
            data = response.json()
            
            # Save to cache
            cache[cache_key] = {
                "timestamp": time.time(),
                "data": data
            }
            self._save_cache(cache)
            
            return data
        except Exception as e:
            logger.error(f"Figma API failed: {e}")
            # If API fails (e.g. rate limit), try to return old cache even if expired
            if cache_key in cache:
                logger.warning("Returning expired cache due to API failure.")
                return cache[cache_key]["data"]
            return {"error": str(e)}
