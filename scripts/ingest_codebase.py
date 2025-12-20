
import os
import sys
import logging
# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.config import config

from admin.brain.memory_store import get_memory_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CodebaseIngestor")

IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', 'venv', '.next', 'dist', 'build', 'dist_electron', 'Applications', 'frameworks'}
IGNORE_EXTS = {'.pyc', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mov', '.mp3', '.wav', '.db', '.sqlite', '.pak', '.bin'}

def ingest_codebase(root_dir):
    """
    Scans the codebase and stores file summaries in the memory brain.
    """
    memory = get_memory_store()
    logger.info(f"🧠 Starting Codebase Ingestion from: {root_dir}")
    
    count = 0
    
    for root, dirs, files in os.walk(root_dir):
        # Filter ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        
        for file in files:
            file_path = os.path.join(root, file)
            _, ext = os.path.splitext(file)
            
            if ext in IGNORE_EXTS or file.startswith('.'):
                continue
                
            try:
                # Read file content (partial)
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    
                # Store in Memory using Intake Pipeline
                relative_path = os.path.relpath(file_path, root_dir)
                
                # Using the new save_intake method
                if hasattr(memory, 'save_intake'):
                    memory.save_intake(
                        source_type="file",
                        source_path=relative_path,
                        content=content[:5000], # Store first 5KB
                        metadata={"type": "code_index", "size": len(content)},
                        status="completed"
                    )
                else:
                    # Fallback if method injection failed
                    logger.warning("save_intake not found, skipping...")
                    continue
                
                count += 1
                if count % 10 == 0:
                    logger.info(f"Indexed {count} files...")
                    
            except Exception as e:
                logger.warning(f"Failed to read {file_path}: {e}")
                
    logger.info(f"✅ Ingestion Complete. Total files indexed: {count}")

if __name__ == "__main__":
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ingest_codebase(project_root)
