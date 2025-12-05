import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to sys.path so we can import admin.core
sys.path.append(os.getcwd())

try:
    from admin import core
    print("Successfully imported admin.core")
except ImportError as e:
    print(f"Error importing admin.core: {e}")
    sys.exit(1)

def test_remote_generation():
    print("Testing remote generation with Windows Studio Node...")
    topic = "The Joy of Distributed Computing"
    provider = "remote"
    
    try:
        filename = core.generate_ai_post(topic, provider=provider)
        print(f"SUCCESS: Generated post '{filename}' using provider '{provider}'")
        
        # Verify file exists and has content
        filepath = os.path.join("content", filename)
        if os.path.exists(filepath):
            size = os.path.getsize(filepath)
            print(f"File exists at {filepath} (Size: {size} bytes)")
            if size > 0:
                print("Verification PASSED.")
            else:
                print("Verification FAILED: File is empty.")
        else:
            print(f"Verification FAILED: File {filepath} not found.")
            
    except Exception as e:
        print(f"Verification FAILED: Generation raised exception: {e}")

if __name__ == "__main__":
    test_remote_generation()
