
from uuid import UUID
from typing import Optional
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.billing import Ledger, LedgerType

class BillingService:
    def __init__(self, session: AsyncSession):
        self.session = session
        
    async def get_balance(self, tenant_id: UUID) -> int:
        """
        Calculate current balance by summing all ledger entries.
        """
        statement = select(func.sum(Ledger.amount)).where(Ledger.tenant_id == tenant_id)
        result = await self.session.execute(statement)
        balance = result.scalar()
        return balance or 0
        
    async def deposit(self, tenant_id: UUID, amount: int, description: str, ref_id: Optional[str] = None):
        """
        Add credits (Positive integer).
        """
        if amount <= 0:
            raise ValueError("Deposit amount must be positive")
            
        entry = Ledger(
            tenant_id=tenant_id,
            amount=amount,
            entry_type=LedgerType.DEPOSIT,
            description=description,
            reference_id=ref_id
        )
        self.session.add(entry)
        await self.session.commit()
        return entry

    async def charge(self, tenant_id: UUID, amount: int, description: str, ref_id: Optional[str] = None):
        """
        Deduct credits (Negative integer entry).
        Checks if balance is sufficient first?
        DECISION: Yes, prevent negative balance for now (prepaid model).
        """
        if amount <= 0:
             raise ValueError("Charge amount must be positive (it will be converted to negative ledger entry)")
             
        current = await self.get_balance(tenant_id)
        if current < amount:
            raise ValueError("Insufficient credits")
            
        entry = Ledger(
            tenant_id=tenant_id,
            amount=-amount, # STORE AS NEGATIVE
            entry_type=LedgerType.WITHDRAWAL,
            description=description,
            reference_id=ref_id
        )
        self.session.add(entry)
        await self.session.commit()
        return entry
