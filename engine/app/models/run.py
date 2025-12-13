from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlmodel import Field, Relationship, Column, JSON
from .base import BaseTable
from .workflow import Workflow, Task

class WorkflowRun(BaseTable, table=True):
    __tablename__ = "workflow_runs"

    workflow_id: UUID = Field(foreign_key="workflows.id")
    status: str = Field(default="pending", index=True) # pending, running, completed, failed, paused
    
    input_payload: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    output_payload: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    total_cost: float = Field(default=0.0, description="Total cost in USD")
    
    workflow: Workflow = Relationship(back_populates="runs")
    task_runs: List["TaskRun"] = Relationship(back_populates="workflow_run")

class TaskRun(BaseTable, table=True):
    __tablename__ = "task_runs"

    workflow_run_id: UUID = Field(foreign_key="workflow_runs.id")
    task_id: UUID = Field(foreign_key="tasks.id")
    
    status: str = Field(default="pending")
    
    input_data: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    output_data: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    error_message: Optional[str] = None
    
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    cost: float = Field(default=0.0)
    
    workflow_run: WorkflowRun = Relationship(back_populates="task_runs")

class AuditLog(BaseTable, table=True):
    __tablename__ = "audit_logs"

    event_type: str = Field(index=True) # e.g., 'workflow_started', 'approval_granted'
    description: str
    metadata_payload: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    
    # Optional links
    workflow_run_id: Optional[UUID] = Field(default=None, index=True)
    actor_id: Optional[str] = Field(default="system", description="User ID or 'system'")
