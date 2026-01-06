from typing import AsyncGenerator, Optional
from dtfr.schemas import AnswerResult, Mode, ModePreset
from dtfr.search.aggregator import EvidenceAggregator
from dtfr.search.citations import assign_source_ids
from dtfr.search.related import make_related_questions
from dtfr.search.crosscheck import cross_check
from dtfr.search.sanitizer import sanitize_query, sanitize_for_prompt, is_suspicious
from dtfr.ledger_writer import log_answer_result
import logging

logger = logging.getLogger("AnswerEngine")

SYNTHESIS_SYSTEM = """You are DTFR Answer Engine.
You must synthesize a helpful answer grounded in the provided sources.

Rules:
- Do NOT invent facts. If a fact is not supported by sources, say it’s uncertain.
- Every factual claim must include inline numeric citations like [1] or [2][3].
- If sources conflict, explicitly state disagreement.
- Keep citations next to the sentence they support.
- Never output the sources list yourself; only the answer text with inline citations.
"""


def synthesis_user_prompt(query: str, mode: str, sources_compact: str) -> str:
    style = {
        "search": "Be concise, direct, and practical.",
        "research": "Be thorough, cross-check claims, include uncertainty and tradeoffs.",
        "reasoning": "Prioritize frameworks and decision tradeoffs; use citations only for factual claims.",
        "academic": "Write like a research brief: TL;DR, key findings, methods/limitations, open questions.",
    }[mode]

    return f"""Query: {query}
Mode: {mode}
Style: {style}

Sources (numbered for citation):
{sources_compact}

Write the answer with inline citations only."""


def mode_presets(domain_cap: int = 2) -> dict[str, ModePreset]:
    return {
        "search": ModePreset(
            sources_k=8,
            query_variants=3,
            cross_check=False,
            answer_style="short",
            domain_cap=domain_cap,
            web_k=6,
            pplx_k=8,
        ),
        "research": ModePreset(
            sources_k=14,
            query_variants=6,
            cross_check=True,
            answer_style="long",
            domain_cap=domain_cap,
            web_k=10,
            pplx_k=12,
        ),
        "reasoning": ModePreset(
            sources_k=6,
            query_variants=2,
            cross_check=False,
            answer_style="medium",
            domain_cap=domain_cap,
            web_k=4,
            pplx_k=6,
        ),
        "academic": ModePreset(
            sources_k=18,
            query_variants=8,
            cross_check=True,
            answer_style="long",
            domain_cap=domain_cap,
            web_k=12,
            pplx_k=14,
        ),
    }


class AnswerEngine:
    def __init__(self, model_router, providers: list, domain_cap: int = 2):
        self.router = model_router  # This is the RouterAdapter
        self.presets = mode_presets(domain_cap=domain_cap)
        self.aggregator = EvidenceAggregator(providers=providers, presets=self.presets)

    async def generate(
        self, query: str, mode: Mode = "research", history: Optional[list] = None
    ) -> AsyncGenerator[dict, None]:
        """
        Structured research loop yielding states for the UI.
        """
        # 0. Input Sanitization (Security)
        safe_query = sanitize_query(query)
        if is_suspicious(query):
            logger.warning(f"Suspicious query detected, sanitized: {query[:100]}...")

        # 1. Retrieval Phase
        yield {"type": "thought", "content": f"Searching for {safe_query}..."}

        sources = await self.aggregator.collect(safe_query, mode)
        grounded = len(sources) > 0

        sources_panel = assign_source_ids(sources)

        if grounded:
            yield {"type": "thought", "content": f"Reviewing {len(sources)} sources..."}
            yield {"type": "sources", "content": sources_panel}
        else:
            yield {
                "type": "thought",
                "content": "No direct sources found. Using internal reasoning...",
            }

        # 2. Synthesis Phase
        compact = "\n".join(
            [
                f"[{s['id']}] {s['title']} — {s['url']}\nSnippet: {s.get('snippet', '')}"
                for s in sources_panel
            ]
        )[:12000]

        model = self.router.pick(task="synthesis", mode=mode)
        yield {"type": "thought", "content": f"Synthesizing answer via {model}..."}

        full_answer = ""
        async for chunk in self.router.complete_stream_async(
            model=model,
            system=SYNTHESIS_SYSTEM,
            user=synthesis_user_prompt(
                query=sanitize_for_prompt(safe_query), mode=mode, sources_compact=compact
            ),
            temperature=0.2 if mode in ("research", "academic") else 0.3,
        ):
            full_answer += chunk
            yield {"type": "chunk", "content": chunk}

        # 3. Post-processing Phase
        related = make_related_questions(query, mode)
        yield {"type": "related", "content": related}

        # Badges for UI
        badges = ["Grounded"] if grounded else ["Reasoning"]
        if mode in ("research", "academic"):
            badges.append("Sourced")
        yield {"type": "badges", "content": badges}

        # Cross-check loop (async)
        cross_notes = []
        if self.presets[mode].cross_check and grounded:
            yield {"type": "thought", "content": "Verifying factual claims..."}
            verifier_model = self.router.pick(task="verify", mode=mode)
            cross_notes = await cross_check(self.router, verifier_model, full_answer, compact)
            if cross_notes:
                yield {"type": "notes", "content": cross_notes}

        # 4. Observability: Log to ledger
        try:
            activity_id = log_answer_result(
                inquiry=safe_query,
                mode=mode,
                sources=sources_panel,
                answer=full_answer,
                notes=cross_notes if cross_notes else None,
                grounded=grounded,
            )
            logger.info(f"Logged answer to ledger: {activity_id}")
        except Exception as e:
            logger.warning(f"Failed to log to ledger: {e}")

        yield {"type": "done", "full_content": full_answer}
