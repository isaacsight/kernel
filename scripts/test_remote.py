
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.engineers.remote_worker import get_remote_worker

def test_remote_connection():
    print("Testing Remote Worker Connection...")
    worker = get_remote_worker()
    
    # 1. Health Check
    if worker.check_health():
        print("✅ Health Check Passed")
    else:
        print("❌ Health Check Failed")
        return

    # 2. Command Execution
    print("\nRunning 'whoami' on remote...")
    res = worker.run_command("whoami")
    if res['success']:
        print(f"✅ Success. Output: {res['stdout']}")
    else:
        print(f"❌ Failed. Error: {res.get('error')}")

    # 3. File Upload
    print("\nTesting File Upload...")
    test_file = "test_upload.txt"
    with open(test_file, "w") as f:
        f.write("Hello from Localhost")
    
    if worker.upload_file(test_file, "~/test_upload.txt"):
        print("✅ Upload Success")
    else:
        print("❌ Upload Failed")
    
    # Clean up
    if os.path.exists(test_file):
        os.remove(test_file)

if __name__ == "__main__":
    test_remote_connection()
