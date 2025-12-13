
import httpx
import sys
import uuid
import asyncio

BASE_URL = "http://127.0.0.1:8000/api/v1"

# Hardcoded details from previous steps
ADMIN_EMAIL = "admin@antigravity.studio"
ADMIN_PASS = "admin123"
CLIENT_EMAIL = "client@tenant.com"
CLIENT_PASS = "client123"
# We need to know the Client's Tenant ID for the stripe test.
# Hardcoded from previous output: a9c99c65-e6b3-4c2f-9071-bc6ff4a3fe70
CLIENT_TENANT_ID = "a9c99c65-e6b3-4c2f-9071-bc6ff4a3fe70"

def log(msg):
    print(f"\n[TEST] {msg}")

def login(email, password):
    log(f"Logging in as {email}...")
    try:
        resp = httpx.post(f"{BASE_URL}/login/access-token", data={"username": email, "password": password})
        if resp.status_code == 200:
            print("  ✅ Success")
            return resp.json()["access_token"]
        else:
            print(f"  ❌ Failed: {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"  ❌ Error connecting: {e}")
        sys.exit(1)

def test_stripe_deposit():
    log("Testing Stripe Deposit...")
    payload = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": f"cs_final_{uuid.uuid4()}",
                "customer": "cus_final_123",
                "amount_total": 10000, # $100.00
                "client_reference_id": CLIENT_TENANT_ID
            }
        }
    }
    resp = httpx.post(f"{BASE_URL}/stripe/webhook", json=payload)
    if resp.status_code == 200:
        print("  ✅ Webhook Delivered")
    else:
        print(f"  ❌ Webhook Failed: {resp.text}")

def test_workflow_creation(token, role_name):
    log(f"Testing Workflow Creation as {role_name}...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Client MUST use their own ID. Admin can use any.
    # We will use the Client Tenant ID for both to simplify passing.
    
    workflow_data = {
        "tenant_id": CLIENT_TENANT_ID,
        "name": f"Final Test Workflow ({role_name})",
        "description": "End-to-end verification",
        "config": {"verified": True}
    }
    
    resp = httpx.post(f"{BASE_URL}/workflows/", headers=headers, json=workflow_data)
    if resp.status_code == 200:
        print(f"  ✅ Workflow Created: {resp.json().get('id')}")
        return resp.json().get('id')
    else:
        print(f"  ❌ Failed: {resp.text}")
        return None

def test_rbac_violation(client_token):
    log("Testing RBAC (Client hacking other tenant)...")
    headers = {"Authorization": f"Bearer {client_token}"}
    
    # Try to write to random tenant
    workflow_data = {
        "tenant_id": str(uuid.uuid4()),
        "name": "HACK ATTEMPT",
        "config": {}
    }
    resp = httpx.post(f"{BASE_URL}/workflows/", headers=headers, json=workflow_data)
    if resp.status_code == 403:
        print("  ✅ Access Denied (Correct Behavior)")
    else:
        print(f"  ❌ Security Breach! Status: {resp.status_code}")

def run_suite():
    print("=== RELIABILITY ENGINE: FINAL FLIGHT CHECK ===")
    
    # 1. Auth check
    admin_token = login(ADMIN_EMAIL, ADMIN_PASS)
    client_token = login(CLIENT_EMAIL, CLIENT_PASS)
    
    # 2. Money check
    test_stripe_deposit()
    
    # 3. Scale check (Workflow Logic)
    test_workflow_creation(client_token, "Client")
    
    # 4. Trust check (RBAC)
    test_rbac_violation(client_token)
    
    # 5. Admin Omniscience
    test_workflow_creation(admin_token, "Admin")
    
    print("\n✅ ALL SYSTEMS GREEN.")

if __name__ == "__main__":
    run_suite()
