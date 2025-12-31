from dtfr.schemas import Source, Mode, ModePreset
from dtfr.search.query_rewrite import rewrite_queries
from dtfr.search.ranker import dedup_by_url, score_sources, diversify_domains


class EvidenceAggregator:
    def __init__(self, providers: list, presets: dict[str, ModePreset]):
        self.providers = providers
        self.presets = presets

    def collect(self, query: str, mode: Mode) -> list[Source]:
        preset = self.presets[mode]
        queries = rewrite_queries(query, mode, preset.query_variants)

        collected: list[Source] = []
        for q in queries:
            for p in self.providers:
                k = preset.pplx_k if getattr(p, "name", "") == "perplexity" else preset.web_k
                try:
                    collected.extend(p.search(q, k=k))
                except Exception:
                    # fail-soft: skip provider errors
                    continue

        merged = dedup_by_url(collected)
        ranked = score_sources(merged, mode)
        diversified = diversify_domains(ranked, cap_per_domain=preset.domain_cap)
        return diversified[: preset.sources_k]
