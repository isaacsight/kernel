import logging
import asyncio
from typing import List, Dict, Any, Optional

from admin.infrastructure.perplexity import PerplexityClient
from admin.brain.query_rewrite import QueryRewriter
from admin.brain.websearch import WebSearchClient
from admin.brain.evidence_aggregator import EvidenceAggregator

logger = logging.getLogger("GroundingEngine")

class GroundingEngine:
    """
    Orchestrates the Meta-Retrieval loop: 
    Mode -> Rewrite -> Parallel Retrieval (PPX + Web) -> Aggregate -> Compile.
    """
    
    def __init__(
        self, 
        ppx_client: PerplexityClient, 
        rewriter: Optional[QueryRewriter] = None,
        web_client: Optional[WebSearchClient] = None,
        aggregator: Optional[EvidenceAggregator] = None
    ):
        self.ppx = ppx_client
        self.rewriter = rewriter or QueryRewriter()
        self.web = web_client or WebSearchClient()
        self.aggregator = aggregator or EvidenceAggregator()
        
    async def process(self, query: str, mode: str = "search") -> Dict[str, Any]:
        """
        Runs the grounding pipeline and returns a compiled evidence set.
        """
        # 1. Rewrite Query (unless Search mode, where we can just use the original)
        search_queries = [query]
        if mode in ["research", "academic"]:
            search_queries = await self.rewriter.rewrite(query, mode)
            
        # 2. Parallel Retrieval (Perplexity + WebSearch)
        tasks = []
        for q in search_queries:
            # Perplexity Task
            tasks.append(self.ppx.chat_completion_async(
                model="sonar-pro" if mode == "research" else "sonar",
                messages=[{"role": "user", "content": q}],
                max_tokens=600
            ))
            # WebSearch Task
            tasks.append(self.web.search(q, k=8))
            
        raw_results = await asyncio.gather(*tasks)
        
        # 3. Normalize & Aggregate
        perplexity_results = []
        web_results = []
        
        for res in raw_results:
            if isinstance(res, dict) and "choices" in res: # Perplexity response
                citations = self.ppx.extract_citations(res)
                text = self.ppx.extract_text(res)
                for url in citations:
                    perplexity_results.append({
                        "url": url,
                        "title": self._extract_title(url),
                        "publisher": self._derive_publisher(url),
                        "provider": "perplexity",
                        "snippet": text[:200] if text else "" # Use start of response as snippet if needed
                    })
            elif isinstance(res, list): # WebSearch response
                web_results.extend(res)
                    
        # 4. Evidence Union
        evidence_set = self.aggregator.aggregate([perplexity_results, web_results], mode)
        
        return {
            "query": query,
            "mode": mode,
            "sources": evidence_set,
            "raw_results": raw_results
        }

    def _extract_title(self, url: str) -> str:
        try:
            domain = url.split("//")[-1].split("/")[0].replace("www.", "")
            path = url.split("/")[-1].split("?")[0].replace("-", " ").replace("_", " ")
            if len(path) > 3:
                return f"{path.title()} | {domain}"
            return domain
        except:
            return url

    def _derive_publisher(self, url: str) -> str:
        try:
            return url.split("//")[-1].split("/")[0].replace("www.", "")
        except:
            return "Web Source"
