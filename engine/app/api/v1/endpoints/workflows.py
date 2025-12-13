from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_session
from app.api import deps
from app.models.user import User, UserRole
from app.models.workflow import Workflow

router = APIRouter()

@router.post("/", response_model=Workflow)
async def create_workflow(
    workflow: Workflow,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Create a new workflow.
    - Admin: Can create for any tenant.
    - Client: Must create for OWN tenant (override payload).
    """
    if current_user.role == UserRole.CLIENT:
        # Normalize to string for comparison (SQLite/Pydantic type safety)
        if str(workflow.tenant_id) != str(current_user.tenant_id):
             raise HTTPException(status_code=403, detail="Cannot create resources for other tenants")
        # Enforce it just in case
        workflow.tenant_id = current_user.tenant_id
        
    session.add(workflow)
    
    # Audit Log
    from app.models.run import AuditLog
    audit = AuditLog(
        tenant_id=workflow.tenant_id,
        event_type="workflow_created",
        description=f"Workflow '{workflow.name}' created by {current_user.email}",
        actor_id=str(current_user.id),
        metadata_payload={"workflow_id": str(workflow.id)}
    )
    session.add(audit)
    
    await session.commit()
    await session.refresh(workflow)
    return workflow

@router.get("/", response_model=List[Workflow])
async def list_workflows(
    tenant_id: Optional[UUID] = None, 
    skip: int = 0, 
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(deps.get_current_user)
):
    """
    List workflows.
    - Admin: Can use 'tenant_id' filter to see specific, or None to see all.
    - Client: Forced to their own tenant_id.
    """
    statement = select(Workflow)
    
    if current_user.role == UserRole.CLIENT:
        # Client sees ONLY their data
        statement = statement.where(Workflow.tenant_id == current_user.tenant_id)
    elif tenant_id:
        # Admin filters by specific tenant
        statement = statement.where(Workflow.tenant_id == tenant_id)
    # Else Admin sees all
        
    statement = statement.offset(skip).limit(limit)
    result = await session.execute(statement)
    workflows = result.scalars().all()
    return workflows

@router.get("/{workflow_id}", response_model=Workflow)
async def get_workflow(
    workflow_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Get workflow by ID.
    Enforces isolation.
    """
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    if current_user.role == UserRole.CLIENT and workflow.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Workflow not found") # Hide existence
        
    return workflow
