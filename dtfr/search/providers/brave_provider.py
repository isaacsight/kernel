from dtfr.schemas import Source
from dtfr.search.providers.base import SearchProvider


class BraveProvider(SearchProvider):
    name = "brave"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def search(self, query: str, k: int) -> list[Source]:
        if not self.api_key:
            return []

        import httpx

        url = "https://api.search.brave.com/res/v1/web/search"
        headers = {
            "Accept": "application/json",
            "X-Subscription-Token": self.api_key,
        }
        params = {"q": query, "count": min(max(k, 1), 20)}

        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(url, headers=headers, params=params, timeout=15)
                r.raise_for_status()
                j = r.json()
        except Exception:
            return []

        out: list[Source] = []
        for item in (j.get("web", {}).get("results", []) or [])[:k]:
            out.append(
                Source(
                    url=item.get("url", ""),
                    title=(item.get("title") or "")[:300],
                    snippet=(item.get("description") or "")[:600],
                    publisher=(item.get("profile", {}).get("name") or "")[:120],
                    published_at=item.get("page_age"),  # Brave may return relative; keep raw too
                    provider="brave",
                    raw=item,
                )
            )
        return [s for s in out if s.url and s.title]
