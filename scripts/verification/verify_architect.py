import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to sys.path so we can import admin.engineers
sys.path.append(os.getcwd())

try:
    from admin.engineers.architect import Architect
    print("Successfully imported Architect")
except ImportError as e:
    print(f"Error importing Architect: {e}")
    sys.exit(1)

def test_architect_audit():
    print("Testing Architect system audit with Windows Studio Node...")
    
    architect = Architect()
    if not architect.node_url:
        print("ERROR: STUDIO_NODE_URL is not set.")
        return

    print(f"Architect configured with node: {architect.node_url}")
    
    try:
        report = architect.audit_system()
        print("\n--- ARCHITECT REPORT START ---")
        print(report)
        print("--- ARCHITECT REPORT END ---\n")
        
        if "Architect's Report" in report:
            print("Verification PASSED: Received report from Architect.")
        else:
            print("Verification FAILED: Did not receive expected report format.")
            
    except Exception as e:
        print(f"Verification FAILED: Audit raised exception: {e}")

if __name__ == "__main__":
    test_architect_audit()
