from dtfr.schemas import Source


def assign_source_ids(sources: list[Source]) -> list[dict]:
    out = []
    for i, s in enumerate(sources, start=1):
        out.append(
            {
                "id": i,
                "url": s.url,
                "title": s.title,
                "snippet": s.snippet,
                "publisher": s.publisher,
                "published_at": s.published_at,
                "provider": s.provider,
                "score": s.score,
            }
        )
    return out
