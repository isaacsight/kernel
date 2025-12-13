
import httpx
import sys
import uuid
import asyncio

BASE_URL = "http://127.0.0.1:8000/api/v1"

# We can reuse the client user we created earlier?
# Client: client@tenant.com (ID: 2040bd3d-6ead-4c75-9bb5-80533c0edb12, Tenant: a9c99c65-e6b3-4c2f-9071-bc6ff4a3fe70)
TENANT_ID = "a9c99c65-e6b3-4c2f-9071-bc6ff4a3fe70" 

def test_webhook_deposit():
    print("1. Testing Stripe Webhook Deposit...")
    # Simulate partial payload
    payload = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": f"cs_test_{uuid.uuid4()}",
                "customer": "cus_test_123",
                "amount_total": 5000, # $50.00 = 5000 credits
                "client_reference_id": TENANT_ID
            }
        }
    }
    
    resp = httpx.post(f"{BASE_URL}/stripe/webhook", json=payload)
    if resp.status_code == 200:
        print(f"✅ Webhook Success: {resp.json()}")
    else:
        print(f"❌ Webhook Failed: {resp.text}")
        sys.exit(1)

async def verify_balance_check():
    # We don't have a public 'get_balance' endpoint yet (only internal svc).
    # But we can try to RUN a billing internal check using a temporary script?
    # Or strict verification: Add a 'get_balance' endpoint for client?
    # Let's interact via `BillingService` directly in python to verify math.
    pass

if __name__ == "__main__":
    test_webhook_deposit()
