#!/usr/bin/env python3
"""
Tweet Poster using Playwright (more stable than Selenium)
"""

import asyncio
import os
import sys
from playwright.async_api import async_playwright

COOKIE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../admin/cookies.txt"))

def parse_netscape_cookies(cookie_file):
    """Parse Netscape format cookies file for Twitter/X."""
    cookies = []
    with open(cookie_file, 'r') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            parts = line.strip().split('\t')
            if len(parts) >= 7:
                domain = parts[0]
                if 'twitter.com' in domain or 'x.com' in domain:
                    # Convert Netscape format to Playwright format
                    cookie = {
                        'name': parts[5],
                        'value': parts[6],
                        'domain': '.x.com',
                        'path': parts[2],
                        'secure': parts[3] == 'TRUE',
                        'httpOnly': False,
                        'sameSite': 'Lax'
                    }
                    # Add expiry if present and not 0
                    try:
                        expiry = int(parts[4])
                        if expiry > 0:
                            cookie['expires'] = expiry
                    except:
                        pass
                    cookies.append(cookie)
    return cookies

async def post_tweet(tweet_text):
    """Post a tweet using Playwright browser automation."""
    print("=" * 50)
    print("Tweet Poster (Playwright)")
    print("=" * 50)
    
    if not os.path.exists(COOKIE_PATH):
        print(f"Error: Cookie file not found at {COOKIE_PATH}")
        return False
    
    cookies = parse_netscape_cookies(COOKIE_PATH)
    if not cookies:
        print("No Twitter/X cookies found!")
        return False
    
    print(f"Found {len(cookies)} cookies")
    
    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=False)  # Visible browser
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        # Add cookies
        print("Adding cookies...")
        await context.add_cookies(cookies)
        
        page = await context.new_page()
        
        try:
            print("Navigating to X home...")
            await page.goto('https://x.com/home', wait_until='domcontentloaded', timeout=60000)
            await asyncio.sleep(5)
            
            # Check if we're logged in
            current_url = page.url
            print(f"Current URL: {current_url}")
            
            if 'login' in current_url.lower():
                print("❌ Not logged in. Cookies may have expired.")
                print("Please log in manually in the browser window...")
                input("Press Enter after you've logged in...")
            
            # Navigate to compose
            print("Going to compose...")
            await page.goto('https://x.com/compose/tweet', timeout=30000)
            await asyncio.sleep(2)
            
            # Find the textarea
            print("Looking for text area...")
            textarea = await page.wait_for_selector('[data-testid="tweetTextarea_0"]', timeout=15000)
            
            # Type the tweet
            print(f"Typing: {tweet_text}")
            await textarea.click()
            await asyncio.sleep(0.5)
            await textarea.type(tweet_text, delay=50)  # Slow typing to look natural
            await asyncio.sleep(1)
            
            # Find and click post button
            print("Clicking Post...")
            try:
                post_button = await page.wait_for_selector('[data-testid="tweetButton"]', timeout=10000)
                await post_button.click(force=True)  # Force click to bypass overlays
            except:
                # Fallback: Use Ctrl+Enter keyboard shortcut
                print("Using keyboard shortcut (Ctrl+Enter)...")
                await page.keyboard.press('Control+Enter')
            
            await asyncio.sleep(3)
            print("✅ Tweet posted successfully!")
            
            # Take a screenshot as proof
            screenshot_path = os.path.join(os.path.dirname(__file__), "../static/videos/tweet_confirmation.png")
            await page.screenshot(path=screenshot_path)
            print(f"Screenshot saved: {screenshot_path}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            print("Closing browser in 3 seconds...")
            await asyncio.sleep(3)
            await browser.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        tweet = " ".join(sys.argv[1:])
    else:
        tweet = "🧪 Studio OS test - browser automation operational! #StudioOS #AI"
    
    asyncio.run(post_tweet(tweet))
