from dtfr.schemas import Mode


def make_related_questions(user_query: str, mode: Mode) -> list[str]:
    base = user_query.strip().rstrip("?")

    if mode == "academic":
        return [
            f"What are the most-cited papers on {base}?",
            f"What datasets/benchmarks are used to evaluate {base}?",
            f"What are the key limitations or threats to validity for {base} studies?",
            f"How has {base} changed over the last 2–3 years?",
            f"What are the strongest competing approaches to {base}?",
            f"What open problems remain in {base} research?",
        ]

    return [
        f"What’s the latest update on {base}?",
        f"What are the main arguments for and against {base}?",
        f"How does {base} compare to the closest alternatives?",
        f"What are the practical next steps to implement {base}?",
        f"What are common failure modes or risks with {base}?",
        f"What would a minimal example or checklist look like for {base}?",
    ]
