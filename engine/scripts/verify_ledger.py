
import asyncio
from uuid import UUID
from app.core.db import get_session
from app.services.billing import BillingService

TENANT_ID = UUID("a9c99c65-e6b3-4c2f-9071-bc6ff4a3fe70")

async def verify_ledger():
    print("--- LEDGER VERIFICATION ---")
    
    async for session in get_session():
        svc = BillingService(session)
        
        # 1. Check Balance (Should be 5000 from webhook)
        bal = await svc.get_balance(TENANT_ID)
        print(f"Current Balance: {bal}")
        
        # 2. Charge 50
        print("Charging 50 credits...")
        await svc.charge(TENANT_ID, 50, "Workflow Run #1")
        
        # 3. Check Balance (Should be 4950)
        bal_new = await svc.get_balance(TENANT_ID)
        print(f"New Balance: {bal_new}")
        
        if bal_new == bal - 50:
            print("✅ Ledger Math is Correct")
        else:
            print(f"❌ Ledger Math Failed: Expected {bal-50}, Got {bal_new}")
            
        break

if __name__ == "__main__":
    asyncio.run(verify_ledger())
