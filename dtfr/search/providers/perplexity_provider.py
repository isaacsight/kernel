import json
from dtfr.schemas import Source
from dtfr.search.providers.base import SearchProvider

PPLX_RETRIEVAL_PROMPT = """You are a retrieval engine.
Given the query, return a JSON array of objects with fields:
url, title, snippet, publisher (optional), published_at (optional).
Return only JSON. No prose.
Query: {query}
"""


class PerplexityProvider(SearchProvider):
    name = "perplexity"

    def __init__(self, client, model: str = "sonar-pro"):
        self.client = client
        self.model = model

    async def search(self, query: str, k: int) -> list[Source]:
        # Ask for more than needed then truncate after dedup/rerank
        want = max(k, 10)

        # Using the existing PerplexityClient.chat_completion_async
        resp = await self.client.chat_completion_async(
            model=self.model,
            messages=[{"role": "user", "content": PPLX_RETRIEVAL_PROMPT.format(query=query)}],
            temperature=0.2,
        )

        text = self.client.extract_text(resp).strip()
        # Find JSON in case there's any bleed
        start = text.find("[")
        end = text.rfind("]") + 1
        if start == -1 or end == 0:
            return []

        try:
            data = json.loads(text[start:end])
        except Exception:
            return []

        out: list[Source] = []
        for item in data[:want]:
            out.append(
                Source(
                    url=item.get("url", ""),
                    title=item.get("title", "")[:300],
                    snippet=item.get("snippet", "")[:600],
                    publisher=item.get("publisher", "")[:120],
                    published_at=item.get("published_at"),
                    provider="perplexity",
                    raw=item,
                )
            )
        return [s for s in out if s.url and s.title]
