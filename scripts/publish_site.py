import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
import admin.core as core

if __name__ == "__main__":
    print("Publishing site to Git...")
    try:
        result = core.publish_git()
        print(result)
    except Exception as e:
        print(f"Error publishing site: {e}")
        sys.exit(1)
