import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("EvidenceAggregator")

class EvidenceAggregator:
    """
    Blends, dedups, and reranks evidence from multiple providers.
    """
    
    def __init__(self):
        pass

    def aggregate(self, results_list: List[List[Dict[str, Any]]], mode: str = "search") -> List[Dict[str, Any]]:
        """
        Merge and dedup results from Perplexity and WebSearch.
        """
        merged = []
        seen_urls = set()
        domain_counts = {}

        # 1. Flatten and Dedup
        for sublist in results_list:
            for item in sublist:
                url = item.get("url")
                if not url or url in seen_urls:
                    continue
                
                domain = item.get("publisher", "web")
                # Domain diversity cap
                if domain_counts.get(domain, 0) >= 2:
                    continue
                
                merged.append(item)
                seen_urls.add(url)
                domain_counts[domain] = domain_counts.get(domain, 0) + 1

        # 2. Assign IDs
        for i, item in enumerate(merged):
            item["id"] = i + 1

        # 3. Mode-specific Reranking
        if mode == "academic":
            merged.sort(key=lambda x: ("pdf" in x.get("url", "").lower() or "paper" in x.get("snippet", "").lower()), reverse=True)
        elif mode == "research":
            # Prefer results with snippets and dates
            merged.sort(key=lambda x: (bool(x.get("published_at")) + bool(x.get("snippet"))), reverse=True)

        return merged
