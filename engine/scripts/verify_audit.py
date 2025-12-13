
from sqlmodel import select
import asyncio
from app.core.db import get_session
from app.models.run import AuditLog

async def check_audit():
    print("Checking Audit Logs...")
    async for session in get_session():
        stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(5)
        result = await session.execute(stmt)
        logs = result.scalars().all()
        
        for log in logs:
            print(f"[{log.created_at}] Event: {log.event_type} | Actor: {log.actor_id} | Desc: {log.description}")
        
    if not logs:
        print("No logs found.")

if __name__ == "__main__":
    asyncio.run(check_audit())
