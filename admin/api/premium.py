"""
API endpoints for premium essay payments.
"""

from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel, EmailStr
from typing import Optional
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from admin.services.stripe_service import StripeService

router = APIRouter(prefix="/api/premium", tags=["premium"])


class EssayCheckoutRequest(BaseModel):
    essay_slug: str
    essay_tier: str
    essay_title: str
    customer_email: Optional[EmailStr] = None


class SubscriptionCheckoutRequest(BaseModel):
    customer_email: Optional[EmailStr] = None


@router.post("/checkout/essay")
async def create_essay_checkout(request: EssayCheckoutRequest):
    """
    Creates a Stripe checkout for a single premium essay.
    """
    try:
        base_url = os.environ.get("SITE_URL", "https://doesthisfeelright.com")
        
        session = StripeService.create_essay_checkout(
            essay_slug=request.essay_slug,
            essay_tier=request.essay_tier,
            essay_title=request.essay_title,
            success_url=f"{base_url}/posts/{request.essay_slug}.html?success=true",
            cancel_url=f"{base_url}/posts/{request.essay_slug}.html?canceled=true",
            customer_email=request.customer_email
        )
        
        return session
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/checkout/subscription")
async def create_subscription_checkout(request: SubscriptionCheckoutRequest):
    """
    Creates a Stripe checkout for monthly subscription.
    """
    try:
        base_url = os.environ.get("SITE_URL", "https://doesthisfeelright.com")
        
        session = StripeService.create_subscription_checkout(
            success_url=f"{base_url}/premium/success",
            cancel_url=f"{base_url}/premium/subscribe?canceled=true",
            customer_email=request.customer_email
        )
        
        return session
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify/{session_id}")
async def verify_payment(session_id: str):
    """
    Verifies a payment session and returns access details.
    """
    try:
        details = StripeService.verify_session(session_id)
        
        if details['payment_status'] != 'paid':
            raise HTTPException(status_code=402, detail="Payment not completed")
        
        return {
            "access_granted": True,
            "email": details['customer_email'],
            "essay_slug": details['metadata'].get('essay_slug'),
            "mode": details['mode']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    """
    Handles Stripe webhook events.
    """
    try:
        payload = await request.body()
        event = StripeService.handle_webhook(payload.decode(), stripe_signature)
        
        # Handle different event types
        if event['type'] == 'checkout.session.completed':
            # Grant access to essay or subscription
            session = event['data']
            customer_email = session.get('customer_email')
            metadata = session.get('metadata', {})
            
            # TODO: Store access grant in database
            print(f"Access granted to {customer_email} for {metadata}")
        
        elif event['type'] == 'customer.subscription.deleted':
            # Revoke subscription access
            subscription = event['data']
            customer_id = subscription.get('customer')
            
            # TODO: Revoke access in database
            print(f"Subscription canceled for customer {customer_id}")
        
        return {"status": "success"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/access/{essay_slug}")
async def check_essay_access(essay_slug: str, email: EmailStr):
    """
    Checks if a user has access to a specific essay.
    Checks both individual purchases and subscription.
    """
    try:
        # Check subscription first
        has_subscription = StripeService.check_subscription_status(email)
        
        if has_subscription:
            return {"has_access": True, "access_type": "subscription"}
        
        # TODO: Check individual essay purchase from database
        # For now, return False - will implement after database setup
        
        return {"has_access": False}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
