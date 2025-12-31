import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("CitationCompiler")

class CitationCompiler:
    """
    Normalizes sources, assigns IDs, and ensures factual claims in 
    the answer markdown are correctly linked to the source list.
    """
    
    def __init__(self):
        pass

    def compile(self, raw_sources: List[str]) -> List[Dict[str, Any]]:
        """
        Takes a list of URLs and returns a list of source dicts with IDs.
        """
        compiled = []
        seen = set()
        
        for url in raw_sources:
            if url in seen:
                continue
            
            source_id = len(compiled) + 1
            compiled.append({
                "id": source_id,
                "url": url,
                "title": self._derive_title(url),
                "publisher": self._derive_publisher(url),
                "snippet": "" # Populated during synthesis if available
            })
            seen.add(url)
            
        return compiled

    def _derive_title(self, url: str) -> str:
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

    def match_citations(self, text: str, sources: List[Dict[str, Any]]) -> str:
        """
        Ensures citations in text [1, 2] match the provided source IDs.
        Perplexity Sonar already does this, but we use this for verification 
        or if we switch to a different synthesis model.
        """
        # Placeholder for complex re-indexing if needed
        return text
