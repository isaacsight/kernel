
import sys
import os
# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.brain.intake import get_intake_manager

def ingest_whitepaper():
    file_path = 'content/studio-os-whitepaper.md'
    with open(file_path, 'r') as f:
        content = f.read()
    
    manager = get_intake_manager()
    intake_id = manager.ingest(
        source_type="whitepaper",
        source_path=file_path,
        content=content,
        metadata={"title": "Architectural Overview: The Studio OS and Antigravity System"}
    )
    print(f"Successfully ingested whitepaper with Intake ID: {intake_id}")

if __name__ == "__main__":
    ingest_whitepaper()
