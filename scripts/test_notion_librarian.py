import sys
import os
import asyncio

# Add current directory to sys.path to allow imports
sys.path.append(os.getcwd())

from admin.engineers.librarian import Librarian
from admin.config import config

async def test_notion():
    print("Initializing Librarian...")
    lib = Librarian()
    
    if not config.NOTION_API_KEY:
        print("WARNING: NOTION_API_KEY is not set. Skipping live API tests.")
        print("Librarian initialized with notion client: ", lib.notion)
        return

    print("Listing pages...")
    result = await lib.execute("list_notion_pages")
    print("List Pages Result:", result)
    
    # Optional: Test creating a page if DB ID is present
    if config.NOTION_DATABASE_ID:
        print("Creating test page...")
        create_result = await lib.execute("create_notion_page", title="Test Page from Agent", content="This is a test page created by the Librarian agent.")
        print("Create Page Result:", create_result)
    else:
        print("Skipping page creation (NO NOTION_DATABASE_ID)")

if __name__ == "__main__":
    asyncio.run(test_notion())
