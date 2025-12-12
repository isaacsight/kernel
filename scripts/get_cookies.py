
import os
from playwright.sync_api import sync_playwright
import time

def get_cookies():
    print("🍪 Substack Cookie Extractor")
    print("----------------------------")
    print("This script will launch a browser.")
    print("1. Log in to your Substack account.")
    print("2. Once logged in (and you see your dashboard), come back here.")
    print("3. Press ENTER in this terminal to save your cookies.")
    print("\nLaunching browser...")
    
    with sync_playwright() as p:
        # Launch headed browser so user can interact
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        # Go to login
        page.goto("https://substack.com/sign-in")
        
        # Wait for user
        input("\n✅ Press ENTER when you have successfully logged in...")
        
        # Save state
        output_path = "substack_cookies.json"
        context.storage_state(path=output_path)
        
        print(f"\n🎉 Success! Cookies saved to: {output_path}")
        print("You can now run 'python scripts/publish_team_post.py' to use automation.")
        
        browser.close()

if __name__ == "__main__":
    get_cookies()
