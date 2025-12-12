import sys
import os
import asyncio

# Add current directory to sys.path
sys.path.append(os.getcwd())

from admin.engineers.librarian import Librarian
from admin.config import config

async def test_local_brain():
    print("Initializing Librarian...")
    lib = Librarian()
    
    # 1. Create a dummy test file in docs/
    test_docs_dir = os.path.join(os.getcwd(), 'docs')
    os.makedirs(test_docs_dir, exist_ok=True)
    test_file_path = os.path.join(test_docs_dir, 'secret_project_omega.md')
    
    with open(test_file_path, 'w') as f:
        f.write("# Secret Project Omega\n\nProject Omega is a top-secret initiative to build a coffee machine that predicts the future using quantum foam. The keyword is 'Espresso-Singularity'.")
    
    print(f"Created test file at {test_file_path}")

    # 2. Index Content
    print("Indexing content...")
    index_result = await lib.execute("index_content")
    print("Index Result:", index_result)
    
    # 3. Ask Question
    print("\nAsking question: 'What is Project Omega?'")
    answer = await lib.execute("query_knowledge", question="What is Project Omega? What is the keyword?")
    print("Answer Result:", answer)
    
    # Cleanup
    os.remove(test_file_path)
    print("\nTest complete.")

if __name__ == "__main__":
    asyncio.run(test_local_brain())
