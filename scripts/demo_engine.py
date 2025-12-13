
import httpx
import uuid
import json

BASE_URL = "http://127.0.0.1:8000/api/v1"
TENANT_ID = str(uuid.uuid4())
OTHER_TENANT_ID = str(uuid.uuid4())

def print_json(data):
    print(json.dumps(data, indent=2))

def run_demo():
    print(f"--- DEMO START: Tenant {TENANT_ID} ---")
    
    # 1. Create Workflow
    print("\n1. Creating 'SEO Optimizer' Workflow...")
    response = httpx.post(
        f"{BASE_URL}/workflows/",
        json={
            "tenant_id": TENANT_ID,
            "name": "SEO Optimizer",
            "description": "Daily verification of site ranking",
            "config": {"schedule": "daily"}
        }
    )
    if response.status_code == 200:
        print("Success!")
        print_json(response.json())
    else:
        print("Failed:", response.text)

    # 2. List Workflows (Correct Tenant)
    print("\n2. Listing Workflows for Tenant...")
    response = httpx.get(f"{BASE_URL}/workflows/?tenant_id={TENANT_ID}")
    print_json(response.json())

    # 3. List Workflows (Wrong Tenant) - Should be empty
    print("\n3. Attempting access with WRONG Tenant ID...")
    response = httpx.get(f"{BASE_URL}/workflows/?tenant_id={OTHER_TENANT_ID}")
    print("Result (Should be empty list):")
    print_json(response.json())

if __name__ == "__main__":
    run_demo()
