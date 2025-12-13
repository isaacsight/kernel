
import asyncio
import uuid
from sqlmodel import select
from app.core.db import get_session, engine
from app.models.workflow import Workflow, Task
from app.models.run import WorkflowRun, TaskRun, AuditLog

async def seed_data():
    print("Seeding data...")
    
    # 1. Define Tenants
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()
    
    # Iterate over the generator to get the session
    async for session in get_session():
        # 2. Create Workflow for Tenant A (Creator Ops)
        wf1 = Workflow(
            id=uuid.uuid4(),
            tenant_id=tenant_a_id,
            name="YouTube Repurpose Workflow",
            description="Extract clips and post to Shorts",
            config={"model": "gpt-4"}
        )
        
        # 3. Add Tasks
        task1 = Task(
            tenant_id=tenant_a_id,
            workflow=wf1,
            name="Download Video",
            step_id="step_1",
            action_type="function",
            action_config={"func": "download_youtube"}
        )
        
        task2 = Task(
            tenant_id=tenant_a_id,
            workflow=wf1,
            name="Generate Clips",
            step_id="step_2",
            action_type="llm",
            action_config={"prompt": "Extract viral moments"},
            dependencies=["step_1"]
        )
        
        session.add(wf1)
        session.add(task1)
        session.add(task2)
        
        # 4. Create Run
        run1 = WorkflowRun(
            tenant_id=tenant_a_id,
            workflow=wf1,
            status="running",
            input_payload={"url": "https://youtube.com/watch?v=123"}
        )
        session.add(run1)
        
        # 5. Add Audit Log
        audit = AuditLog(
            tenant_id=tenant_a_id,
            event_type="workflow_started",
            description="Review started by system",
            workflow_run_id=run1.id
        )
        session.add(audit)
        
        await session.commit()
    
    print(f"Seeded Tenant A: {tenant_a_id}")
    print("Success!")

if __name__ == "__main__":
    # Fix for weird loop behavior in some envs
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        loop.create_task(seed_data())
    else:
        asyncio.run(seed_data())
