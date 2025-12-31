from dtfr.schemas import Mode


def rewrite_queries(user_query: str, mode: Mode, n: int) -> list[str]:
    base = user_query.strip()
    if n <= 1:
        return [base]

    variants = [base]

    # Lightweight deterministic rewrites (no LLM needed)
    if mode in ("search", "research"):
        variants += [
            f"{base} latest",
            f"{base} official documentation",
        ]
    if mode == "academic":
        variants += [
            f"{base} pdf",
            f"{base} survey paper",
            f"{base} benchmark dataset",
            f"{base} arxiv",
        ]
    if mode == "reasoning":
        variants += [
            f"{base} tradeoffs",
            f"{base} best practices",
        ]

    # Trim to n with uniqueness
    seen = set()
    out = []
    for q in variants:
        q2 = " ".join(q.split())
        if q2 not in seen:
            out.append(q2)
            seen.add(q2)
        if len(out) >= n:
            break
    return out
