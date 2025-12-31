from pydantic import BaseModel
from typing import List, Optional, Any


class DTFRStep(BaseModel):
    id: int
    action: str  # e.g., "read", "write", "search", "run_command"
    target: str  # path or command
    params: Optional[dict[str, Any]] = None
    dependency: Optional[int] = None


class DTFRPlan(BaseModel):
    mission: str
    steps: List[DTFRStep]
    success_criteria: str


class ExecutionResult(BaseModel):
    step_id: int
    action: str
    target: str
    output: str
    status: str  # "success" or "error"
    error: Optional[str] = None


class DTFRReport(BaseModel):
    task: str
    plan: DTFRPlan
    actions: List[ExecutionResult]
    critique: Optional[str] = None
    next_steps: List[str] = []
    timestamp: str
