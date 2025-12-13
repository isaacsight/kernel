
from fastapi import APIRouter, Request, Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_session
from app.services.billing import BillingService
from app.models.billing import Subscription, SubscriptionStatus
from uuid import UUID

router = APIRouter()

# Placeholder for Stripe Secret
STRIPE_WEBHOOK_SECRET = "whsec_TEST" 

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None),
    session: AsyncSession = Depends(get_session)
):
    """
    Handle Stripe events.
    For MVP, we just simulate: 'checkout.session.completed' -> Deposit Credits.
    Dictionary payload simulation since we don't have real Stripe lib installed yet.
    """
    payload = await request.json()
    event_type = payload.get("type")
    
    if event_type == "checkout.session.completed":
        data = payload.get("data", {}).get("object", {})
        customer_id = data.get("customer")
        amount_total = data.get("amount_total") # e.g. 1000 = $10.00
        
        # We need to map Stripe Customer -> Tenant.
        # For this MVP, we pass 'client_reference_id' is the tenant_id in Checkout Session
        tenant_id_str = data.get("client_reference_id") 
        if not tenant_id_str:
             return {"status": "ignored", "reason": "no_tenant_ref"}
             
        billing = BillingService(session)
        await billing.deposit(
            tenant_id=UUID(tenant_id_str),
            amount=amount_total, # 1-to-1 credit mapping? Or $1 = 100 credits? Let's say 1 cent = 1 credit.
            description=f"Stripe Payment {data.get('id')}",
            ref_id=data.get("id")
        )
        return {"status": "success", "action": "deposited"}
        
    return {"status": "received"}
