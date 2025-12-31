from urllib.parse import urlparse
from dtfr.schemas import Source, Mode


def _domain(u: str) -> str:
    try:
        return urlparse(u).netloc.lower()
    except Exception:
        return ""


def dedup_by_url(sources: list[Source]) -> list[Source]:
    best = {}
    for s in sources:
        if not s.url:
            continue
        if s.url not in best:
            best[s.url] = s
        else:
            # keep higher score if already computed; otherwise keep first
            if s.score > best[s.url].score:
                best[s.url] = s
    return list(best.values())


def diversify_domains(sources: list[Source], cap_per_domain: int) -> list[Source]:
    counts: dict[str, int] = {}
    out: list[Source] = []
    for s in sources:
        d = _domain(s.url)
        if not d:
            continue
        if counts.get(d, 0) >= cap_per_domain:
            continue
        out.append(s)
        counts[d] = counts.get(d, 0) + 1
    return out


def score_sources(sources: list[Source], mode: Mode) -> list[Source]:
    # Basic scoring: prefer richer snippets, titles, and known “better” provider
    provider_boost = {
        "perplexity": 0.25,
        "brave": 0.15,
        "serpapi": 0.10,
        "local_pdf": 0.30,
    }
    for s in sources:
        score = 0.0
        score += min(len(s.title) / 200.0, 1.0) * 0.15
        score += min(len(s.snippet) / 400.0, 1.0) * 0.15
        score += provider_boost.get(s.provider, 0.0)
        # Academic preference: boost likely-paper links
        if mode == "academic":
            u = s.url.lower()
            if u.endswith(".pdf") or "arxiv" in u or "/doi/" in u:
                score += 0.25
        s.score = score
    return sorted(sources, key=lambda x: x.score, reverse=True)
