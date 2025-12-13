from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlmodel import Field, Relationship, JSON, Column
from .base import BaseTable

class Workflow(BaseTable, table=True):
    __tablename__ = "workflows"

    name: str = Field(index=True)
    description: Optional[str] = None
    is_active: bool = Field(default=True)
    
    # Store the graph structure/metadata
    config: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))

    tasks: List["Task"] = Relationship(back_populates="workflow")
    runs: List["WorkflowRun"] = Relationship(back_populates="workflow")

class Task(BaseTable, table=True):
    __tablename__ = "tasks"

    workflow_id: UUID = Field(foreign_key="workflows.id")
    name: str
    step_id: str = Field(description="Unique ID within the workflow (e.g., 'step_1')")
    
    # Task definition (function to call, params)
    action_type: str = Field(description="e.g., 'llm_call', 'http_request', 'python_script'")
    action_config: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    
    # Dependency graph
    dependencies: List[str] = Field(default=[], sa_column=Column(JSON), description="List of step_ids this task depends on")

    workflow: Workflow = Relationship(back_populates="tasks")
