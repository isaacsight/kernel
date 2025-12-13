from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_session
from app.models.workflow import Workflow

router = APIRouter()

@router.post("/", response_model=Workflow)
async def create_workflow(
    workflow: Workflow,
    session: AsyncSession = Depends(get_session)
):
    """
    Create a new workflow.
    Requires strict tenant_id enforcement in the payload.
    """
    session.add(workflow)
    await session.commit()
    await session.refresh(workflow)
    return workflow

@router.get("/", response_model=List[Workflow])
async def list_workflows(
    tenant_id: UUID, 
    skip: int = 0, 
    limit: int = 100,
    session: AsyncSession = Depends(get_session)
):
    """
    List workflows for a specific tenant.
    ALWAYS requires tenant_id filter.
    """
    statement = select(Workflow).where(Workflow.tenant_id == tenant_id).offset(skip).limit(limit)
    result = await session.execute(statement)
    workflows = result.scalars().all()
    return workflows

@router.get("/{workflow_id}", response_model=Workflow)
async def get_workflow(
    workflow_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """
    Get a specific workflow by ID.
    TODO: Add tenant_id check for security context.
    """
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow
