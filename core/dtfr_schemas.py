from pydantic import BaseModel
from typing import Optional, Any


class PlanStep(BaseModel):
    id: int
    tool_name: str
    arguments: dict[str, Any]
    rationale: str
    expected_outcome: str


class DTFRPlan(BaseModel):
    mission: str
    context: str
    steps: list[PlanStep]
    success_criteria: str


class ExecutionResult(BaseModel):
    step_id: int
    tool_name: str
    input: dict[str, Any]
    output: Any
    status: str  # e.g., "success", "failure"
    error: Optional[str] = None
    duration: float


class DTFRLoopReport(BaseModel):
    task: str
    plan: DTFRPlan
    actions: list[ExecutionResult]
    critique: str
    status: str
    next_steps: list[str]
