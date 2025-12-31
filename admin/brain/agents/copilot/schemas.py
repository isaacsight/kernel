from typing import List, Optional, Dict, Any, Literal, Union
from pydantic import BaseModel, Field

class SlotDefinition(BaseModel):
    type: str
    required: bool = False
    items: Optional[str] = None
    values: Optional[List[str]] = None

class EssayHint(BaseModel):
    essay_id: str
    weight: float
    anchor: Optional[str] = None

class Scoring(BaseModel):
    base: float
    slot_bonus: Dict[str, float] = Field(default_factory=dict)
    trigger_bonus: Optional[float] = 0.10

class Triggers(BaseModel):
    any: List[str] = Field(default_factory=list)
    missing_slots: List[str] = Field(default_factory=list)

class Question(BaseModel):
    id: str
    mode: List[str]
    stage: str
    text: str
    slot_targets: List[str]
    triggers: Triggers
    essay_hints_pinned: List[EssayHint] = Field(default_factory=list)
    scoring: Scoring

class MappingRule(BaseModel):
    rule_id: str
    terms_any: List[str]
    essay_ids: List[str]
    boost: float

class Essay(BaseModel):
    essay_id: str
    title: str
    url: str
    tags: List[str]
    anchors: Optional[Dict[str, str]] = None

class Routing(BaseModel):
    max_questions_per_turn: int
    default_question_count: int
    stop_conditions: List[str]

class EngineConfig(BaseModel):
    engine_version: str
    brand: str
    modes: List[str]
    routing: Routing
    slots_schema: Dict[str, SlotDefinition]
    essay_index: List[Essay]
    mapping_rules: List[MappingRule]
    question_bank: List[Question]

# Response Schemas
class EssaySuggestion(BaseModel):
    essay_id: str
    title: str
    url: str
    why: str
    score: float

class CopilotResponse(BaseModel):
    success: bool
    slots: Dict[str, Any]
    is_verdict_ready: bool
    selected_questions: List[Dict[str, Any]]
    essay_suggestions: List[EssaySuggestion]
    raw_input: str

class CopilotVerdict(BaseModel):
    mirror: str = Field(description="The 'Studio Mirror' reflection of the user's intent.")
    risks: List[str] = Field(description="Explicit risks identified in the proposal.")
    tradeoffs: List[str] = Field(description="Key tradeoffs required for this path.")
    unknowns: List[str] = Field(description="Critical unknowns that remain.")
    verdict: Literal["proceed", "pivot", "pause"]
    citations: List[str] = Field(description="Slugs of essays used for this judgment.")
