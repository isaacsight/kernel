import asyncio
import json
import logging
import os
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any

from admin.infrastructure.perplexity import PerplexityClient
from admin.brain.system_prompts import SystemPrompts

logger = logging.getLogger("WebScout")

try:
    from TikTokApi import TikTokApi

    TIKTOK_AVAILABLE = True
except ImportError:
    TIKTOK_AVAILABLE = False


class ActiveInferenceMindset:
    """
    Tracks belief state and surprise for the search agent.
    """

    def __init__(self):
        self.belief_state = {}  # query_hash -> {expected_count: int, confidence: float}
        self.surprise_threshold = 0.6

    def observe(self, query: str, results: List[Dict]) -> Dict[str, Any]:
        query_hash = str(hash(query) % 100000)
        prior = self.belief_state.get(query_hash, {"expected_count": 5, "confidence": 0.5})

        actual_count = len(results)
        surprise = abs(actual_count - prior["expected_count"]) / max(prior["expected_count"], 1)

        # Update belief state (Bayesian lite)
        self.belief_state[query_hash] = {
            "expected_count": int((prior["expected_count"] + actual_count) / 2),
            "confidence": min(
                1.0,
                prior["confidence"] + 0.1
                if surprise < self.surprise_threshold
                else prior["confidence"] - 0.1,
            ),
        }

        return {
            "surprise": surprise,
            "confidence": self.belief_state[query_hash]["confidence"],
            "high_surprise": surprise > self.surprise_threshold,
        }


class WebScout:
    """
    The Web Scout (Research Intelligence)

    Mission: Provide real-time web research capabilities to the agent team.
    Upgraded with Antigravity Sovereign Principles:
    - Active Inference: Models internal uncertainty and surprise.
    - Kinetic Prompts: Self-instruments research depth.
    - Alchemist Transmutation: Resilient, multi-provider failover.
    """

    def __init__(self):
        self.name = "The Web Scout"
        self.role = "Research Intelligence"
        self.emoji = "🌐"
        self.mindset = ActiveInferenceMindset()
        self.prompts = SystemPrompts()

        # API configurations
        self.serper_key = os.environ.get("SERPER_API_KEY")
        self.brave_key = os.environ.get("BRAVE_API_KEY")
        self.ppx_client = PerplexityClient(os.environ.get("PERPLEXITY_API_KEY"))

        # Cache for recent searches
        self.cache_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "brain", "web_cache.json"
        )
        self.cache = self._load_cache()

        logger.info(f"[{self.name}] Initialized")

    def _load_cache(self) -> Dict:
        """Load search cache from disk."""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r") as f:
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
        with open(self.cache_file, "w") as f:
            json.dump(self.cache, f, indent=2)

    def search(self, query: str, num_results: int = 5, search_type: str = "search") -> List[Dict]:
        """
        Search the web using a Sovereign Active Inference loop.
        """
        # 1. Kinetic Prompt Injection (Metacognition)
        query = self._inject_kinetic_prompts(query)

        cache_key = f"{query}:{search_type}"

        # 2. Epistemic Action (Check Cache)
        if cache_key in self.cache["searches"]:
            cached = self.cache["searches"][cache_key]
            cached_time = datetime.fromisoformat(cached["timestamp"])
            if (datetime.now() - cached_time).seconds < 3600:
                logger.info(f"[{self.name}] Cache Hit (Pragmatic Exploitation): {query[:30]}...")
                return cached["results"]

        # 3. Alchemist Transmutation (Resilient Execution)
        results = self._apply_resilience(query, num_results, search_type)

        # 4. Active Inference Observation (Belief Update)
        observation = self.mindset.observe(query, results)

        if observation["high_surprise"]:
            logger.warning(
                f"[{self.name}] HIGH SURPRISE (Surprise: {observation['surprise']:.2f}). Uncertainty high."
            )

        # Cache results
        self.cache["searches"][cache_key] = {
            "results": results,
            "timestamp": datetime.now().isoformat(),
            "confidence": observation["confidence"],
        }
        self._save_cache()

        logger.info(
            f"[{self.name}] Search Complete. Results: {len(results)}. Confidence: {observation['confidence']:.2f}"
        )
        return results

    def _inject_kinetic_prompts(self, query: str) -> str:
        """Injects deep research protocols if the query is technical."""
        technical_keywords = [
            "architecture",
            "api",
            "implementation",
            "security",
            "optimization",
            "sovereign",
        ]
        if any(k in query.lower() for k in technical_keywords):
            logger.info(f"[{self.name}] Injecting Deep Research Protocol.")
            return f"{self.prompts.get_deep_research_protocol_prompt() if hasattr(self.prompts, 'get_deep_research_protocol_prompt') else 'Conduct a first-principles deep audit.'} Query: {query}"
        return query

    def _apply_resilience(self, query: str, num: int, search_type: str) -> List[Dict]:
        """Alchemist Transmutation: Multi-provider failover logic."""
        providers = [
            ("Perplexity", lambda: self._search_perplexity(query, num)),
            (
                "Serper",
                lambda: self._search_serper(query, num, search_type) if self.serper_key else [],
            ),
            ("Brave", lambda: self._search_brave(query, num) if self.brave_key else []),
            ("DuckDuckGo", lambda: self._search_duckduckgo(query, num)),
        ]

        for name, provider_func in providers:
            try:
                results = provider_func()
                if results:
                    return results
            except Exception as e:
                logger.warning(
                    f"[{self.name}] {name} provider failed: {e}. Transmuting to next provider..."
                )

        return []

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
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("organic", [])[:num]:
                results.append(
                    {
                        "title": item.get("title"),
                        "url": item.get("link"),
                        "snippet": item.get("snippet"),
                        "source": "google",
                    }
                )

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
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("web", {}).get("results", [])[:num]:
                results.append(
                    {
                        "title": item.get("title"),
                        "url": item.get("url"),
                        "snippet": item.get("description"),
                        "source": "brave",
                    }
                )

            return results
        except Exception as e:
            logger.warning(f"[{self.name}] Brave search failed: {e}")
            return []

    def _search_duckduckgo(self, query: str, num: int) -> List[Dict]:
        """Search using DuckDuckGo HTML scraping (no API key needed)."""
        try:
            from bs4 import BeautifulSoup

            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }

            import time
            import random

            # Simple retry logic
            max_retries = 2
            for attempt in range(max_retries + 1):
                try:
                    # Add jitter delay
                    if attempt > 0:
                        time.sleep(random.uniform(2, 5))

                    response = requests.get(
                        "https://html.duckduckgo.com/html/",
                        params={"q": query},
                        headers=headers,
                        timeout=15,
                    )

                    if "anomaly-modal" in response.text or response.status_code == 429:
                        if attempt < max_retries:
                            logger.info(f"[{self.name}] Rate limited, retrying in a moment...")
                            continue
                        else:
                            logger.warning(
                                f"[{self.name}] DuckDuckGo blocked the request (bot detection)."
                            )
                            return []

                    response.raise_for_status()
                    break  # Success
                except Exception as e:
                    if attempt < max_retries:
                        continue
                    raise e

            soup = BeautifulSoup(response.text, "html.parser")
            results = []

            for result in soup.select(".result"):
                if len(results) >= num:
                    break

                title_elem = result.select_one(".result__a")
                snippet_elem = result.select_one(".result__snippet")

                if title_elem and snippet_elem:
                    link = title_elem["href"]
                    results.append(
                        {
                            "title": title_elem.get_text(strip=True),
                            "url": link,
                            "snippet": snippet_elem.get_text(strip=True),
                            "source": "duckduckgo_html",
                        }
                    )

            return results
        except Exception as e:
            logger.warning(f"[{self.name}] DuckDuckGo search failed: {e}")
            logger.warning(
                f"[{self.name}] TIP: Set SERPER_API_KEY or BRAVE_API_KEY for reliable search."
            )
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
            "total_sources": len(general) + len(news) + len(stats),
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
            "verified_at": datetime.now().isoformat(),
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
            "writing": "trending content writing topics 2024",
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

    def _search_perplexity(self, query: str, num_results: int = 5) -> List[Dict]:
        """Performs a grounded search using Perplexity Sonar."""
        try:
            logger.info(f"[{self.name}] Grounded research via Perplexity: {query}")
            response = self.ppx_client.chat_completion(
                model="sonar",
                messages=[
                    {
                        "role": "user",
                        "content": f"Provide a detailed research brief with citations on: {query}",
                    }
                ],
            )
            text = self.ppx_client.extract_text(response)
            citations = self.ppx_client.extract_citations(response)

            # Formulate a result similar to other search providers
            return [
                {
                    "title": f"Perplexity Analysis: {query}",
                    "url": citations[0] if citations else "https://www.perplexity.ai",
                    "snippet": text,
                    "source": "perplexity",
                    "citations": citations,
                }
            ]
        except Exception as e:
            logger.error(f"Perplexity search failed: {e}")
            return []

    async def _fetch_tiktok_async(
        self, query: Optional[str] = None, count: int = 10, method: str = "trending"
    ):
        """Internal async method to interact with TikTokApi"""
        if not TIKTOK_AVAILABLE:
            logger.warning(
                f"[{self.name}] TikTokApi not available. Install it with: pip install TikTokApi playwright"
            )
            return []

        ms_token = os.environ.get("ms_token", None)
        results = []

        try:
            async with TikTokApi() as api:
                # 'webkit' helps avoid bot detection
                await api.create_sessions(
                    ms_tokens=[ms_token], num_sessions=1, sleep_after=3, browser="webkit"
                )

                iterator = None
                if method == "trending":
                    iterator = api.trending.videos(count=count)
                elif method == "search" and query:
                    # 'item' type is for videos.
                    # Note: search might require auth (ms_token) for videos, but we'll try.
                    iterator = api.search.search_type(query, "item", count=count)

                if iterator:
                    async for video in iterator:
                        try:
                            data = video.as_dict
                            stats = data.get("stats", {})
                            results.append(
                                {
                                    "id": data.get("id"),
                                    "desc": data.get("desc", ""),
                                    "author": data.get("author", {}).get("nickname", "Unknown"),
                                    "author_id": data.get("author", {}).get("uniqueId", ""),
                                    "likes": stats.get("diggCount", 0),
                                    "plays": stats.get("playCount", 0),
                                    "url": f"https://www.tiktok.com/@{data.get('author', {}).get('uniqueId')}/video/{data.get('id')}",
                                    "source": "tiktok",
                                }
                            )
                        except Exception as e:
                            logger.warning(f"[{self.name}] Error parsing TikTok video: {e}")
        except Exception as e:
            logger.error(f"[{self.name}] TikTok API error: {e}")

        return results

    def get_tiktok_trends(self, count: int = 10) -> List[Dict]:
        """Get trending TikTok videos."""
        logger.info(f"[{self.name}] Fetching TikTok trends...")
        try:
            return asyncio.run(self._fetch_tiktok_async(count=count, method="trending"))
        except RuntimeError:
            # Handle case where loop is already running (e.g. inside another async function)
            loop = asyncio.get_event_loop()
            return loop.run_until_complete(self._fetch_tiktok_async(count=count, method="trending"))

    def search_tiktok(self, query: str, count: int = 10) -> List[Dict]:
        """Search for TikTok videos."""
        logger.info(f"[{self.name}] Searching TikTok for: {query}")
        try:
            return asyncio.run(self._fetch_tiktok_async(query=query, count=count, method="search"))
        except RuntimeError:
            loop = asyncio.get_event_loop()
            return loop.run_until_complete(
                self._fetch_tiktok_async(query=query, count=count, method="search")
            )


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
