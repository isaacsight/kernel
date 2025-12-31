import json
import logging
from typing import List, Optional

from admin.brain.model_router import ModelRouter, TaskType

logger = logging.getLogger("QueryRewrite")

class QueryRewriter:
    """
    Generates multi-shot search variants based on user intent and mode.
    Inspired by Perplexity's query expansion logic.
    """
    
    def __init__(self, model_router: Optional[ModelRouter] = None):
        self.router = model_router or ModelRouter()
        
    async def rewrite(self, query: str, mode: str = "search") -> List[str]:
        """
        Rewrite a query into multiple high-signal search variants.
        """
        prompt = self._get_rewrite_prompt(query, mode)
        
        try:
            # Use a fast model for query rewriting
            response = await self.router.get_completion(
                TaskType.FAST_SIMPLE,
                prompt,
                temperature=0.3
            )
            
            # Clean and parse response
            text = response.get("text", "")
            if not text:
                return [query]
                
            # Expecting a simple list or JSON list
            if "[" in text and "]" in text:
                start = text.find("[")
                end = text.rfind("]") + 1
                try:
                    queries = json.loads(text[start:end])
                    if isinstance(queries, list):
                        return queries[:6] # Cap at 6
                except:
                    pass
                    
            # Fallback to line split
            lines = [l.strip().lstrip("-").lstrip("0123456789.") for l in text.split("\n") if l.strip()]
            return lines[:6]
            
        except Exception as e:
            logger.error(f"Query rewrite failed: {e}")
            return [query]

    def _get_rewrite_prompt(self, query: str, mode: str) -> str:
        count = 3
        bias = ""
        
        if mode == "research":
            count = 5
            bias = "Generate diverse variants focusing on technical details, history, and current trends."
        elif mode == "academic":
            count = 6
            bias = "Focus on academic terminology, research papers, studies, and datasets. Add keywords like 'paper', 'DOI', 'methodology'."
        elif mode == "reasoning":
            count = 2
            bias = "Generate high-level conceptual variants."

        return f"""
You are the DTFR Query Expansion Engine. Your goal is to rewrite the user's query into {count} high-signal search variants for a search engine.

User Query: "{query}"
Mode: {mode}
{bias}

Rules:
1. Each variant must be short and direct.
2. Focus on maximizing retrieval quality.
3. Output ONLY a valid JSON list of strings.

Format: ["variant 1", "variant 2", ...]
"""
