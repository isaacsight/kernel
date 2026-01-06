import asyncio
import time
from dtfr.schemas import Source, ModePreset
from dtfr.search.aggregator import EvidenceAggregator
from dtfr.search.providers.base import SearchProvider


class MockProvider(SearchProvider):
    def __init__(self, name, delay):
        self.name = name
        self.delay = delay

    async def search(self, query, k):
        print(f"[{self.name}] Searching for '{query}'...")
        await asyncio.sleep(self.delay)
        print(f"[{self.name}] Finished '{query}' after {self.delay}s")
        return [
            Source(
                url=f"http://{self.name}.com/{query}",
                title=f"Result for {query}",
                provider=self.name,
            )
        ]


async def test_parallel_retrieval():
    presets = {
        "search": ModePreset(
            sources_k=8,
            query_variants=2,
            cross_check=False,
            answer_style="short",
            domain_cap=2,
            web_k=5,
            pplx_k=5,
        )
    }

    # Mocking rewrite_queries to return 2 variants
    import dtfr.search.aggregator

    dtfr.search.aggregator.rewrite_queries = lambda q, m, v: [q, f"{q} variant"]

    providers = [MockProvider("FastProv", 0.5), MockProvider("SlowProv", 1.5)]

    agg = EvidenceAggregator(providers=providers, presets=presets)

    start_time = time.time()
    print("🚀 Starting parallel retrieval test...")
    results = await agg.collect("test query", "search")
    end_time = time.time()

    total_time = end_time - start_time
    print(f"\n✅ Parallel Retrieval Complete.")
    print(f"Total time: {total_time:.2f}s")
    print(f"Total results: {len(results)}")

    # If serial, time would be (0.5 + 1.5) * 2 = 4.0s
    # If parallel, time should be ~1.5s (the slowest provider)
    if total_time < 2.0:
        print("🎉 SUCCESS: Retrieval is running in parallel!")
    else:
        print("❌ FAILURE: Retrieval appears to be serial.")


if __name__ == "__main__":
    asyncio.run(test_parallel_retrieval())
