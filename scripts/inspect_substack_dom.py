
from playwright.sync_api import sync_playwright
import os

def inspect_dom():
    cookie_file = "substack_cookies.json"
    if not os.path.exists(cookie_file):
        print("❌ No cookies found.")
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=cookie_file)
        page = context.new_page()
        
        print("Navigating to Substack Publish...")
        page.goto("https://doesthisfeelright.substack.com/publish/post", wait_until="domcontentloaded")
        page.wait_for_timeout(8000) # Wait longer for editor to fully mount
        
        # Dump HTML
        with open("substack_dom_dump.html", "w", encoding="utf-8") as f:
            f.write(page.content())
            
        print("✅ DOM dumped to substack_dom_dump.html")
        browser.close()

if __name__ == "__main__":
    inspect_dom()
