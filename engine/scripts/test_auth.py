
import httpx
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def login(email, password):
    print(f"Logging in as {email}...")
    response = httpx.post(
        f"{BASE_URL}/login/access-token",
        data={"username": email, "password": password}
    )
    if response.status_code != 200:
        print(f"FAILED: {response.text}")
        sys.exit(1)
    return response.json()["access_token"]

def cleanup_workflows(token):
    # Helper to clean up? Or just ignore.
    pass

def run_test():
    print("--- AUTH INTEGRITY TEST ---\n")
    
    # 1. Login
    admin_token = login("admin@antigravity.studio", "admin123")
    client_token = login("client@tenant.com", "client123")
    print("✅ Login Successful\n")
    
    # 2. Admin Actions
    # Admin creates workflow for a random tenant
    print("Testing Admin Capabilities...")
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = httpx.post(
        f"{BASE_URL}/workflows/",
        headers=headers,
        json={
            "tenant_id": "00000000-0000-0000-0000-000000000001",
            "name": "Admin Created Workflow",
            "description": "Should succeed", 
            "config": {}
        }
    )
    if resp.status_code == 200:
        print("✅ Admin Create: Success")
    else:
        print(f"❌ Admin Create: Failed {resp.text}")

    # 3. Client Actions (Own Tenant)
    # We need to know the client's tenant ID. 
    # For this test, we assume the Client knows their ID.
    # In a real app, /me endpoint provides this. 
    # We'll just rely on the API enforcing the override IF we send the wrong one?
    # Wait, our logic says: "if client, enforce tenant_id = current_user.tenant_id".
    # So even if we send WRONG one, it should overwrite or fail.
    # Let's send a JUNK tenant ID and see if it is corrected to the client's actual ID.
    
    print("\nTesting Client Capabilities...")
    client_headers = {"Authorization": f"Bearer {client_token}"}
    
    # 3a. Client Create (Self) - we send a junk ID, API should force correct one OR fail?
    # Code says: raise 403 if mismatch. So we MUST send correct one.
    # But wait, how do we know correct one?
    # Let's try to list workflows first to see if we see anything? Empty.
    
    # Actually, let's test strict enforcement:
    # Try to create for JUNK tenant. Should FAIL 403.
    resp = httpx.post(
        f"{BASE_URL}/workflows/",
        headers=client_headers,
        json={
            "tenant_id": "99999999-9999-9999-9999-999999999999",
            "name": "Client Hack Attempt",
            "description": "Should fail", 
            "config": {}
        }
    )
    if resp.status_code == 403:
        print("✅ Client Hack Attempt: Blocked (403)")
    else:
        print(f"❌ Client Hack Attempt: Failed verification (Got {resp.status_code})")

    # 3b. Client List (Isolation)
    # Admin created a workflow earlier. Client should NOT see it.
    resp = httpx.get(f"{BASE_URL}/workflows/", headers=client_headers)
    items = resp.json()
    if len(items) == 0:
        print("✅ Client Isolation: Verified (Sees 0 items)")
    else:
        print(f"❌ Client Isolation: Failed (Sees {len(items)} items)")

    # 3c. Admin List (Omniscience)
    resp = httpx.get(f"{BASE_URL}/workflows/", headers=headers, params={"tenant_id": "00000000-0000-0000-0000-000000000001"})
    items = resp.json()
    if len(items) >= 1:
        print("✅ Admin Visibility: Verified")
    else:
        print("❌ Admin Visibility: Failed")

if __name__ == "__main__":
    run_test()
