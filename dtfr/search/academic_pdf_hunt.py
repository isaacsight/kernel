from dtfr.schemas import Source


def pdf_hunt(provider, query: str, k: int = 8) -> list[Source]:
    # provider should be websearch (Brave/SerpAPI)
    pdf_query = f"{query} filetype:pdf OR pdf"
    try:
        return provider.search(pdf_query, k=k)
    except Exception:
        return []
