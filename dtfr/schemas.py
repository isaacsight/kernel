from dataclasses import dataclass, field
from typing import Any, Optional, Literal

Mode = Literal["search", "research", "reasoning", "academic"]


@dataclass
class Source:
    url: str
    title: str
    snippet: str = ""
    publisher: str = ""
    published_at: Optional[str] = None  # YYYY-MM-DD if known
    provider: str = ""  # perplexity | brave | serpapi | dtfr_archive | local_pdf
    score: float = 0.0
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class AnswerResult:
    mode: Mode
    answer_markdown: str
    sources: list[dict]  # normalized + assigned numeric ids
    related_questions: list[str]
    grounded: bool
    confidence: float
    notes: list[str] = field(default_factory=list)


@dataclass
class ModePreset:
    sources_k: int
    query_variants: int
    cross_check: bool
    answer_style: str  # short | medium | long
    domain_cap: int
    web_k: int
    pplx_k: int
